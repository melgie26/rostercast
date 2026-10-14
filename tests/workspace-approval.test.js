import test from "node:test";
import assert from "node:assert/strict";
import { createDemoData } from "../js/data/seed/demo-data.js";
import { TenantDataStore } from "../js/data/data-store.js";
import { WorkspaceAccessService } from "../js/services/workspace-access-service.js";
import { AnnouncementWorkflowService } from "../js/services/announcement-workflow-service.js";
import { WORKSPACE_ACCESS } from "../js/config/workspace-access.js";

const organizationId = "org_airdrie_demo";
const board = { user_id: "board", role: "board_admin" };
const steward = { user_id: "steward", role: "steward" };
const member = { user_id: "member", role: "member" };

test("Workspace access requires the Airdrie domain", () => {
  const service = new WorkspaceAccessService(WORKSPACE_ACCESS);
  assert.equal(service.resolve({ email: "person@example.com", group_emails: [] }).authorized, false);
  assert.equal(service.resolve({ email: "person@airdriefirefighters.com", group_emails: [] }).role, "member");
});

test("Executive group takes precedence over nested steward membership", () => {
  const service = new WorkspaceAccessService(WORKSPACE_ACCESS);
  const access = service.resolve({ email: "person@airdriefirefighters.com", group_emails: [WORKSPACE_ACCESS.steward_group, WORKSPACE_ACCESS.executive_group] });
  assert.equal(access.role, "board_admin");
  assert.equal(access.authorized, true);
});

test("stewards can draft and submit but cannot approve or send", () => {
  const store = new TenantDataStore(createDemoData()); const workflow = new AnnouncementWorkflowService(store);
  const draft = workflow.createDraft(organizationId, steward, { title: "Test", body: "Message" });
  const pending = workflow.submit(organizationId, steward, draft.id);
  assert.equal(pending.status, "pending_approval");
  assert.throws(() => workflow.approve(organizationId, steward, draft.id), /permission/);
  assert.throws(() => workflow.markSent(organizationId, steward, draft.id), /permission/);
});

test("board approval records approver and triggers the simulated send", () => {
  const store = new TenantDataStore(createDemoData()); const workflow = new AnnouncementWorkflowService(store);
  const draft = workflow.createDraft(organizationId, steward, { title: "Test", body: "Message" }); workflow.submit(organizationId, steward, draft.id);
  const sent = workflow.approveAndSend(organizationId, board, draft.id);
  assert.equal(sent.status, "simulated_sent"); assert.equal(sent.approved_by, board.user_id); assert.equal(sent.sent_by, board.user_id);
  assert.deepEqual(store.list("audit_events", organizationId).map(({ action }) => action), ["draft_created", "status_changed_to_pending_approval", "status_changed_to_approved", "status_changed_to_simulated_sent"]);
});

test("members cannot create drafts", () => {
  const workflow = new AnnouncementWorkflowService(new TenantDataStore(createDemoData()));
  assert.throws(() => workflow.createDraft(organizationId, member, { title: "No", body: "No" }), /permission/);
});

