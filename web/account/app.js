import { escapeHtml as e } from '../../js/utils/html.js';
const root=document.querySelector('#account');
const state={ user:null, organizations:[], organizationId:null, contacts:[], groups:[], announcements:[], page:0, editing:null, busy:false, error:'', notice:'' };
let loadVersion=0;
async function api(path,method='GET',body) {
  const res=await fetch(`/api${path}`,{ method,credentials:'same-origin', headers:body ? { 'Content-Type':'application/json' } : {}, ...(body ? { body:JSON.stringify(body) } : {}) });
  const data=await res.json();
  if (!res.ok) { if(res.status===401) { state.user=null; state.contacts=[]; state.groups=[]; state.announcements=[]; render(); } throw new Error(data.error || 'The account service could not complete the request.'); }
  return data;
}
const current=()=>state.organizations.find(o=>o.organization_id===state.organizationId);
function render() {
  const membership=current(), admin=membership?.role==='organization_admin' && state.user?.workspace_role==='board_admin';
  root.innerHTML=`<header class="account-header"><div><strong class="account-brand">RosterCast</strong><p class="muted">Airdrie Workspace account</p></div>${state.user ? `<div><span>${e(state.user.email)} · ${e((state.user.workspace_role || 'member').replaceAll('_',' '))}</span><button id="logout" class="button button-secondary">Sign out</button></div>` : ''}</header>${state.error ? `<p class="form-error" role="alert">${e(state.error)}</p>` : ''}${state.notice ? `<p class="live-summary" role="status">${e(state.notice)}</p>` : ''}
  ${!state.user ? `<section class="card login-card"><h1>Sign in with your Airdrie Workspace account</h1><p>Use your <strong>@airdriefirefighters.com</strong> email address. Access is limited to the Executive Board and Stewards groups.</p><form id="request-code"><label>Workspace email<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@airdriefirefighters.com"></label><button class="button">Email sign-in code</button></form><form id="verify-code"><label>Workspace email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Sign-in code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" required maxlength="8"></label><button class="button">Sign in</button></form><p class="muted small-note">Your Workspace group membership is verified securely after sign-in. Sessions last up to one hour; sign out when using a shared computer.</p></section>` : `<p class="prototype-notice">Shared roster and approval records use the protected account service. No real SMS is sent from this build.</p>${!state.organizations.length ? '<section class="card"><h1>No organisation access yet</h1><p>Ask the platform owner to enable your organisation membership.</p></section>' : `<div class="account-toolbar"><label>Organisation<select id="organization">${state.organizations.map(o=>`<option value="${e(o.organization_id)}" ${o.organization_id===state.organizationId ? 'selected' : ''}>${e(o.organizations?.name)}</option>`).join('')}</select></label><span>${e(membership?.role.replaceAll('_',' '))}</span><button class="button button-secondary" id="refresh">Refresh</button></div>${announcementWorkspace(admin)}<div class="account-grid"><section class="card"><h1>Contacts</h1><p class="muted">Page ${state.page+1} · up to 100 contacts per page</p><div class="table-scroll"><table><thead><tr><th>Name</th><th>Mobile</th><th>Status</th><th>Consent</th>${admin ? '<th>Edit</th>' : ''}</tr></thead><tbody>${state.contacts.map(c=>`<tr><td>${e(c.first_name)} ${e(c.last_name)}</td><td>${e(c.mobile)}</td><td>${e(c.status)}</td><td>${e(c.consent_status)}</td>${admin ? `<td><button class="text-button" data-edit="${e(c.id)}">Edit</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="5">No contacts on this page.</td></tr>`}</tbody></table></div><div class="header-actions"><button id="previous" class="button button-secondary" ${state.page===0 ? 'disabled' : ''}>Previous</button><button id="next" class="button button-secondary" ${state.contacts.length<100 ? 'disabled' : ''}>Next</button></div></section><div>${admin ? contactForm() : '<section class="card"><h2>Roster access</h2><p>Your role can view the roster. An Executive Board administrator manages contact details.</p></section>'}<section class="card section-card"><h2>Groups</h2><ul>${state.groups.map(g=>`<li>${e(g.name)}${g.archived ? ' (archived)' : ''}</li>`).join('') || '<li>No groups yet.</li>'}</ul>${admin ? '<form id="group-form"><label>New group<input name="name" required maxlength="100"></label><button class="button button-secondary">Create group</button></form>' : ''}</section></div></div>`}`}`;
  bind();
  if(state.busy) setBusyControls(true);
}
function announcementWorkspace(admin) {
  const cards=state.announcements.map(a=>`<article class="announcement-card"><div class="announcement-card-head"><div><span class="status-pill status-${e(a.status)}">${e(a.status.replaceAll('_',' '))}</span><h3>${e(a.title)}</h3></div><span class="muted">v${e(a.version)}</span></div><p class="message-preview">${e(a.body)}</p>${a.rejection_reason ? `<p class="form-error"><strong>Board note:</strong> ${e(a.rejection_reason)}</p>` : ''}<p class="muted small-note">${recipientSummary(a.selection_snapshot)}</p><div class="header-actions">${['draft','rejected'].includes(a.status) ? `<button class="button button-secondary" data-submit-announcement="${e(a.id)}" data-version="${e(a.version)}">Submit for approval</button>` : ''}${admin && a.status==='pending_approval' ? `<button class="button" data-review-announcement="${e(a.id)}" data-version="${e(a.version)}" data-decision="approved">Approve</button><button class="button button-secondary" data-review-announcement="${e(a.id)}" data-version="${e(a.version)}" data-decision="rejected">Request changes</button>` : ''}</div></article>`).join('');
  return `<section class="card announcement-workspace"><div class="section-heading"><div><h1>Announcements</h1><p class="muted">Stewards can draft and submit. Executive Board members review. Approval does not send an SMS in this build.</p></div></div><div class="announcement-layout"><form id="announcement-form"><h2>New draft</h2><label>Administrative title<input name="title" required maxlength="120"></label><label>Message<textarea name="body" required maxlength="1600" rows="6"></textarea></label><fieldset><legend>Recipients</legend><label class="check-row"><input type="checkbox" name="allEligible"> All eligible contacts</label>${state.groups.filter(g=>!g.archived).map(g=>`<label class="check-row"><input type="checkbox" name="groupIds" value="${e(g.id)}"> Group: ${e(g.name)}</label>`).join('')}${state.contacts.map(c=>`<label class="check-row"><input type="checkbox" name="contactIds" value="${e(c.id)}"> ${e(c.first_name)} ${e(c.last_name)}</label>`).join('')}</fieldset><p class="muted small-note">Eligibility and consent are rechecked before a future send; duplicate contacts will be counted once.</p><button class="button">Save draft</button></form><div><h2>Approval queue and history</h2><div class="announcement-list">${cards || '<p class="muted">No shared announcement drafts yet.</p>'}</div></div></div></section>`;
}
function recipientSummary(selection={}) {
  if(selection.allEligible) return 'All eligible contacts';
  const groups=selection.groupIds?.length || 0, contacts=selection.contactIds?.length || 0;
  return `${groups} group${groups===1?'':'s'} · ${contacts} individual${contacts===1?'':'s'}`;
}
function contactForm() {
  const c=state.editing || {first_name:'',last_name:'',mobile:''};
  return `<section class="card"><h2>${state.editing ? 'Edit contact' : 'Add contact'}</h2><form id="contact-form"><label>First name<input name="first_name" required maxlength="80" value="${e(c.first_name)}"></label><label>Last name<input name="last_name" required maxlength="80" value="${e(c.last_name)}"></label><label>Mobile<input name="mobile" required inputmode="tel" value="${e(c.mobile)}"></label>${state.editing ? `<label>Status<select name="status"><option value="active" ${c.status==='active' ? 'selected' : ''}>Active</option><option value="inactive" ${c.status==='inactive' ? 'selected' : ''}>Inactive</option></select></label>` : ''}<p class="muted small-note">New contacts have unknown consent. Editing cannot grant consent or clear an opt-out. Changing a subscribed phone number resets its consent to unknown.</p><div class="header-actions"><button class="button">Save contact</button>${state.editing ? '<button id="cancel-edit" type="button" class="button button-secondary">Cancel</button>' : ''}</div></form></section>`;
}
function setBusyControls(busy) {
  if(busy) root.querySelectorAll('button,input,select').forEach(control=>{
    if(!control.disabled) {control.dataset.busyDisabled='true';control.disabled=true;}
  });
  else root.querySelectorAll('[data-busy-disabled]').forEach(control=>{control.disabled=false;delete control.dataset.busyDisabled;});
}
async function action(button, fn) {
  if(state.busy) return; state.busy=true; state.error=''; setBusyControls(true);
  try { await fn(); } catch(error) { state.error=error.message; const notice=document.createElement('p'); notice.className='form-error'; notice.setAttribute('role','alert'); notice.textContent=error.message; root.querySelector('.form-error')?.remove(); root.prepend(notice); }
  finally { state.busy=false; setBusyControls(false); }
}
async function loadRoster() {
  const version=++loadVersion, org=state.organizationId, page=state.page;
  state.contacts=[]; state.groups=[]; state.announcements=[]; state.editing=null; render();
  const [contacts,groups,announcements]=await Promise.all([api(`/organizations/${org}/contacts?page=${page}`),api(`/organizations/${org}/groups`),api(`/organizations/${org}/announcements`)]);
  if(version!==loadVersion || !state.user) return;
  state.contacts=contacts.contacts; state.groups=groups.groups; state.announcements=announcements.announcements; render();
}
async function enterAccount() {
  state.user=(await api('/me')).user;
  state.organizations=(await api('/organizations')).organizations;
  state.organizationId=state.organizations[0]?.organization_id || null;
  state.page=0; state.editing=null; state.notice=''; state.error='';
  if(state.organizationId) await loadRoster(); else render();
}
function bind() {
  root.querySelector('#request-code')?.addEventListener('submit',event=>{ event.preventDefault(); const form=event.currentTarget, address=new FormData(form).get('email'); action(form.querySelector('button'),async()=>{ const result=await api('/auth/code','POST',{email:address}); state.notice=result.message; render(); root.querySelector('#verify-code [name="email"]').value=address; requestAnimationFrame(()=>root.querySelector('#verify-code [name="code"]')?.focus()); }); });
  root.querySelector('#verify-code')?.addEventListener('submit',event=>{event.preventDefault(); const form=event.currentTarget, data=new FormData(form); action(form.querySelector('button'),async()=>{ await api('/auth/verify','POST',{email:data.get('email'),code:data.get('code')}); await enterAccount(); });});
  root.querySelector('#logout')?.addEventListener('click',event=>action(event.currentTarget,async()=>{
    try { await api('/auth/logout','POST',{}); } finally { ++loadVersion; state.user=null; state.contacts=[]; state.groups=[]; state.announcements=[]; state.organizations=[]; state.editing=null; render(); }
  }));
  root.querySelector('#organization')?.addEventListener('change',event=>{const org=event.target.value; action(null,async()=>{state.organizationId=org; state.page=0; state.editing=null; state.notice=''; await loadRoster();});});
  root.querySelector('#refresh')?.addEventListener('click',event=>action(event.currentTarget,loadRoster));
  for(const [id,change] of [['previous',-1],['next',1]]) root.querySelector(`#${id}`)?.addEventListener('click',event=>action(event.currentTarget,async()=>{state.page+=change;state.editing=null;await loadRoster();}));
  root.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>{if(state.busy)return; state.editing=state.contacts.find(c=>c.id===button.dataset.edit); render(); root.querySelector('#contact-form input').focus();}));
  root.querySelector('#cancel-edit')?.addEventListener('click',()=>{state.editing=null;render();});
  root.querySelector('#contact-form')?.addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget, body=Object.fromEntries(new FormData(form)), id=state.editing?.id, org=state.organizationId;action(form.querySelector('button'),async()=>{await api(`/organizations/${org}/contacts${id ? '/'+id : ''}`,id ? 'PATCH' : 'POST',body);state.editing=null;state.notice='Contact saved to the shared database.';await loadRoster();});});
  root.querySelector('#group-form')?.addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget, name=new FormData(form).get('name'), org=state.organizationId;action(form.querySelector('button'),async()=>{await api(`/organizations/${org}/groups`,'POST',{name});state.notice='Group created.';await loadRoster();});});
  root.querySelector('#announcement-form')?.addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget, data=new FormData(form), org=state.organizationId;action(form.querySelector('button'),async()=>{await api(`/organizations/${org}/announcements`,'POST',{title:data.get('title'),body:data.get('body'),selection:{allEligible:data.has('allEligible'),groupIds:data.getAll('groupIds'),contactIds:data.getAll('contactIds')}});state.notice='Draft saved to the shared approval queue.';await loadRoster();});});
  root.querySelectorAll('[data-submit-announcement]').forEach(button=>button.addEventListener('click',()=>action(button,async()=>{await api(`/organizations/${state.organizationId}/announcements/${button.dataset.submitAnnouncement}/submit`,'POST',{version:Number(button.dataset.version)});state.notice='Announcement submitted for Executive Board approval.';await loadRoster();})));
  root.querySelectorAll('[data-review-announcement]').forEach(button=>button.addEventListener('click',()=>action(button,async()=>{const rejected=button.dataset.decision==='rejected', reason=rejected ? window.prompt('What should the author change?') : '';if(rejected && !reason)return;await api(`/organizations/${state.organizationId}/announcements/${button.dataset.reviewAnnouncement}/review`,'POST',{version:Number(button.dataset.version),decision:button.dataset.decision,reason});state.notice=rejected ? 'Changes requested.' : 'Announcement approved. No SMS has been sent.';await loadRoster();})));
}
async function start() {
  try {
    const config=await api('/config');
    if(!config.accounts_ready) { root.innerHTML='<section class="card login-card"><h1>Account service setup pending</h1><p>The platform owner needs to connect authentication and database hosting before sign-in becomes available.</p></section>';return; }
    try { await enterAccount(); } catch(error) { if(!state.user) render(); else throw error; }
  } catch { root.innerHTML='<section class="card login-card"><h1>Account service unavailable</h1><p>Sign-in requires the RosterCast account server. The GitHub Pages demonstration does not provide account access.</p></section>'; }
}
start();
