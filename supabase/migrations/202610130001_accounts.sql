begin;
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 160),
  short_name text not null check (length(short_name) between 1 and 40),
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now()
);
create table public.organization_users (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('organization_admin','sender','viewer','billing_admin')),
  active boolean not null default true,
  primary key (organization_id,user_id)
);
create index organization_users_user on public.organization_users(user_id);

-- Roles come from controlled database records, never user-editable JWT metadata.
-- Require a provider session that still exists, so sign-out closes database access
-- even if an access JWT has not expired yet.
create function app_private.is_member(org uuid, allowed_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_users m
    join public.organizations o on o.id=m.organization_id
    where m.organization_id=org and m.user_id=auth.uid() and m.active
      and o.status='active' and (allowed_roles is null or m.role=any(allowed_roles))
      and exists (select 1 from auth.sessions s
        where s.id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid())
  );
$$;
revoke all on function app_private.is_member(uuid,text[]) from public;
grant execute on function app_private.is_member(uuid,text[]) to authenticated;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  first_name text not null check (length(first_name) between 1 and 80),
  last_name text not null check (length(last_name) between 1 and 80),
  mobile text not null check (mobile ~ '^\+1[2-9][0-9]{9}$'),
  status text not null default 'active' check (status in ('active','inactive')),
  consent_status text not null default 'unknown' check (consent_status in ('unknown','subscribed','unsubscribed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id,mobile)
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(name) between 1 and 100),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id,name)
);
create table public.contact_groups (
  organization_id uuid not null references public.organizations(id), contact_id uuid not null, group_id uuid not null,
  primary key (organization_id,contact_id,group_id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id),
  foreign key (organization_id,group_id) references public.groups(organization_id,id)
);
create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id),
  message_prefix text not null default '',
  message_suffix text not null default E'\nReply STOP to unsubscribe.' check (position('Reply STOP to unsubscribe.' in message_suffix)>0)
);
create table public.number_suppressions (
  organization_id uuid not null references public.organizations(id), mobile text not null,
  created_at timestamptz not null default now(), primary key (organization_id,mobile)
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  actor_id uuid, entity text not null, entity_id text not null, action text not null,
  changed_fields text[] not null default '{}', created_at timestamptz not null default now()
);

create function app_private.protect_contact() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.organization_id <> old.organization_id then raise exception 'Organization cannot be changed'; end if;
  if old.consent_status='unsubscribed' and new.consent_status<>'unsubscribed' then
    raise exception 'Re-consent requires a separate verified workflow';
  end if;
  if new.consent_status='subscribed' and old.consent_status<>'subscribed' then
    raise exception 'Consent evidence requires a separate verified workflow';
  end if;
  if new.mobile<>old.mobile and new.consent_status='subscribed' then new.consent_status:='unknown'; end if;
  new.updated_at:=now();
  return new;
end;
$$;
create trigger protect_contact before update on public.contacts for each row execute function app_private.protect_contact();
create function app_private.record_contact_suppression() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.consent_status='unsubscribed' then
    insert into public.number_suppressions(organization_id,mobile) values(new.organization_id,new.mobile) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger contact_suppression after insert or update on public.contacts for each row execute function app_private.record_contact_suppression();
create function app_private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare fields text[]; old_json jsonb; new_json jsonb;
begin
  new_json:=to_jsonb(new);
  old_json:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  select coalesce(array_agg(key order by key),'{}') into fields from jsonb_each(new_json)
    where value is distinct from old_json->key and key not in ('updated_at','created_at');
  insert into public.audit_events(organization_id,actor_id,entity,entity_id,action,changed_fields)
    values(new.organization_id,auth.uid(),tg_table_name,coalesce(new_json->>'id',new_json->>'user_id',new_json->>'contact_id',new_json->>'organization_id'),tg_op,fields);
  return new;
end;
$$;
create trigger membership_audit after insert or update on public.organization_users for each row execute function app_private.audit_change();
create trigger contacts_audit after insert or update on public.contacts for each row execute function app_private.audit_change();
create trigger groups_audit after insert or update on public.groups for each row execute function app_private.audit_change();
create trigger settings_audit after insert or update on public.organization_settings for each row execute function app_private.audit_change();
revoke all on function app_private.protect_contact(), app_private.record_contact_suppression(), app_private.audit_change() from public;

-- Explicit grants: customers cannot create organizations, grant roles, change
-- subscriptions or forge announcement/delivery results. Those are later worker APIs.
revoke all on public.organizations,public.organization_users,public.contacts,public.groups,public.contact_groups,
  public.organization_settings,public.number_suppressions,public.audit_events from public,anon,authenticated;
grant select on public.organizations,public.organization_users,public.contacts,public.groups,public.contact_groups,
  public.organization_settings,public.number_suppressions,public.audit_events to authenticated;
grant insert(first_name,last_name,mobile,organization_id) on public.contacts to authenticated;
grant update(first_name,last_name,mobile,status) on public.contacts to authenticated;
grant insert(organization_id,name),update(name,archived) on public.groups to authenticated;
-- Group assignment and consent capture need transactional, audited APIs, added next.

alter table public.organizations enable row level security;
alter table public.organization_users enable row level security;
alter table public.contacts enable row level security;
alter table public.groups enable row level security;
alter table public.contact_groups enable row level security;
alter table public.organization_settings enable row level security;
alter table public.number_suppressions enable row level security;
alter table public.audit_events enable row level security;
create policy member_organizations on public.organizations for select to authenticated using(app_private.is_member(id));
create policy own_membership on public.organization_users for select to authenticated using(user_id=auth.uid() and app_private.is_member(organization_id));
create policy member_contacts on public.contacts for select to authenticated using(app_private.is_member(organization_id));
create policy admin_insert_contacts on public.contacts for insert to authenticated with check(app_private.is_member(organization_id,array['organization_admin']) and consent_status='unknown');
create policy admin_update_contacts on public.contacts for update to authenticated using(app_private.is_member(organization_id,array['organization_admin'])) with check(app_private.is_member(organization_id,array['organization_admin']));
create policy member_groups on public.groups for select to authenticated using(app_private.is_member(organization_id));
create policy admin_insert_groups on public.groups for insert to authenticated with check(app_private.is_member(organization_id,array['organization_admin']));
create policy admin_update_groups on public.groups for update to authenticated using(app_private.is_member(organization_id,array['organization_admin'])) with check(app_private.is_member(organization_id,array['organization_admin']));
create policy member_contact_groups on public.contact_groups for select to authenticated using(app_private.is_member(organization_id));
create policy member_settings on public.organization_settings for select to authenticated using(app_private.is_member(organization_id));
create policy member_suppressions on public.number_suppressions for select to authenticated using(app_private.is_member(organization_id));
create policy admin_audit on public.audit_events for select to authenticated using(app_private.is_member(organization_id,array['organization_admin']));
commit;
