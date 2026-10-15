import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { WorkspaceDirectory } from '../server/workspace-directory.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const config = {
  workspaceDomain: 'airdriefirefighters.com',
  executiveGroup: 'exec@airdriefirefighters.com',
  stewardGroup: 'stewards@airdriefirefighters.com',
  googleServiceAccountEmail: 'rostercast@test-project.iam.gserviceaccount.com',
  googleServiceAccountPrivateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  googleWorkspaceAdminEmail: 'admin@airdriefirefighters.com'
};

function directory(memberships = {}) {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'directory-token', expires_in: 3600 }), { status: 200 });
    const match = /groups\/([^/]+)\/hasMember\/([^/]+)/.exec(String(url));
    const group = decodeURIComponent(match[1]); const email = decodeURIComponent(match[2]);
    return new Response(JSON.stringify({ isMember: memberships[`${group}:${email}`] === true }), { status: 200 });
  };
  return { service: new WorkspaceDirectory(config, fetcher, () => 1_800_000_000_000), calls };
}

test('rejects non-domain and ordinary member accounts', async () => {
  const { service } = directory();
  assert.equal(service.acceptsEmail('person@example.com'), false);
  assert.deepEqual(await service.resolve('member@airdriefirefighters.com'), { authorized: false, role: 'member', email: 'member@airdriefirefighters.com', reason: 'administrative_access_required' });
});

test('executive membership takes precedence over nested steward membership', async () => {
  const email = 'board@airdriefirefighters.com';
  const memberships = {
    [`${config.executiveGroup}:${email}`]: true,
    [`${config.stewardGroup}:${email}`]: true
  };
  const { service, calls } = directory(memberships); const access = await service.resolve(email);
  assert.equal(access.role, 'board_admin'); assert.equal(access.authorized, true);
  assert.equal(calls.filter(call => call.url.includes('oauth2.googleapis.com')).length, 1);
  assert.equal(calls.filter(call => call.url.includes('admin.googleapis.com')).length, 1);
});

test('steward membership grants drafting role and caches the delegated token', async () => {
  const first = 'one@airdriefirefighters.com', second = 'two@airdriefirefighters.com';
  const memberships = { [`${config.stewardGroup}:${first}`]: true, [`${config.stewardGroup}:${second}`]: true };
  const { service, calls } = directory(memberships);
  assert.equal((await service.resolve(first)).role, 'steward'); assert.equal((await service.resolve(second)).role, 'steward');
  assert.equal(calls.filter(call => call.url.includes('oauth2.googleapis.com')).length, 1);
  const tokenRequest = calls.find(call => call.url.includes('oauth2.googleapis.com'));
  const assertion = new URLSearchParams(tokenRequest.options.body).get('assertion');
  const claims = JSON.parse(Buffer.from(assertion.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, config.googleWorkspaceAdminEmail); assert.match(claims.scope, /group\.member\.readonly/);
});

test('fails closed when Directory API is unavailable', async () => {
  const service = new WorkspaceDirectory(config, async () => new Response('{}', { status: 500 }));
  await assert.rejects(service.resolve('board@airdriefirefighters.com'), /temporarily unavailable/);
});
