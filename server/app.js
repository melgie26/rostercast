import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Sessions } from './session.js';
import { ApiError } from './supabase-gateway.js';
import { normalizeCanadianMobile } from '../js/utils/csv.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const root = fileURLToPath(new URL('../', import.meta.url));
const staticFiles = new Map([
  ['/', ['web/account/index.html','text/html; charset=utf-8']],
  ['/account/app.js', ['web/account/app.js','text/javascript; charset=utf-8']],
  ['/js/utils/html.js', ['js/utils/html.js','text/javascript; charset=utf-8']],
  ...['tokens','base','layout','components','account'].map(name => [`/css/${name}.css`, [`css/${name}.css`,'text/css; charset=utf-8']])
]);
function response(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body));
}
async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'Use a JSON request.');
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > 8192) throw new ApiError(413,'Request is too large.'); chunks.push(chunk); }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); return body;
  } catch { throw new ApiError(400,'Invalid JSON request.'); }
}
function text(value, max, name) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ApiError(400,`Enter a valid ${name}.`);
  return value.trim();
}
function email(value) {
  const result = text(value,254,'email address').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new ApiError(400,'Enter a valid email address.'); return result;
}
function contactInput(body, editing) {
  const keys = editing ? ['first_name','last_name','mobile','status'] : ['first_name','last_name','mobile'];
  if (Object.keys(body).some(k=>!keys.includes(k))) throw new ApiError(400,'Unexpected contact field.');
  const mobile = normalizeCanadianMobile(body.mobile);
  if (!mobile) throw new ApiError(400,'Enter a valid Canadian or US mobile number.');
  const contact = { first_name: text(body.first_name,80,'first name'), last_name: text(body.last_name,80,'last name'), mobile };
  if (editing) { if (!['active','inactive'].includes(body.status)) throw new ApiError(400,'Invalid contact status.'); contact.status = body.status; }
  return contact;
}
export function createApp(config, gateway) {
  const sessions = config.ready ? new Sessions(config) : null;
  const limits = new Map();
  function limit(req, category, maximum) {
    // Single-instance defence, additional shared limits required at hosting ingress.
    const now = Date.now(), key = `${req.socket.remoteAddress}:${category}`;
    if (limits.size > 10000) for (const [k,v] of limits) if (v.until <= now) limits.delete(k);
    if (limits.size > 10000 && !limits.has(key)) throw new ApiError(429,'Please try again later.');
    let entry = limits.get(key); if (!entry || entry.until <= now) { entry = { count: 0, until: now+60000 }; limits.set(key,entry); }
    if (++entry.count > maximum) throw new ApiError(429,'Too many requests. Please wait a minute.');
  }
  return createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (config.production) res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const url = new URL(req.url, config.origin); const path = url.pathname;
      if (req.method==='GET' && path==='/health') return response(res,200,{ status: 'ok', accounts_ready: config.ready });
      if (req.method==='GET' && staticFiles.has(path)) {
        const [file,type] = staticFiles.get(path); res.writeHead(200,{'Content-Type':type}); return res.end(await readFile(root+file));
      }
      if (req.method==='GET' && path==='/api/config') return response(res,200,{ accounts_ready: config.ready });
      if (!path.startsWith('/api/')) throw new ApiError(404,'Not found.');
      if (!config.ready) throw new ApiError(503,'Account hosting has not been configured.');
      limit(req,'api',120);
      if (!['GET','POST','PATCH'].includes(req.method)) throw new ApiError(405,'Method not allowed.');
      if (req.method!=='GET' && req.headers.origin!==config.origin) throw new ApiError(403,'Request origin rejected.');
      if (req.headers['sec-fetch-site']==='cross-site') throw new ApiError(403,'Cross-site request rejected.');
      if (req.method==='POST' && path==='/api/auth/code') {
        limit(req,'auth',6); const body=await readJson(req); await gateway.requestCode(email(body.email));
        return response(res,200,{ message: 'If your account is enabled, a sign-in code will arrive by email.' });
      }
      if (req.method==='POST' && path==='/api/auth/verify') {
        limit(req,'auth',6); const body=await readJson(req); const address=email(body.email);
        if (typeof body.code!=='string' || !/^\d{6,8}$/.test(body.code)) throw new ApiError(400,'Enter the emailed sign-in code.');
        const session=await gateway.verifyCode(address,body.code);
        res.setHeader('Set-Cookie',sessions.cookie(session)); return response(res,200,{ signed_in: true });
      }
      const session=sessions.read(req.headers.cookie);
      if (req.method==='POST' && path==='/api/auth/logout') {
        res.setHeader('Set-Cookie',sessions.cookie(null));
        if (session) await gateway.logout(session.access_token);
        return response(res,200,{ signed_out:true });
      }
      if (!session) { res.setHeader('Set-Cookie',sessions.cookie(null)); throw new ApiError(401,'Sign in to continue.'); }
      const token=session.access_token; const user=await gateway.user(token);
      if (req.method==='GET' && path==='/api/me') return response(res,200,{ user });
      if (req.method==='GET' && path==='/api/organizations') return response(res,200,{ organizations: await gateway.organizations(token) });
      const match=/^\/api\/organizations\/([^/]+)\/(contacts|groups)(?:\/([^/]+))?$/.exec(path);
      if (!match || !uuid.test(match[1]) || (match[3] && !uuid.test(match[3]))) throw new ApiError(404,'Not found.');
      const [,organizationId,entity,id]=match; const membership=await gateway.membership(token,organizationId);
      if (req.method==='GET' && !id) {
        if (entity==='contacts') {
          const page=Number(url.searchParams.get('page') || '0');
          if (!Number.isSafeInteger(page) || page<0 || page>10000) throw new ApiError(400,'Invalid page.');
          return response(res,200,{ contacts: await gateway.contacts(token,organizationId,page), page });
        }
        return response(res,200,{ groups: await gateway.groups(token,organizationId) });
      }
      if (membership.role!=='organization_admin') throw new ApiError(403,'An organisation administrator is required.');
      if (entity==='contacts' && ((req.method==='POST' && !id) || (req.method==='PATCH' && id))) {
        return response(res,id ? 200 : 201,{ contact: await gateway.saveContact(token,organizationId,contactInput(await readJson(req),Boolean(id)),id) });
      }
      if (entity==='groups' && req.method==='POST' && !id) {
        const body=await readJson(req);
        if (Object.keys(body).some(k=>k!=='name')) throw new ApiError(400,'Unexpected group field.');
        return response(res,201,{ group: await gateway.createGroup(token,organizationId,text(body.name,100,'group name')) });
      }
      throw new ApiError(405,'Method not allowed.');
    } catch (error) {
      // Never log cookies, codes, request bodies, JWTs or upstream responses.
      if (!res.headersSent) response(res,error instanceof ApiError ? error.status : 503,{ error: error instanceof ApiError ? error.message : 'The account service is temporarily unavailable.' });
      else res.end();
    }
  });
}
