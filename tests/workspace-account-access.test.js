import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const config = { ready: true, production: true, origin: 'https://rostercast.example', key: 'ab'.repeat(32) };
const baseSession = { access_token: 'fictional-token', expires_at: Math.floor(Date.now()/1000)+1800 };

async function setup(t, role) {
  const calls = { codes: 0, logout: 0, writes: 0, drafts: 0, reviews: 0 };
  const gateway = {
    requestCode: async () => { calls.codes += 1; }, verifyCode: async () => ({ ...baseSession }),
    user: async () => ({ id: 'user', email: 'person@airdriefirefighters.com' }),
    logout: async () => { calls.logout += 1; }, organizations: async () => [],
    membership: async () => ({ role: 'organization_admin' }), contacts: async () => [], groups: async () => [], announcements: async () => [],
    saveContact: async () => { calls.writes += 1; return { id: 'contact' }; }, createGroup: async () => ({ id: 'group' }),
    createAnnouncement: async () => { calls.drafts += 1; return { id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',status:'draft',version:1 }; },
    submitAnnouncement: async () => ({status:'pending_approval',version:2}),
    reviewAnnouncement: async () => { calls.reviews += 1; return {status:'approved',version:3}; }
  };
  const directory = { acceptsEmail: email => email.endsWith('@airdriefirefighters.com'), resolve: async email => ({ authorized: role !== 'member', role, email }) };
  const server = createApp(config, gateway, directory); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(base+path, { method:'POST', headers:{ origin:config.origin, cookie, 'content-type':'application/json' }, body:JSON.stringify(body) });
  return { calls, post, base };
}

test('does not send sign-in codes outside the Workspace domain', async t => {
  const { calls, post } = await setup(t, 'board_admin');
  const response = await post('/api/auth/code', { email:'person@example.com' });
  assert.equal(response.status, 200); assert.equal(calls.codes, 0);
});

test('ordinary Workspace members are denied a session', async t => {
  const { calls, post } = await setup(t, 'member');
  const response = await post('/api/auth/verify', { email:'person@airdriefirefighters.com', code:'123456' });
  assert.equal(response.status, 403); assert.equal(calls.logout, 1); assert.equal(response.headers.get('set-cookie'), null);
});

test('stewards can sign in and read but cannot modify the roster', async t => {
  const { post, base, calls } = await setup(t, 'steward');
  const login = await post('/api/auth/verify', { email:'person@airdriefirefighters.com', code:'123456' }); const cookie = login.headers.get('set-cookie').split(';')[0];
  const me = await fetch(base+'/api/me', { headers:{ cookie } }); assert.equal((await me.json()).user.workspace_role, 'steward');
  const write = await post(`/api/organizations/${org}/contacts`, { first_name:'Demo', last_name:'Person', mobile:'4035550101' }, cookie);
  assert.equal(write.status, 403); assert.equal(calls.writes, 0);
});

test('Executive Board accounts can perform administrator writes', async t => {
  const { post, calls } = await setup(t, 'board_admin');
  const login = await post('/api/auth/verify', { email:'person@airdriefirefighters.com', code:'123456' }); const cookie = login.headers.get('set-cookie').split(';')[0];
  const write = await post(`/api/organizations/${org}/contacts`, { first_name:'Demo', last_name:'Person', mobile:'4035550101' }, cookie);
  assert.equal(write.status, 201); assert.equal(calls.writes, 1);
});
test('stewards can draft and submit but cannot approve announcements', async t => {
  const { post, calls } = await setup(t, 'steward');
  const login = await post('/api/auth/verify', { email:'person@airdriefirefighters.com', code:'123456' }); const cookie = login.headers.get('set-cookie').split(';')[0];
  const path=`/api/organizations/${org}/announcements`, id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const draft=await post(path,{title:'Notice',body:'Fictional message.',selection:{allEligible:true,groupIds:[],contactIds:[]}},cookie);
  assert.equal(draft.status,201); assert.equal(calls.drafts,1);
  assert.equal((await post(`${path}/${id}/submit`,{version:1},cookie)).status,200);
  assert.equal((await post(`${path}/${id}/review`,{version:2,decision:'approved'},cookie)).status,403);
  assert.equal(calls.reviews,0);
});

test('Executive Board accounts can approve submitted announcements', async t => {
  const { post, calls } = await setup(t, 'board_admin');
  const login = await post('/api/auth/verify', { email:'person@airdriefirefighters.com', code:'123456' }); const cookie = login.headers.get('set-cookie').split(';')[0];
  const response=await post(`/api/organizations/${org}/announcements/cccccccc-cccc-4ccc-8ccc-cccccccccccc/review`,{version:2,decision:'approved'},cookie);
  assert.equal(response.status,200); assert.equal(calls.reviews,1);
});
