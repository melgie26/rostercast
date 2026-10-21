begin;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 1600),
  selection_snapshot jsonb not null check (
    jsonb_typeof(selection_snapshot)='object'
    and selection_snapshot ? 'allEligible'
    and selection_snapshot ? 'groupIds'
    and selection_snapshot ? 'contactIds'
    and jsonb_typeof(selection_snapshot->'allEligible')='boolean'
    and jsonb_typeof(selection_snapshot->'groupIds')='array'
    and jsonb_typeof(selection_snapshot->'contactIds')='array'
  ),
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or length(rejection_reason) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create index announcements_org_updated on public.announcements(organization_id,updated_at desc);

create table public.announcement_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  announcement_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('created','submitted','approved','rejected')),
  from_status text,
  to_status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id,announcement_id) references public.announcements(organization_id,id)
);
create index announcement_events_announcement on public.announcement_events(organization_id,announcement_id,id);

alter table public.announcements enable row level security;
alter table public.announcement_events enable row level security;
create policy member_announcements on public.announcements for select to authenticated
  using(app_private.is_member(organization_id));
create policy member_announcement_events on public.announcement_events for select to authenticated
  using(app_private.is_member(organization_id));

revoke all on public.announcements,public.announcement_events from public,anon,authenticated;
grant select on public.announcements,public.announcement_events to authenticated;

create function public.create_announcement_draft(org uuid, announcement_title text, announcement_body text, selection jsonb)
returns public.announcements language plpgsql security definer set search_path = '' as $$
declare item public.announcements;
begin
  if not app_private.is_member(org,array['organization_admin','viewer']) then
    raise exception 'Announcement drafting is not permitted' using errcode='42501';
  end if;
  if jsonb_typeof(selection) <> 'object'
      or jsonb_typeof(selection->'allEligible') <> 'boolean'
      or jsonb_typeof(selection->'groupIds') <> 'array'
      or jsonb_typeof(selection->'contactIds') <> 'array'
      or ((selection->>'allEligible')::boolean=false and jsonb_array_length(selection->'groupIds')=0 and jsonb_array_length(selection->'contactIds')=0)
      or exists (
        select 1 from jsonb_array_elements_text(selection->'groupIds') chosen(value)
        where not exists (select 1 from public.groups g where g.organization_id=org and g.id=
          case when chosen.value ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then chosen.value::uuid end)
      )
      or exists (
        select 1 from jsonb_array_elements_text(selection->'contactIds') chosen(value)
        where not exists (select 1 from public.contacts c where c.organization_id=org and c.id=
          case when chosen.value ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then chosen.value::uuid end)
      ) then
    raise exception 'Recipient selection is invalid' using errcode='22023';
  end if;
  insert into public.announcements(organization_id,title,body,selection_snapshot,created_by)
    values(org,announcement_title,announcement_body,selection,auth.uid()) returning * into item;
  insert into public.announcement_events(organization_id,announcement_id,actor_id,action,to_status)
    values(org,item.id,auth.uid(),'created','draft');
  return item;
end;
$$;

create function public.submit_announcement(org uuid, announcement uuid, expected_version integer)
returns public.announcements language plpgsql security definer set search_path = '' as $$
declare item public.announcements;
begin
  if not app_private.is_member(org,array['organization_admin','viewer']) then
    raise exception 'Announcement submission is not permitted' using errcode='42501';
  end if;
  update public.announcements set status='pending_approval',version=version+1,
      submitted_by=auth.uid(),submitted_at=now(),reviewed_by=null,reviewed_at=null,rejection_reason=null,updated_at=now()
    where organization_id=org and id=announcement and version=expected_version
      and status in ('draft','rejected')
      and (created_by=auth.uid() or app_private.is_member(org,array['organization_admin']))
    returning * into item;
  if item.id is null then
    raise exception 'Announcement changed or cannot be submitted' using errcode='40001';
  end if;
  insert into public.announcement_events(organization_id,announcement_id,actor_id,action,from_status,to_status)
    values(org,item.id,auth.uid(),'submitted',case when item.version=2 then 'draft' else 'rejected' end,'pending_approval');
  return item;
end;
$$;

create function public.review_announcement(org uuid, announcement uuid, expected_version integer, decision text, reason text default null)
returns public.announcements language plpgsql security definer set search_path = '' as $$
declare item public.announcements; target text;
begin
  if not app_private.is_member(org,array['organization_admin']) then
    raise exception 'Board review is required' using errcode='42501';
  end if;
  if decision not in ('approved','rejected') or (decision='rejected' and (reason is null or length(trim(reason))=0)) then
    raise exception 'A valid review decision is required' using errcode='22023';
  end if;
  target:=decision;
  update public.announcements set status=target,version=version+1,reviewed_by=auth.uid(),reviewed_at=now(),
      rejection_reason=case when target='rejected' then trim(reason) else null end,updated_at=now()
    where organization_id=org and id=announcement and version=expected_version and status='pending_approval'
    returning * into item;
  if item.id is null then
    raise exception 'Announcement changed or is no longer awaiting review' using errcode='40001';
  end if;
  insert into public.announcement_events(organization_id,announcement_id,actor_id,action,from_status,to_status,details)
    values(org,item.id,auth.uid(),target,'pending_approval',target,
      case when target='rejected' then jsonb_build_object('reason',item.rejection_reason) else '{}'::jsonb end);
  return item;
end;
$$;

revoke all on function public.create_announcement_draft(uuid,text,text,jsonb),
  public.submit_announcement(uuid,uuid,integer),
  public.review_announcement(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.create_announcement_draft(uuid,text,text,jsonb),
  public.submit_announcement(uuid,uuid,integer),
  public.review_announcement(uuid,uuid,integer,text,text) to authenticated;

commit;
