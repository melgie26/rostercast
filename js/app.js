import { PROTOTYPE_SESSION } from "./config/prototype-session.js";
import { LocalStorageAdapter } from "./data/local-storage-adapter.js";
import { appShell } from "./components/app-shell.js";
import { startRouter } from "./router.js";
import { RecipientService } from "./services/recipient-service.js";
import { ContactsService } from "./services/contacts-service.js";
import { GroupsService } from "./services/groups-service.js";
import { CsvImportService } from "./services/csv-import-service.js";
import { normalizeCanadianMobile } from "./utils/csv.js";
import { dashboardView, contactsView, groupsView } from "./views/stage3-views.js";
import { placeholderView } from "./views/foundation-views.js";
import { SimulationService } from "./services/simulation-service.js";
import { announcementView, historyView, settingsView } from "./views/announcement-views.js";

import { UsageService, reportingMonth } from "./services/usage-service.js";
import { billingView, quoteView } from "./views/billing-view.js";
import { parseScenario } from "./billing/plan-quote.js";

const billing = { month: reportingMonth(), scenario: { used: "0", reserved: "0", requested: "0", cap: "0.00", overage_enabled: false } };
const root = document.querySelector("#app"); const store = new LocalStorageAdapter();
const contactsService = new ContactsService(store); const groupsService = new GroupsService(store);
const recipientService = new RecipientService(store, { unknown_consent_eligible: false });
const csvService = new CsvImportService(store, contactsService, groupsService);
const simulation = new SimulationService(store);
const compose = { draft: { title: "", body: "", selection: { all: true, group_ids: [], contact_ids: [] } }, review: null, testPreview: false, error: "", requestId: crypto.randomUUID() };
let selectedHistory = null;
const state = { route: "dashboard", contactFilters: { q: "", status: "", consent: "", group: "" }, selectedContacts: new Set(), modalContact: undefined, modalGroup: undefined, showImport: false, importPreview: null, importResult: null, createUnknown: new Set(), notice: "" };
const organizationId = PROTOTYPE_SESSION.organization_id;

function context() {
  const organization = store.get("organizations", organizationId, organizationId);
  const membership = store.list("organization_users", organizationId).find(({ user_id }) => user_id === PROTOTYPE_SESSION.user_id);
  const user = store.export().users.find(({ id }) => id === membership.user_id);
  return { organization, user, membership, contacts: contactsService.list(organizationId), groups: groupsService.list(organizationId), memberships: contactsService.memberships(organizationId), announcements: store.list("announcements", organizationId), deliveries: store.list("deliveries", organizationId) };
}

function render(route = state.route) {
  state.route = route; const data = context(); let content;
  if (route === "dashboard") content = dashboardView({ ...data, eligible: recipientService.resolve(organizationId, { all: true }).eligible_count });
  else if (route === "contacts") content = contactsView({ ...data, filters: state.contactFilters, selectedIds: state.selectedContacts, modalContact: state.modalContact, showImport: state.showImport, importPreview: state.importPreview, importResult: state.importResult, createUnknown: state.createUnknown });
  else if (route === "groups") content = groupsView({ ...data, modalGroup: state.modalGroup });
  else if (route === "announcements") content = announcementView({ ...data, ...compose });
  else if (route === "history") content = historyView({ ...data, selectedHistory });
  else if (route === "billing") content = billingView({ usage: new UsageService(store).summary(organizationId, billing.month), scenario: billing.scenario });
  else if (route === "settings") content = settingsView();
  else content = placeholderView(route);
  root.innerHTML = appShell({ route, organization: data.organization, user: data.user, membership: data.membership, content: `${state.notice ? `<div class="toast" role="status">${state.notice}</div>` : ""}${content}` });
  bindEvents(); bindAnnouncementEvents(); bindBillingEvents(); document.title = `${route[0]?.toUpperCase()}${route.slice(1)} · RosterCast`;
}

function updateBillingQuote() {
  const form = document.querySelector('#billing-calculator'); if (!form) return;
  const values = new FormData(form);
  billing.scenario = Object.fromEntries(['used', 'reserved', 'requested', 'cap'].map(key => [key, values.get(key)]));
  billing.scenario.overage_enabled = values.has('overage_enabled');
  document.querySelector('#billing-quote').innerHTML = quoteView(parseScenario(billing.scenario));
}
function bindBillingEvents() {
  document.querySelector('#usage-month')?.addEventListener('change', event => { billing.month = event.target.value; render(); });
  document.querySelector('#billing-calculator')?.addEventListener('input', updateBillingQuote);
  document.querySelector('#billing-calculator')?.addEventListener('submit', event => event.preventDefault());
  document.querySelector('#use-simulated-usage')?.addEventListener('click', () => {
    document.querySelector('[name="used"]').value = new UsageService(store).summary(organizationId, billing.month).simulated_segments;
    updateBillingQuote();
  });
  updateBillingQuote();
}

function readDraft() {
  const form = document.querySelector("#announcement-form");
  if (!form) return;
  const data = new FormData(form);
  compose.draft = { title: data.get("title"), body: data.get("body"), selection: { all: data.has("all"), group_ids: data.getAll("group_ids"), contact_ids: data.getAll("contact_ids") } };
}
function updateLiveSummary() {
  readDraft();
  const target = document.querySelector("#live-sms-summary"); if (!target) return;
  if (!compose.draft.body.trim()) { target.textContent = "Add a message to see the complete SMS segment count."; return; }
  try {
    const preview = simulation.preview(organizationId, { ...compose.draft, title: compose.draft.title || "Untitled", body: compose.draft.body || " " });
    target.textContent = `${preview.recipients.eligible_count} eligible · ${preview.recipients.excluded_count} excluded · ${preview.calculation.encoding} · ${preview.calculation.segments} SMS each · ${preview.calculation.total_sms_segments} segments total${preview.calculation.explanation ? `. ${preview.calculation.explanation}` : ""}`;
  } catch (error) { target.textContent = error.message; }
}
function reviewAnnouncement(testPreview = false) {
  readDraft(); compose.error = "";
  try { compose.review = simulation.preview(organizationId, compose.draft); compose.testPreview = testPreview; }
  catch (error) { compose.error = error.message; compose.review = null; }
  render(); document.querySelector("#back-to-compose")?.focus();
}
function bindAnnouncementEvents() {
  document.querySelector("#announcement-form")?.addEventListener("input", updateLiveSummary);
  document.querySelector("#announcement-form")?.addEventListener("change", updateLiveSummary);
  document.querySelector("#announcement-form")?.addEventListener("submit", (event) => { event.preventDefault(); reviewAnnouncement(); });
  document.querySelector("#test-preview")?.addEventListener("click", () => reviewAnnouncement(true));
  ["#back-to-compose", "#back-to-compose-footer"].forEach((id) => document.querySelector(id)?.addEventListener("click", () => { compose.review = null; compose.error = ""; render(); document.querySelector('[name="body"]')?.focus(); }));
  document.querySelector("#confirm-simulation")?.addEventListener("click", (event) => {
    event.currentTarget.disabled = true;
    try {
      const result = simulation.send(compose.review, { createdBy: PROTOTYPE_SESSION.user_id, requestId: compose.requestId });
      selectedHistory = result.announcement.id;
      compose.draft = { title: "", body: "", selection: { all: true, group_ids: [], contact_ids: [] } }; compose.review = null; compose.error = ""; compose.requestId = crypto.randomUUID();
      location.hash = "#/history";
    } catch (error) { compose.error = error.message; render(); }
  });
  document.querySelectorAll("[data-history-id]").forEach((button) => button.addEventListener("click", () => { selectedHistory = button.dataset.historyId; render(); }));
  document.querySelector("#close-history")?.addEventListener("click", () => { selectedHistory = null; render(); });
  updateLiveSummary();
}

function closeModal() { state.modalContact = undefined; state.modalGroup = undefined; state.showImport = false; state.importPreview = null; state.importResult = null; state.createUnknown.clear(); render(); }
function notify(message) { state.notice = message; render(); setTimeout(() => { state.notice = ""; render(); }, 2200); }

function bindEvents() {
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", (event) => { if (event.target.closest("[data-modal]") && !event.target.matches("[data-close-modal]")) return; closeModal(); }));
  document.querySelector("#add-contact")?.addEventListener("click", () => { state.modalContact = null; render(); });
  document.querySelectorAll("[data-edit-contact]").forEach((button) => button.addEventListener("click", () => { state.modalContact = contactsService.list(organizationId).find(({ id }) => id === button.dataset.editContact); render(); }));
  document.querySelector("#contact-form")?.addEventListener("submit", saveContact);
  document.querySelector("[data-toggle-status]")?.addEventListener("click", (event) => { const contact = contactsService.list(organizationId).find(({ id }) => id === event.currentTarget.dataset.toggleStatus); contactsService.setStatus(organizationId, contact.id, contact.status === "active" ? "inactive" : "active"); closeModal(); notify(`Contact ${contact.status === "active" ? "deactivated" : "reactivated"}.`); });
  [["status-filter","status"],["consent-filter","consent"],["group-filter","group"]].forEach(([id,key]) => document.querySelector(`#${id}`)?.addEventListener("change", (event) => { state.contactFilters[key] = event.target.value; render(); }));
  document.querySelector("#contact-search")?.addEventListener("input", (event) => { state.contactFilters.q = event.target.value; const position = event.target.selectionStart; render(); const input = document.querySelector("#contact-search"); input.focus(); input.setSelectionRange(position, position); });
  document.querySelectorAll("[data-select-contact]").forEach((box) => box.addEventListener("change", () => { box.checked ? state.selectedContacts.add(box.value) : state.selectedContacts.delete(box.value); render(); }));
  document.querySelector("#clear-selection")?.addEventListener("click", () => { state.selectedContacts.clear(); render(); });
  document.querySelector("#bulk-assign")?.addEventListener("click", () => { const groupId = document.querySelector("#bulk-group").value; if (!groupId) return; contactsService.bulkAddGroup(organizationId, [...state.selectedContacts], groupId); state.selectedContacts.clear(); notify("Contacts added to group."); });
  document.querySelector("#open-import")?.addEventListener("click", () => { state.showImport = true; render(); });
  document.querySelector("#csv-file")?.addEventListener("change", async (event) => { try { state.importPreview = csvService.preview(organizationId, await event.target.files[0].text()); render(); } catch (error) { notify(error.message); } });
  document.querySelectorAll("[data-create-group]").forEach((box) => box.addEventListener("change", () => { box.checked ? state.createUnknown.add(box.value) : state.createUnknown.delete(box.value); }));
  document.querySelector("#choose-another")?.addEventListener("click", () => { state.importPreview = null; state.createUnknown.clear(); render(); });
  document.querySelector("#confirm-import")?.addEventListener("click", () => { state.importResult = csvService.import(organizationId, state.importPreview, { create_groups: [...state.createUnknown] }); render(); });
  document.querySelector("#add-group")?.addEventListener("click", () => { state.modalGroup = null; render(); });
  document.querySelectorAll("[data-edit-group]").forEach((button) => button.addEventListener("click", () => { state.modalGroup = groupsService.list(organizationId).find(({ id }) => id === button.dataset.editGroup); render(); }));
  document.querySelector("#group-form")?.addEventListener("submit", saveGroup);
}

function saveContact(event) {
  event.preventDefault(); const data = new FormData(event.currentTarget); const mobile = normalizeCanadianMobile(data.get("mobile"));
  if (!mobile) { notify("Enter a valid Canadian or US mobile number."); return; }
  const id = data.get("id"); const existing = id ? contactsService.list(organizationId).find((item) => item.id === id) : {};
  try { contactsService.save(organizationId, { ...existing, id: id || undefined, first_name: data.get("first_name").trim(), last_name: data.get("last_name").trim(), mobile, status: data.get("status"), consent_status: data.get("consent_status") }, data.getAll("group_ids")); closeModal(); notify(id ? "Contact updated." : "Contact added."); }
  catch (error) { notify(error.message); }
}

function saveGroup(event) {
  event.preventDefault(); const data = new FormData(event.currentTarget); const id = data.get("id");
  try { const existing = id ? groupsService.list(organizationId).find((item) => item.id === id) : {}; const group = groupsService.save(organizationId, { ...existing, id: id || undefined, name: data.get("name") }); if (id) groupsService.setMembers(organizationId, group.id, data.getAll("contact_ids")); closeModal(); notify(id ? "Group updated." : "Group created."); } catch (error) { notify(error.message); }
}

root.addEventListener("keydown", (event) => {
  const dialog = root.querySelector('[role="dialog"]');
  if (!dialog || !compose.review) return;
  if (event.key === "Escape") { compose.review = null; compose.error = ""; render(); root.querySelector('[name="body"]')?.focus(); }
  if (event.key === "Tab") {
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});
startRouter((route) => { compose.review = null; compose.error = ""; state.modalContact = undefined; state.modalGroup = undefined; state.showImport = false; render(route); });
