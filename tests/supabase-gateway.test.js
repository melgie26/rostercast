import test from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseGateway } from '../server/supabase-gateway.js';
const config={url:'https://fictional-test.supabase.co',publishableKey:'sb_publishable_fictional'};
test('pinned provider SDK requests invite-only OTP, verifies codes and forwards user token',async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async (url,options={})=>{
    calls.push({url:String(url),options});
    const path=new URL(url).pathname;
    let data={};
    if(path==='/auth/v1/verify') data={access_token:'fictional-access',refresh_token:'fictional-refresh',token_type:'bearer',expires_in:3600,user:{id:'fictional-user',email:'demo@example.test'}};
    if(path==='/auth/v1/user') data={id:'fictional-user',email:'demo@example.test'};
    if(path.includes('/rest/v1/')) data=[];
    return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
  });
  const gateway=new SupabaseGateway(config);
  await gateway.requestCode('demo@example.test');
  assert.equal(JSON.parse(calls[0].options.body).create_user,false);
  const session=await gateway.verifyCode('demo@example.test','123456');
  assert.equal(session.access_token,'fictional-access');assert.equal(session.refresh_token,undefined);
  assert.equal(JSON.parse(calls[1].options.body).type,'email');
  await gateway.user(session.access_token);
  const authHeaders=new Headers(calls.find(c=>c.url.endsWith('/user')).options.headers);
  assert.equal(authHeaders.get('authorization'),'Bearer fictional-access');
  await gateway.contacts(session.access_token,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2);
  const database=calls.find(c=>c.url.includes('/rest/v1/contacts'));
  assert.equal(new Headers(database.options.headers).get('authorization'),'Bearer fictional-access');
  const query=new URL(database.url).searchParams;
  assert.equal(query.get('organization_id'),'eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(query.get('offset'),'200');assert.equal(query.get('limit'),'100');
  await gateway.logout(session.access_token);
  assert.ok(calls.some(c=>c.url.endsWith('/logout?scope=local')));
});
test('provider does not reveal account existence or upstream sensitive errors',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({message:'account missing; internal data'}),{status:400,headers:{'content-type':'application/json'}}));
  const gateway=new SupabaseGateway(config);
  await gateway.requestCode('absent@example.test');
  await assert.rejects(gateway.verifyCode('absent@example.test','123456'),/invalid or expired/);
});
