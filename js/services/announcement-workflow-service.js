import { ANNOUNCEMENT_STATUS, ROLES } from "../data/schema.js";

const transitions = Object.freeze({
  [ANNOUNCEMENT_STATUS.DRAFT]: [ANNOUNCEMENT_STATUS.PENDING_APPROVAL],
  [ANNOUNCEMENT_STATUS.REJECTED]: [ANNOUNCEMENT_STATUS.DRAFT, ANNOUNCEMENT_STATUS.PENDING_APPROVAL],
  [ANNOUNCEMENT_STATUS.PENDING_APPROVAL]: [ANNOUNCEMENT_STATUS.APPROVED, ANNOUNCEMENT_STATUS.REJECTED],
  [ANNOUNCEMENT_STATUS.APPROVED]: [ANNOUNCEMENT_STATUS.SENT]
});

export class AnnouncementWorkflowService {
  constructor(store) { this.store = store; }
  createDraft(organizationId, actor, { title, body, selection = {} }) {
    this.requireRole(actor, [ROLES.BOARD_ADMIN, ROLES.STEWARD]);
    const now = new Date().toISOString();
    const record = { id: `announcement_${crypto.randomUUID()}`, organization_id: organizationId, title, body, selection_snapshot: structuredClone(selection), status: ANNOUNCEMENT_STATUS.DRAFT, created_by: actor.user_id, created_at: now, updated_at: now, submitted_at: null, approved_by: null, approved_at: null, rejected_by: null, rejected_at: null, rejection_reason: null };
    this.store.put("announcements", organizationId, record); this.audit(organizationId, actor, record.id, "draft_created"); return record;
  }
  submit(organizationId, actor, announcementId) { return this.transition(organizationId, actor, announcementId, ANNOUNCEMENT_STATUS.PENDING_APPROVAL, [ROLES.BOARD_ADMIN, ROLES.STEWARD], { submitted_at: new Date().toISOString() }); }
  approve(organizationId, actor, announcementId) { return this.transition(organizationId, actor, announcementId, ANNOUNCEMENT_STATUS.APPROVED, [ROLES.BOARD_ADMIN], { approved_by: actor.user_id, approved_at: new Date().toISOString(), rejection_reason: null }); }
  approveAndSend(organizationId, actor, announcementId) { this.approve(organizationId, actor, announcementId); return this.markSent(organizationId, actor, announcementId); }
  reject(organizationId, actor, announcementId, reason) {
    if (!reason?.trim()) throw new Error("A rejection reason is required");
    return this.transition(organizationId, actor, announcementId, ANNOUNCEMENT_STATUS.REJECTED, [ROLES.BOARD_ADMIN], { rejected_by: actor.user_id, rejected_at: new Date().toISOString(), rejection_reason: reason.trim() });
  }
  markSent(organizationId, actor, announcementId) {
    const record = this.store.get("announcements", organizationId, announcementId);
    return this.transition(organizationId, actor, announcementId, ANNOUNCEMENT_STATUS.SENT, [ROLES.BOARD_ADMIN], { sent_by: actor.user_id, sent_at: new Date().toISOString(), recipient_count: record?.recipient_count ?? 0, total_sms_segments: record?.total_sms_segments ?? 0, delivered: record?.delivered ?? 0, failed: record?.failed ?? 0 });
  }
  transition(organizationId, actor, id, next, roles, fields = {}) {
    this.requireRole(actor, roles); const record = this.store.get("announcements", organizationId, id);
    if (!record) throw new Error("Announcement not found");
    if (!(transitions[record.status] ?? []).includes(next)) throw new Error(`Cannot change ${record.status} to ${next}`);
    const updated = { ...record, ...fields, status: next, updated_at: new Date().toISOString() };
    this.store.put("announcements", organizationId, updated); this.audit(organizationId, actor, id, `status_changed_to_${next}`); return updated;
  }
  requireRole(actor, allowed) { if (!actor || !allowed.includes(actor.role)) throw new Error("You do not have permission for this action"); }
  audit(organizationId, actor, announcementId, action) { this.store.put("audit_events", organizationId, { id: `audit_${crypto.randomUUID()}`, organization_id: organizationId, actor_user_id: actor.user_id, announcement_id: announcementId, action, created_at: new Date().toISOString() }); }
}
