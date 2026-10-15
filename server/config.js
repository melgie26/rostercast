export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const origin = env.APP_ORIGIN || 'http://localhost:3000';
  const parsed = new URL(origin);
  if (parsed.origin !== origin || parsed.username || parsed.password) throw new Error('APP_ORIGIN must be an exact origin without path or credentials.');
  if (production && parsed.protocol !== 'https:') throw new Error('Production requires an HTTPS APP_ORIGIN.');
  if (!production && parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('HTTP is only allowed on local development hosts.');
  const key = env.SESSION_KEY_HEX || '';
  const url = env.SUPABASE_URL || '';
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || '';
  const workspaceDomain = (env.GOOGLE_WORKSPACE_DOMAIN || '').toLowerCase();
  const executiveGroup = (env.GOOGLE_EXECUTIVE_GROUP || '').toLowerCase();
  const stewardGroup = (env.GOOGLE_STEWARD_GROUP || '').toLowerCase();
  const googleServiceAccountEmail = (env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').toLowerCase();
  const googleServiceAccountPrivateKey = (env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const googleWorkspaceAdminEmail = (env.GOOGLE_WORKSPACE_ADMIN_EMAIL || '').toLowerCase();
  if (url && (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))) throw new Error('Use an HTTPS hosted Supabase project URL.');
  if (publishableKey && !publishableKey.startsWith('sb_publishable_')) throw new Error('Use the Supabase publishable key, never a secret/service-role key.');
  if (key && !/^[a-f0-9]{64}$/i.test(key)) throw new Error('SESSION_KEY_HEX must contain 32 random bytes encoded as hex.');
  if (workspaceDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(workspaceDomain)) throw new Error('GOOGLE_WORKSPACE_DOMAIN must be a valid domain.');
  for (const [name,value] of [['GOOGLE_EXECUTIVE_GROUP',executiveGroup],['GOOGLE_STEWARD_GROUP',stewardGroup],['GOOGLE_WORKSPACE_ADMIN_EMAIL',googleWorkspaceAdminEmail]]) if (value && !value.endsWith(`@${workspaceDomain}`)) throw new Error(`${name} must belong to GOOGLE_WORKSPACE_DOMAIN.`);
  if (googleServiceAccountEmail && !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(googleServiceAccountEmail)) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL must be a Google service account address.');
  const workspaceReady = Boolean(workspaceDomain && executiveGroup && stewardGroup && googleServiceAccountEmail && googleServiceAccountPrivateKey && googleWorkspaceAdminEmail);
  const ready = Boolean(url && publishableKey && key && workspaceReady);
  if (production && !ready) throw new Error('Backend environment is incomplete.');
  return { origin, production, ready, workspaceReady, key, url, publishableKey, workspaceDomain, executiveGroup, stewardGroup, googleServiceAccountEmail, googleServiceAccountPrivateKey, googleWorkspaceAdminEmail, port: Number(env.PORT || 3000) };
}
