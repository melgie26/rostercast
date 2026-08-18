import test from "node:test";
import assert from "node:assert/strict";
import { TenantDataStore } from "../js/data/data-store.js";
import { createDemoData } from "../js/data/seed/demo-data.js";
import { AnnouncementService } from "../js/services/announcement-service.js";
import { calculateTransmittedMessage } from "../js/sms/transmitted-message.js";

test("delivery snapshots survive later contact changes", () => {
  const data = createDemoData();
  const store = new TenantDataStore(data);
  const service = new AnnouncementService(store);
  const contact = data.contacts[0];
  const calculation = calculateTransmittedMessage({ body: "Meeting at 7.", prefix: "APFFA: ", recipientCount: 1 });
  const selection = { all: true, group_ids: [{ id: "group_executive_board", name: "Executive Board" }], contact_ids: [{ id: contact.id, name: "Avery Ashford 01" }] };
  const snapshot = service.createSendSnapshot({ organizationId: contact.organization_id, createdBy: "user_demo_admin", title: "Monthly meeting", body: "Meeting at 7.", transmittedBody: calculation.transmitted_text, prefix: "APFFA: ", suffix: "", calculation, selection, recipients: [contact], now: new Date("2026-08-17T19:00:00Z") });
  contact.first_name = "Changed";
  contact.mobile = "+14035550199";
  assert.equal(snapshot.announcement.title, "Monthly meeting");
  assert.equal(snapshot.deliveries[0].contact_name_snapshot, "Avery Ashford 01");
  assert.equal(snapshot.deliveries[0].mobile_snapshot, "+14035550100");
  assert.equal(snapshot.announcement.transmitted_body, "APFFA: Meeting at 7.");
  assert.notEqual(snapshot.announcement.calculation_snapshot, calculation);
  assert.deepEqual(snapshot.announcement.selection_snapshot, selection);
  assert.notEqual(snapshot.announcement.selection_snapshot, selection);
});
