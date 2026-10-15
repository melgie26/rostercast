import { createSign } from 'node:crypto';
import { ApiError } from './supabase-gateway.js';

const scope = 'https://www.googleapis.com/auth/admin.directory.group.member.readonly';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const base64url = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

export class WorkspaceDirectory {
  constructor(config, fetcher = globalThis.fetch, now = () => Date.now()) {
    this.domain = config.workspaceDomain;
    this.executiveGroup = config.executiveGroup;
    this.stewardGroup = config.stewardGroup;
    this.serviceAccountEmail = config.googleServiceAccountEmail;
    this.privateKey = config.googleServiceAccountPrivateKey;
    this.adminEmail = config.googleWorkspaceAdminEmail;
    this.fetcher = fetcher;
    this.now = now;
    this.cachedToken = null;
  }
  acceptsEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    return normalized.endsWith(`@${this.domain}`) && normalized.split('@').length === 2;
  }
  async resolve(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!this.acceptsEmail(normalized)) return { authorized: false, role: null, reason: 'workspace_domain_required' };
    if (await this.hasMember(this.executiveGroup, normalized)) return { authorized: true, role: 'board_admin', email: normalized };
    if (await this.hasMember(this.stewardGroup, normalized)) return { authorized: true, role: 'steward', email: normalized };
    return { authorized: false, role: 'member', email: normalized, reason: 'administrative_access_required' };
  }
  async hasMember(group, email) {
    const token = await this.accessToken();
    const url = `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(group)}/hasMember/${encodeURIComponent(email)}`;
    let response;
    try { response = await this.fetcher(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }); }
    catch { throw new ApiError(503, 'Workspace access verification is temporarily unavailable.'); }
    if (!response.ok) throw new ApiError(503, 'Workspace access verification is temporarily unavailable.');
    const body = await response.json();
    return body.isMember === true;
  }
  async accessToken() {
    const nowSeconds = Math.floor(this.now() / 1000);
    if (this.cachedToken?.expiresAt > nowSeconds + 60) return this.cachedToken.value;
    const header = base64url({ alg: 'RS256', typ: 'JWT' });
    const claims = base64url({ iss: this.serviceAccountEmail, sub: this.adminEmail, scope, aud: tokenEndpoint, iat: nowSeconds, exp: nowSeconds + 3600 });
    const signer = createSign('RSA-SHA256'); signer.update(`${header}.${claims}`); signer.end();
    const assertion = `${header}.${claims}.${signer.sign(this.privateKey, 'base64url')}`;
    let response;
    try { response = await this.fetcher(tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(10000) }); }
    catch { throw new ApiError(503, 'Workspace access verification is temporarily unavailable.'); }
    if (!response.ok) throw new ApiError(503, 'Workspace access verification is temporarily unavailable.');
    const body = await response.json();
    if (typeof body.access_token !== 'string' || !Number.isFinite(body.expires_in)) throw new ApiError(503, 'Workspace access verification is temporarily unavailable.');
    this.cachedToken = { value: body.access_token, expiresAt: nowSeconds + Math.min(body.expires_in, 3600) };
    return this.cachedToken.value;
  }
}
