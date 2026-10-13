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
  if (url && (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))) throw new Error('Use an HTTPS hosted Supabase project URL.');
  if (publishableKey && !publishableKey.startsWith('sb_publishable_')) throw new Error('Use the Supabase publishable key, never a secret/service-role key.');
  if (key && !/^[a-f0-9]{64}$/i.test(key)) throw new Error('SESSION_KEY_HEX must contain 32 random bytes encoded as hex.');
  const ready = Boolean(url && publishableKey && key);
  if (production && !ready) throw new Error('Backend environment is incomplete.');
  return { origin, production, ready, key, url, publishableKey, port: Number(env.PORT || 3000) };
}
