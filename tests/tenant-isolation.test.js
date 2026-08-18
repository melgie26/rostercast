import test from "node:test";
import assert from "node:assert/strict";
import { TenantDataStore } from "../js/data/data-store.js";
import { createDemoData } from "../js/data/seed/demo-data.js";

function twoTenantStore() {
  const data = createDemoData();
  data.organizations.push({ id: "org_other", name: "Other", status: "active" });
  data.contacts.push({ id: "contact_other", organization_id: "org_other", first_name: "Other", last_name: "Person", mobile: "+15875550100", status: "active", consent_status: "subscribed" });
  return new TenantDataStore(data);
}

test("reads only return records from the requested tenant", () => {
  const store = twoTenantStore();
  assert.equal(store.list("contacts", "org_airdrie_demo").length, 85);
  assert.deepEqual(store.list("contacts", "org_other").map(({ id }) => id), ["contact_other"]);
  assert.equal(store.get("contacts", "org_airdrie_demo", "contact_other"), null);
});

test("cross-tenant writes and overwrites are rejected", () => {
  const store = twoTenantStore();
  assert.throws(() => store.put("contacts", "org_airdrie_demo", { id: "new", organization_id: "org_other" }), /Cross-tenant/);
  assert.throws(() => store.put("contacts", "org_airdrie_demo", { id: "contact_other", organization_id: "org_airdrie_demo" }), /Cross-tenant overwrite/);
});

test("unscoped reads are rejected", () => {
  assert.throws(() => twoTenantStore().list("contacts"), /organizationId is required/);
});

