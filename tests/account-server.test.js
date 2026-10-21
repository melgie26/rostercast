import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { readConfig } from '../server/config.js';
import { Sessions } from '../server/session.js';
import { ApiError } from '../server/supabase-gateway.js';
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const contactId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const config={ ready:true,production:true,origin:'https://rostercast.example',key:'ab'.repeat(32) };
const session={access_token:'fictional-token',expires_at:Math.floor(Date.now()/1000)+1800};
async function setup(t,overrides={}) {
  const writes=[];
  const gateway={
    requestCode:async()=>{},verifyCode:async()=>session,user:async()=>({id:'demo-user',email:'demo@example.test'}),logout:async()=>{},
    organizations:async()=>[{organization_id:org,role:'organization_admin',organizations:{id:org,name:'Demo'}}],
    membership:async(token,id)=>{if(id!==org)throw new ApiError(403,'No access');return {role:'organization_admin'};},
    contacts:async()=>[],groups:async()=>[],announcements:async()=>[],
    saveContact:async(token,id,contact)=>{writes.push({id,contact});return {id:contactId,...contact};},
    createGroup:async(token,id,name)=>{writes.push({id,name});return {id:contactId,name};},
    createAnnouncement:async(token,id,draft)=>{writes.push({id,draft});return {id:contactId,...draft,status:'draft',version:1};},
    submitAnnouncement:async(token,id,announcement,version)=>{writes.push({id,announcement,version,action:'submit'});return {id:announcement,status:'pending_approval',version:version+1};},
    reviewAnnouncement:async(token,id,announcement,version,decision,reason)=>{writes.push({id,announcement,version,decision,reason});return {id:announcement,status:decision,version:version+1};},...overrides
  };
  const server=createApp(config,gateway);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const cookie=new Sessions(config).cookie(session).split(';')[0];
  const request=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{cookie,origin:config.origin,...(body!==undefined ? {'content-type':'application/json'} : {}),...headers},...(body!==undefined ? {body:typeof body==='string' ? body : JSON.stringify(body)} : {})});
  return {request,writes,cookie,base};
}
test('session cookies resist tampering, expire, and are bound to app origin',()=>{
  let now=1000000;const codec=new Sessions(config,()=>now), s={access_token:'token',expires_at:1100};
  const cookie=codec.cookie(s); assert.match(cookie,/^__Host-rostercast=/);assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.match(cookie,/Secure/);
  assert.ok(!cookie.includes('token'));assert.deepEqual(codec.read(cookie),s);
  assert.equal(codec.read(cookie.replace('rostercast=','rostercast=X')),null);
  assert.equal(new Sessions({...config,origin:'https://other.example'},()=>now).read(cookie),null);
  now=1100000;assert.equal(codec.read(cookie),null);assert.match(codec.cookie(null),/Max-Age=0/);
});
test('configuration rejects unsafe origin, service keys and incomplete production config',()=>{
  assert.throws(()=>readConfig({NODE_ENV:'production'}),/HTTPS/);
  assert.throws(()=>readConfig({NODE_ENV:'production',APP_ORIGIN:'https://safe.example'}),/incomplete/);
  assert.throws(()=>readConfig({SUPABASE_PUBLISHABLE_KEY:'sb_secret_never'}),/publishable/);
  assert.throws(()=>readConfig({APP_ORIGIN:'https://safe.example/path'}),/exact origin/);
  assert.throws(()=>readConfig({SESSION_KEY_HEX:'bad'}),/32 random/);
  assert.equal(readConfig({}).ready,false);
});
test('account login creates cookie without returning tokens; logout clears it',async t=>{
  const {request}=await setup(t);
  const res=await request('/api/auth/verify','POST',{email:'demo@example.test',code:'123456'});
  assert.equal(res.status,200);assert.match(res.headers.get('set-cookie'),/HttpOnly/);
  assert.deepEqual(await res.json(),{signed_in:true});
  const logout=await request('/api/auth/logout','POST',{});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
test('missing session and CSRF requests fail without touching roster',async t=>{
  const {request,writes}=await setup(t);
  assert.equal((await request('/api/me','GET',undefined,{cookie:''})).status,401);
  const body={first_name:'Demo',last_name:'Member',mobile:'4035550101'};
  assert.equal((await request(`/api/organizations/${org}/contacts`,'POST',body,{origin:'https://attacker.test'})).status,403);
  assert.equal((await request('/api/auth/code','POST',{email:'demo@example.test'},{origin:''})).status,403);
  assert.equal((await request('/api/me','GET',undefined,{'sec-fetch-site':'cross-site'})).status,403);
  assert.equal(writes.length,0);
});
test('API scopes organization, validates contact input and denies consent/role forgery',async t=>{
  const {request,writes}=await setup(t); const body={first_name:'Demo',last_name:'Member',mobile:'4035550101'};
  assert.equal((await request(`/api/organizations/${foreign}/contacts`)).status,403);
  assert.equal((await request(`/api/organizations/${org}/contacts`,'POST',{...body,consent_status:'subscribed'})).status,400);
  assert.equal((await request(`/api/organizations/${org}/contacts`,'POST',{...body,organization_id:foreign})).status,400);
  assert.equal((await request(`/api/organizations/${org}/contacts`,'POST',{...body,mobile:'bad'})).status,400);
  assert.equal((await request(`/api/organizations/${org}/contacts?page=-1`)).status,400);
  const saved=await request(`/api/organizations/${org}/contacts`,'POST',body);assert.equal(saved.status,201);
  assert.deepEqual(writes,[{id:org,contact:{first_name:'Demo',last_name:'Member',mobile:'+14035550101'}}]);
  assert.equal((await request(`/api/organizations/${org}/contacts/${contactId}`,'PATCH',{...body,status:'inactive'})).status,200);
});
test('viewer cannot write, oversized and malformed requests fail closed',async t=>{
  const {request,writes}=await setup(t,{membership:async()=>({role:'viewer'})});
  assert.equal((await request(`/api/organizations/${org}/contacts`,'POST',{first_name:'Demo'})).status,403);
  assert.equal(writes.length,0);
  assert.equal((await request('/api/auth/code','POST','{')).status,400);
  assert.equal((await request('/api/auth/code','POST',{email:'demo@example.test'},{'content-type':'text/plain'})).status,415);
  assert.equal((await request('/api/auth/code','POST',{email:'x'.repeat(9000)})).status,413);
});
test('announcement API validates selections and supports the approval workflow',async t=>{
  const {request,writes}=await setup(t); const path=`/api/organizations/${org}/announcements`;
  assert.equal((await request(path,'POST',{title:'Notice',body:'Fictional message.',selection:{allEligible:false,groupIds:[],contactIds:[]}})).status,400);
  const created=await request(path,'POST',{title:'Notice',body:'Fictional message.',selection:{allEligible:true,groupIds:[],contactIds:[]}});
  assert.equal(created.status,201);
  assert.equal((await request(`${path}/${contactId}/submit`,'POST',{version:1})).status,200);
  assert.equal((await request(`${path}/${contactId}/review`,'POST',{version:2,decision:'approved'})).status,200);
  assert.equal(writes.length,3);
  assert.equal(writes[0].draft.selection.allEligible,true); assert.equal(writes[2].decision,'approved');
});
test('OTP endpoint has a bounded request rate and does not enumerate accounts',async t=>{
  const {request}=await setup(t);
  for(let i=0;i<6;i++) {const res=await request('/api/auth/code','POST',{email:'demo@example.test'});assert.equal(res.status,200);assert.match((await res.json()).message,/If your account/);}
  assert.equal((await request('/api/auth/code','POST',{email:'demo@example.test'})).status,429);
});
test('static hosting exposes only the account assets, never source or secrets',async t=>{
  const {request}=await setup(t);
  assert.equal((await request('/')).status,200);assert.equal((await request('/account/app.js')).status,200);
  for(const path of ['/.env','/server/config.js','/package-lock.json','/supabase/migrations/202610130001_accounts.sql','/js/app.js'])assert.equal((await request(path)).status,404);
  const res=await request('/api/me');assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.headers.get('x-frame-options'),'DENY');assert.match(res.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('unconfigured backend advertises setup status and rejects auth API',async t=>{
  const server=createApp({...config,ready:false},null);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(base+'/api/config')).json(),{accounts_ready:false});
  assert.equal((await fetch(base+'/api/auth/code',{method:'POST'})).status,503);
});
