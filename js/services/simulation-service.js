import { RecipientService } from "./recipient-service.js";
import { AnnouncementService } from "./announcement-service.js";
import { calculateTransmittedMessage } from "../sms/transmitted-message.js";

export const PLANNING_RATE_CAD = 0.025;
export const REQUIRED_SUFFIX = "\nReply STOP to unsubscribe.";

export class SimulationService {
  constructor(store) { this.store = store; this.recipients = new RecipientService(store); this.announcements = new AnnouncementService(store); }
  preview(organizationId, { title = "", body = "", selection = {} } = {}) {
    const organization = this.store.get("organizations", organizationId, organizationId);
    if (!organization) throw new Error("Organization not found.");
    if (!title.trim() || !body.trim()) throw new Error("Add an internal title and message before reviewing.");
    const settings = this.store.list("organization_settings", organizationId)[0] ?? {};
    const prefix = settings.message_prefix || `${organization.short_name}: `;
    const suffix = settings.message_suffix?.includes("Reply STOP to unsubscribe.") ? settings.message_suffix : `${settings.message_suffix || ""}${REQUIRED_SUFFIX}`;
    const recipients = this.recipients.resolve(organizationId, selection);
    const calculation = calculateTransmittedMessage({ body, prefix, suffix, recipientCount: recipients.eligible_count });
    const fingerprint = JSON.stringify({ title: title.trim(), body, selection, prefix, suffix, recipients: recipients.eligible.map(({ id, mobile, first_name, last_name }) => ({ id, mobile, first_name, last_name })) });
    return { organizationId, title: title.trim(), body, selection: structuredClone(selection), prefix, suffix, recipients, calculation, fingerprint, estimated_cost_cad: calculation.total_sms_segments * PLANNING_RATE_CAD };
  }
  send(review, { createdBy, requestId } = {}) {
    if (!requestId || !createdBy) throw new Error("A sender and send request ID are required.");
    const membership = this.store.list("organization_users", review.organizationId).find((item) => item.user_id === createdBy);
    if (!membership || !["organization_admin", "platform_admin"].includes(membership.role)) throw new Error("An organization administrator is required to simulate sending.");
    const existing = this.store.list("announcements", review.organizationId).find((item) => item.request_id === requestId);
    if (existing) {
      if (existing.request_fingerprint !== review.fingerprint) throw new Error("Send request ID was already used for a different announcement.");
      return { announcement: existing, deliveries: this.store.list("deliveries", review.organizationId).filter((item) => item.announcement_id === existing.id) };
    }
    const current = this.preview(review.organizationId, review);
    if (current.fingerprint !== review.fingerprint) throw new Error("Recipients or message settings changed. Review the announcement again.");
    if (!current.recipients.eligible_count) throw new Error("No eligible recipients. Choose a different audience or review consent.");
    const snapshot = this.announcements.createSendSnapshot({ organizationId: current.organizationId, createdBy, title: current.title, body: current.body, transmittedBody: current.calculation.transmitted_text, prefix: current.prefix, suffix: current.suffix, calculation: current.calculation, selection: current.selection, recipients: current.recipients.eligible });
    Object.assign(snapshot.announcement, { request_id: requestId, request_fingerprint: current.fingerprint, provider: "simulation", estimated_cost_cad: current.estimated_cost_cad, planning_rate_cad: PLANNING_RATE_CAD, delivered: snapshot.deliveries.length, failed: 0 });
    return this.announcements.saveSnapshot(current.organizationId, snapshot);
  }
}
