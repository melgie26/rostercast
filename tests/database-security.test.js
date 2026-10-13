import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const orgA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', orgB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const admin='11111111-1111-4111-8111-111111111111', viewer='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333';
const sessions={ [admin]:'44444444-4444-4444-8444-444444444444',[viewer]:'55555555-5555-4555-8555-555555555555',[outsider]:'66666666-6666-4666-8666-666666666666' };
const cA='77777777-7777-4777-8777-777777777777', cB='88888888-8888-4888-8888-888888888888';
async function setup() {
  const db=new PGlite();
  // Supabase owns auth schema. The local harness supplies its documented claims
  // and session contract; application schema/policies run unchanged in PostgreSQL.
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); create table auth.sessions(id uuid primary key,user_id uuid references auth.users);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid(),auth.jwt() to authenticated,anon;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610130001_accounts.sql',import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${admin}'),('${viewer}'),('${outsider}');
    insert into auth.sessions values('${sessions[admin]}','${admin}'),('${sessions[viewer]}','${viewer}'),('${sessions[outsider]}','${outsider}');
    insert into public.organizations(id,name,short_name) values('${orgA}','Local A','A'),('${orgB}','Local B','B');
    insert into public.organization_users values('${orgA}','${admin}','organization_admin',true),('${orgA}','${viewer}','viewer',true);
    insert into public.contacts(id,organization_id,first_name,last_name,mobile,consent_status) values
      ('${cA}','${orgA}','Fictional','A','+14035550101','subscribed'),('${cB}','${orgB}','Fictional','B','+14035550102','unknown');`);
  return db;
}
async function asUser(db,user,session=sessions[user]) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:session, user_metadata:{role:'organization_admin'}})]);
  await db.exec('set role authenticated');
}
test('PostgreSQL enforces tenant separation, roles and write boundaries', async()=>{
  const db=await setup();
  try {
    await asUser(db,admin);
    assert.equal((await db.query('select * from public.contacts')).rows.length,1);
    assert.equal((await db.query('select * from public.organizations')).rows.length,1);
    await assert.rejects(db.query(`insert into public.contacts(organization_id,first_name,last_name,mobile) values('${orgB}','No','Access','+14035550103')`),/row-level security/);
    assert.equal((await db.query(`update public.contacts set first_name='Hidden' where id='${cB}' returning id`)).rows.length,0);
    await assert.rejects(db.query(`update public.organization_users set role='organization_admin' where user_id='${viewer}'`),/permission denied/);
    await assert.rejects(db.query(`insert into public.organizations(name,short_name) values('Forged','X')`),/permission denied/);
    await assert.rejects(db.query(`update public.contacts set organization_id='${orgB}' where id='${cA}'`),/permission denied/);
    await assert.rejects(db.query(`insert into public.contacts(organization_id,first_name,last_name,mobile,consent_status) values('${orgA}','Forged','Consent','+14035550103','subscribed')`),/permission denied/);
    await assert.rejects(db.query('delete from public.contacts'),/permission denied/);
    await assert.rejects(db.query(`insert into public.audit_events(organization_id,entity,entity_id,action) values('${orgA}','fake','x','INSERT')`),/permission denied/);
    await asUser(db,viewer);
    assert.equal((await db.query('select * from public.contacts')).rows.length,1);
    assert.equal((await db.query(`update public.contacts set first_name='Forged' returning id`)).rows.length,0);
    await assert.rejects(db.query(`insert into public.contacts(organization_id,first_name,last_name,mobile) values('${orgA}','No','Write','+14035550103')`),/row-level security/);
    await assert.rejects(db.query(`insert into public.groups(organization_id,name) values('${orgA}','Forged')`),/row-level security/);
    assert.equal((await db.query('select * from public.audit_events')).rows.length,0);
    await asUser(db,outsider);
    assert.equal((await db.query('select * from public.contacts')).rows.length,0);
    assert.equal((await db.query('select * from public.organization_users')).rows.length,0);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.contacts'),/permission denied/);
  } finally {await db.close();}
});
test('approved writes are audited and consent changes cannot bypass policy', async()=>{
  const db=await setup();
  try {
    await asUser(db,admin);
    const added=(await db.query(`insert into public.contacts(organization_id,first_name,last_name,mobile) values('${orgA}','Demo','New','+14035550103') returning *`)).rows[0];
    assert.equal(added.consent_status,'unknown');
    await db.query(`update public.contacts set mobile='+14035550104' where id='${cA}'`);
    assert.equal((await db.query(`select consent_status from public.contacts where id='${cA}'`)).rows[0].consent_status,'unknown');
    const logs=(await db.query(`select * from public.audit_events where actor_id='${admin}'`)).rows;
    assert.equal(logs.length,2); assert.ok(logs[1].changed_fields.includes('mobile'));
    assert.ok(!JSON.stringify(logs).includes('+1403555'));
    await db.exec('reset role');
    await db.query(`update public.contacts set consent_status='unsubscribed' where id='${cA}'`);
    assert.equal((await db.query(`select * from public.number_suppressions where organization_id='${orgA}'`)).rows.length,1);
    await assert.rejects(db.query(`update public.contacts set consent_status='subscribed' where id='${cA}'`),/Re-consent/);
    await assert.rejects(db.query(`update public.contacts set consent_status='subscribed' where id='${added.id}'`),/Consent evidence/);
    // Composite foreign keys reject a group assignment crossing organisations.
    const group=(await db.query(`insert into public.groups(organization_id,name) values('${orgB}','B group') returning id`)).rows[0];
    await assert.rejects(db.query(`insert into public.contact_groups values('${orgA}','${cA}','${group.id}')`),/foreign key/);
  } finally {await db.close();}
});
test('revoked membership, paused organisation or removed auth session loses access immediately', async()=>{
  const db=await setup();
  try {
    await db.query(`delete from auth.sessions where user_id='${admin}'`);
    await asUser(db,admin);
    assert.equal((await db.query('select * from public.contacts')).rows.length,0);
    await db.exec('reset role');
    await db.query(`update public.organization_users set active=false where user_id='${viewer}'`);
    await asUser(db,viewer); assert.equal((await db.query('select * from public.contacts')).rows.length,0);
    await db.exec('reset role');
    await db.query(`update public.organization_users set active=true where user_id='${viewer}'`);
    await db.query(`update public.organizations set status='paused' where id='${orgA}'`);
    await asUser(db,viewer); assert.equal((await db.query('select * from public.contacts')).rows.length,0);
  } finally {await db.close();}
});
