import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createApp } from '../server/app.js';
import { ApiError } from '../server/supabase-gateway.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const org='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const contacts=[],groups=[];
let revoked=false;
const gateway={
  requestCode:async()=>{},verifyCode:async()=>{revoked=false;return {access_token:'fixture-token',expires_at:Date.now()/1000+1800};},
  user:async()=>{if(revoked)throw new ApiError(401,'Sign in again.');return {id:'fixture-user',email:'demo@example.test'};},logout:async()=>{revoked=true;},
  organizations:async()=>[{organization_id:org,role:'organization_admin',organizations:{id:org,name:'Fictional Local'}}],
  membership:async()=>({role:'organization_admin'}),contacts:async()=>contacts,groups:async()=>groups,
  saveContact:async(token,id,contact,contactId)=>{const record={id:contactId||'cccccccc-cccc-4ccc-8ccc-cccccccccccc',...contact,consent_status:'unknown',status:contact.status||'active'};if(contactId)contacts[0]=record;else contacts.push(record);return record;},
  createGroup:async(token,id,name)=>{const group={id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name,archived:false};groups.push(group);return group;}
};
const account=createApp({ready:true,production:false,origin:'http://localhost:39123',key:'ab'.repeat(32)},gateway);
await new Promise(resolve=>account.listen(39123,'127.0.0.1',resolve));
// Static prototype server for a regression check of existing public routes.
const baseDir=resolve(new URL('../',import.meta.url).pathname);
const demo=createServer(async(req,res)=>{
  const path=resolve(baseDir, '.'+new URL(req.url,'http://localhost').pathname);
  if(path!==baseDir && !path.startsWith(baseDir+sep)){res.writeHead(404);return res.end();}
  try {const file=path===baseDir ? path+'/index.html' : path;const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>demo.listen(39124,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1360,height:950}});const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)console.log('HTTP',response.status(),new URL(response.url()).pathname);});
  await page.goto('http://localhost:39123');
  await page.locator('#request-code [name="email"]').fill('demo@example.test');
  await page.locator('#request-code button').click();
  await page.getByText('If your account is enabled, a sign-in code will arrive by email.',{exact:true}).waitFor();
  await page.locator('#verify-code [name="code"]').fill('123456');
  await page.locator('#verify-code button').click();
  try { await page.getByRole('heading',{name:'Contacts',exact:true}).waitFor(); } catch(error) { console.log('Account state on failure:',await page.locator('body').innerText());console.log('Browser errors:',errors);throw error; }
  console.log('Account sign-in passed.');
  await page.locator('#contact-form [name="first_name"]').fill('Fictional');
  await page.locator('#contact-form [name="last_name"]').fill('Member');
  await page.locator('#contact-form [name="mobile"]').fill('4035550101');
  await page.locator('#contact-form button').click();
  await page.getByRole('cell',{name:'Fictional Member',exact:true}).waitFor();
  assert.equal(contacts[0].mobile,'+14035550101');
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await page.locator('#contact-form [name="status"]').selectOption('inactive');
  await page.locator('#contact-form button[type="submit"], #contact-form button:not([type])').click();
  await page.getByRole('cell',{name:'inactive',exact:true}).waitFor();
  await page.locator('#group-form [name="name"]').fill('Executive Board');
  await page.locator('#group-form button').click();await page.getByText('Executive Board',{exact:true}).waitFor();
  // A second browser session sees the same shared gateway roster.
  const second=await browser.newPage();await second.goto('http://localhost:39123');
  await second.locator('#verify-code [name="email"]').fill('demo@example.test');await second.locator('#verify-code [name="code"]').fill('123456');await second.locator('#verify-code button').click();
  await second.getByRole('cell',{name:'Fictional Member',exact:true}).waitFor();await second.close();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#logout').click();await page.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  assert.equal(await page.evaluate(()=>document.cookie),'');
  assert.deepEqual(errors,[]);
  await page.goto('http://localhost:39124/#/billing');await page.getByRole('heading',{name:'Usage & billing'}).waitFor();
  await page.locator('[name="used"]').fill('600');await page.locator('[name="requested"]').fill('100');await page.locator('[name="overage_enabled"]').check();await page.locator('[name="cap"]').fill('10');
  await page.getByText('Fits the example allowance and overage cap.',{exact:true}).waitFor();
  await page.goto('http://localhost:39124/#/announcements');await page.getByRole('heading',{name:'New Announcement'}).waitFor();
  await page.locator('[name="title"]').fill('Browser smoke test');await page.locator('[name="body"]').fill('Fictional test message.');await page.getByRole('button',{name:'Review Announcement',exact:true}).click();
  await page.getByRole('button',{name:'Confirm simulated send'}).click();await page.getByRole('heading',{name:'Announcement history'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('Browser smoke passed: sign-in, contact create/edit, group create, shared fixture across sessions, mobile layout, sign-out, token storage, billing calculator and simulated announcement. Auth/database gateway mocked; no hosted login or real data.');
} finally {
  if(browser)await browser.close();
  await Promise.all([new Promise(resolve=>account.close(resolve)),new Promise(resolve=>demo.close(resolve))]);
}
