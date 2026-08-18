import test from "node:test";
import assert from "node:assert/strict";
import { TenantDataStore } from "../js/data/data-store.js";
import { createDemoData } from "../js/data/seed/demo-data.js";
import { RecipientService } from "../js/services/recipient-service.js";

const organizationId = "org_airdrie_demo";

test("all selection distinguishes selected, eligible, and excluded contacts", () => {
  const service = new RecipientService(new TenantDataStore(createDemoData()));
  const result = service.resolve(organizationId, { all: true });
  assert.equal(result.selected_count, 85);
  assert.equal(result.eligible_count + result.excluded_count, 85);
  assert.ok(result.excluded.some(({ reason }) => reason === "inactive"));
  assert.ok(result.excluded.some(({ reason }) => reason === "unsubscribed"));
  assert.ok(result.excluded.some(({ reason }) => reason === "consent_unknown"));
});

test("groups and individual contacts combine and deduplicate", () => {
  const data = createDemoData();
  const service = new RecipientService(new TenantDataStore(data));
  const alpha = data.groups.find(({ name }) => name === "Alpha Platoon");
  const member = data.contact_groups.find(({ group_id }) => group_id === alpha.id).contact_id;
  const result = service.resolve(organizationId, { group_ids: [alpha.id, alpha.id], contact_ids: [member, member] });
  assert.equal(result.selected_count, new Set(data.contact_groups.filter(({ group_id }) => group_id === alpha.id).map(({ contact_id }) => contact_id)).size);
});

