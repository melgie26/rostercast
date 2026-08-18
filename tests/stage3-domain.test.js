import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../js/data/seed/demo-data.js";
import { TenantDataStore } from "../js/data/data-store.js";
import { ContactsService } from "../js/services/contacts-service.js";
import { GroupsService } from "../js/services/groups-service.js";
import { CsvImportService } from "../js/services/csv-import-service.js";
import { RecipientService } from "../js/services/recipient-service.js";

const organizationId = "org_airdrie_demo";
const setup = () => { const store = new TenantDataStore(createDemoData()); const contacts = new ContactsService(store); const groups = new GroupsService(store); return { store, contacts, groups, csv: new CsvImportService(store, contacts, groups) }; };

test("All Members is dynamic rather than a managed group", () => {
  const { store, groups } = setup();
  assert.equal(groups.list(organizationId).some(({ name }) => name === "All Members"), false);
  assert.equal(new RecipientService(store).resolve(organizationId, { all: true }).selected_count, 85);
});

test("unknown consent remains configurable and ineligible by default", () => {
  const { store } = setup();
  const conservative = new RecipientService(store).resolve(organizationId, { all: true });
  const permissive = new RecipientService(store, { unknown_consent_eligible: true }).resolve(organizationId, { all: true });
  assert.ok(permissive.eligible_count > conservative.eligible_count);
});

test("contact deactivation and group membership changes persist without deletion", () => {
  const { contacts, groups } = setup(); const contact = contacts.list(organizationId)[0]; const group = groups.list(organizationId)[0];
  contacts.setStatus(organizationId, contact.id, "inactive"); contacts.setGroups(organizationId, contact.id, [group.id]);
  assert.equal(contacts.list(organizationId).find(({ id }) => id === contact.id).status, "inactive");
  assert.deepEqual(contacts.memberships(organizationId).filter(({ contact_id }) => contact_id === contact.id).map(({ group_id }) => group_id), [group.id]);
});

test("CSV preview identifies multiple issues and performs no writes", () => {
  const { contacts, csv } = setup(); const before = contacts.list(organizationId).length;
  const text = `first_name,last_name,mobile,groups\nTest,Person,4035550190,"New Committee"\nCopy,Person,4035550190,"New Committee"\nBad,,123,Alpha Platoon`;
  const preview = csv.preview(organizationId, text);
  assert.equal(preview.rows[1].issues.includes("duplicate_in_file"), true);
  assert.equal(preview.rows[2].issues.includes("missing_required"), true);
  assert.equal(preview.rows[2].issues.includes("invalid_mobile"), true);
  assert.deepEqual(preview.unknown_groups, ["New Committee"]);
  assert.equal(contacts.list(organizationId).length, before);
});

test("CSV import creates unknown groups only when explicitly confirmed", () => {
  const { contacts, groups, csv } = setup(); const text = `first_name,last_name,mobile,groups\nTest,Person,7805550190,"New Committee"`; const preview = csv.preview(organizationId, text);
  const withoutCreation = csv.import(organizationId, preview); assert.equal(withoutCreation.imported.length, 0); assert.equal(groups.list(organizationId).some(({ name }) => name === "New Committee"), false);
  const result = csv.import(organizationId, preview, { create_groups: ["New Committee"] }); assert.equal(result.imported.length, 1); assert.equal(result.created_groups.length, 1);
  assert.equal(contacts.list(organizationId).find(({ mobile }) => mobile === "+17805550190").consent_status, "unknown");
});

