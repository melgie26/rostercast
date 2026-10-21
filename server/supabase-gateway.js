import { createClient } from '@supabase/supabase-js';
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export class SupabaseGateway {
  constructor(config) { this.config = config; }
  client(token) {
    return createClient(this.config.url, this.config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        fetch: (url, options = {}) => fetch(url, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) })
      }
    });
  }
  async requestCode(email) {
    const { error } = await this.client().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    // Do not distinguish absent accounts from invited accounts.
    if (error && (error.status === 429 || error.status >= 500)) throw new ApiError(error.status === 429 ? 429 : 503, 'Sign-in is temporarily unavailable. Please try again later.');
  }
  async verifyCode(email, token) {
    const { data, error } = await this.client().auth.verifyOtp({ email, token, type: 'email' });
    if (error || !data.session) throw new ApiError(401, 'The sign-in code is invalid or expired.');
    return { access_token: data.session.access_token, expires_at: Math.min(data.session.expires_at, Math.floor(Date.now()/1000)+3600) };
  }
  async user(token) {
    const { data, error } = await this.client().auth.getUser(token);
    if (error || !data.user) throw new ApiError(401, 'Sign in again to continue.');
    return { id: data.user.id, email: data.user.email };
  }
  async logout(token) {
    const { error } = await this.client().auth.admin.signOut(token, 'local');
    if (error && ![401,403,404].includes(error.status)) throw new ApiError(503, 'The provider could not confirm sign-out.');
  }
  result({ data, error }) {
    if (error) {
      if (error.code === '23505') throw new ApiError(409, 'That phone number or group already exists in this organisation.');
      if (error.code === '42501') throw new ApiError(403, 'Your account cannot perform this action.');
      if (error.code === '40001') throw new ApiError(409, 'This announcement changed. Refresh it and try again.');
      if (error.code === '22023' || error.code === '23514') throw new ApiError(400, 'The announcement request is invalid.');
      throw new ApiError(503, 'The account database is temporarily unavailable.');
    }
    return data;
  }
  async organizations(token) {
    return this.result(await this.client(token).from('organization_users').select('organization_id,role,organizations(id,name,short_name)').eq('active',true).order('organization_id'));
  }
  async membership(token, organizationId) {
    const data = this.result(await this.client(token).from('organization_users').select('role').eq('organization_id',organizationId).eq('active',true).maybeSingle());
    if (!data) throw new ApiError(403, 'You do not have access to this organisation.');
    return data;
  }
  async contacts(token, organizationId, page) {
    return this.result(await this.client(token).from('contacts').select('id,first_name,last_name,mobile,status,consent_status,updated_at').eq('organization_id',organizationId).order('last_name').order('id').range(page*100,page*100+99));
  }
  async saveContact(token, organizationId, contact, id) {
    const client = this.client(token); const query = id
      ? client.from('contacts').update(contact).eq('organization_id',organizationId).eq('id',id)
      : client.from('contacts').insert({ ...contact, organization_id: organizationId });
    const data = this.result(await query.select('id,first_name,last_name,mobile,status,consent_status,updated_at').maybeSingle());
    if (!data) throw new ApiError(404, 'Contact not found in this organisation.');
    return data;
  }
  async groups(token, organizationId) {
    return this.result(await this.client(token).from('groups').select('id,name,archived').eq('organization_id',organizationId).order('name').limit(100));
  }
  async createGroup(token, organizationId, name) {
    return this.result(await this.client(token).from('groups').insert({ organization_id: organizationId, name }).select('id,name,archived').single());
  }
  async announcements(token, organizationId) {
    return this.result(await this.client(token).from('announcements').select('id,title,body,selection_snapshot,status,version,created_by,submitted_at,reviewed_at,rejection_reason,created_at,updated_at').eq('organization_id',organizationId).order('updated_at',{ascending:false}).limit(100));
  }
  async createAnnouncement(token, organizationId, draft) {
    return this.result(await this.client(token).rpc('create_announcement_draft',{org:organizationId,announcement_title:draft.title,announcement_body:draft.body,selection:draft.selection}));
  }
  async submitAnnouncement(token, organizationId, id, version) {
    return this.result(await this.client(token).rpc('submit_announcement',{org:organizationId,announcement:id,expected_version:version}));
  }
  async reviewAnnouncement(token, organizationId, id, version, decision, reason) {
    return this.result(await this.client(token).rpc('review_announcement',{org:organizationId,announcement:id,expected_version:version,decision,reason:reason || null}));
  }
}
