import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../js/data/seed/demo-data.js";
import { TenantDataStore } from "../js/data/data-store.js";
import { SimulationService } from "../js/services/simulation-service.js";
import { announcementView, historyView } from "../js/views/announcement-views.js";
import { ContactsService } from "../js/services/contacts-service.js";

const org = "org_airdrie_demo";
const setup = () => { const store = new TenantDataStore(createDemoData()); return { store, service: new SimulationService(store) }; };
const draft = { title: "Meeting reminder", body: "Meeting Tuesday at 7 pm.", selection: { all: true, group_ids: [], contact_ids: [] } };
const sendOptions = { createdBy: "user_demo_admin", requestId: "test-request" };
test("ordinary contact editing cannot clear an existing opt-out", () => {
  const { store } = setup(); const contacts = new ContactsService(store);
  const contact = contacts.list(org).find((c) => c.consent_status === "unsubscribed");
  assert.throws(() => contacts.save(org, { ...contact, consent_status: "subscribed" }), /re-consent/);
  assert.equal(store.get("contacts", org, contact.id).consent_status, "unsubscribed");
});
test("reusing a send request for changed content or an unauthorized user is rejected", () => {
  const { service } = setup(); const review = service.preview(org, draft);
  service.send(review, sendOptions);
  assert.throws(() => service.send(service.preview(org, { ...draft, body: "Different message" }), sendOptions), /different announcement/);
  assert.throws(() => service.send(review, { ...sendOptions, createdBy: "foreign-user" }), /administrator/);
});

test("preview counts mandatory text and creates no history", () => {
  const { store, service } = setup(); const before = store.list("announcements", org).length;
  const review = service.preview(org, draft);
  assert.match(review.calculation.transmitted_text, /^APFFA: Meeting/);
  assert.match(review.calculation.transmitted_text, /Reply STOP to unsubscribe\.$/);
  assert.equal(review.calculation.total_sms_segments, review.recipients.eligible_count * review.calculation.segments);
  assert.equal(store.list("announcements", org).length, before);
});
test("confirmation stores immutable results and repeated request is idempotent", () => {
  const { store, service } = setup(); const review = service.preview(org, draft);
  const result = service.send(review, sendOptions); const repeated = service.send(review, sendOptions);
  assert.equal(result.announcement.id, repeated.announcement.id);
  assert.equal(store.list("deliveries", org).length, review.recipients.eligible_count);
  const contact = store.get("contacts", org, result.deliveries[0].contact_id);
  store.put("contacts", org, { ...contact, first_name: "Changed", mobile: "+14035550199" });
  assert.equal(store.list("deliveries", org)[0].contact_name_snapshot, result.deliveries[0].contact_name_snapshot);
  assert.equal(result.announcement.provider, "simulation");
});
test("opt-out after review requires a new review and saves nothing", () => {
  const { store, service } = setup(); const review = service.preview(org, draft); const c = review.recipients.eligible[0];
  store.put("contacts", org, { ...c, consent_status: "unsubscribed" });
  assert.throws(() => service.send(review, sendOptions), /Review the announcement again/);
  assert.equal(store.list("deliveries", org).length, 0);
});
test("phone changes and required-text changes invalidate a review", () => {
  const { store, service } = setup(); const review = service.preview(org, draft); const c = review.recipients.eligible[0];
  store.put("contacts", org, { ...c, mobile: "+17805550199" });
  assert.throws(() => service.send(review, sendOptions), /changed/);
  const next = service.preview(org, draft); const settings = store.list("organization_settings", org)[0];
  store.put("organization_settings", org, { ...settings, message_prefix: "Different: " });
  assert.throws(() => service.send(next, sendOptions), /changed/);
});
test("zero recipients, blank messages, and unauthorized senders are blocked", () => {
  const { service } = setup();
  assert.throws(() => service.preview(org, { ...draft, body: "  " }), /Add an internal title/);
  const none = service.preview(org, { ...draft, selection: {} });
  assert.throws(() => service.send(none, sendOptions), /No eligible/);
  assert.throws(() => service.send(service.preview(org, draft), { ...sendOptions, createdBy: "foreign-user" }), /administrator/);
});
test("duplicate normalized numbers send once and an opt-out suppresses all copies", () => {
  const { store, service } = setup(); const contact = store.list("contacts", org)[0];
  store.put("contacts", org, { ...contact, id: "copy", mobile: "403-555-0100" });
  let preview = service.preview(org, draft);
  assert.ok(preview.recipients.excluded.some(({ reason }) => reason === "duplicate_mobile"));
  store.put("contacts", org, { ...contact, id: "copy", consent_status: "unsubscribed" });
  preview = service.preview(org, { ...draft, selection: { contact_ids: [contact.id] } });
  assert.equal(preview.recipients.eligible_count, 0);
});
test("batch writes cannot leave partial history on cross-tenant or storage failure", () => {
  const { store, service } = setup(); const before = store.export();
  assert.throws(() => store.putMany(org, [{ table: "announcements", record: { id: "partial", organization_id: org } }, { table: "deliveries", record: { id: "foreign", organization_id: "other" } }]), /Cross-tenant/);
  assert.deepEqual(store.export(), before);
  store.persist = () => { throw new Error("Storage full"); };
  assert.throws(() => service.send(service.preview(org, draft), sendOptions), /Storage full/);
  assert.deepEqual(store.export(), before);
});
test("composer and history escape message text and do not invent old recipients", () => {
  const { store, service } = setup(); const unsafe = { ...draft, body: '<img src=x onerror="alert(1)">' };
  const html = announcementView({ groups: [], contacts: [], draft: unsafe, review: service.preview(org, unsafe) });
  assert.ok(!html.includes('<img src=x')); assert.match(html, /&lt;img/);
  const history = historyView({ announcements: store.list("announcements", org), deliveries: [], selectedHistory: "announcement_demo_1" });
  assert.match(history, /summary totals only/);
});
