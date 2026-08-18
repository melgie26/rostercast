export class AnnouncementService {
  constructor(store) { this.store = store; }
  createSendSnapshot({ organizationId, createdBy, title, body, transmittedBody, prefix, suffix, calculation, recipients, selection = {}, now = new Date() }) {
    const announcementId = `announcement_${crypto.randomUUID()}`;
    const createdAt = now.toISOString();
    const announcement = {
      id: announcementId, organization_id: organizationId, created_by: createdBy,
      title, body, transmitted_body: transmittedBody, prefix_snapshot: prefix, suffix_snapshot: suffix,
      calculation_snapshot: structuredClone(calculation), selection_snapshot: structuredClone(selection), encoding: calculation.encoding,
      segments_per_recipient: calculation.segments, recipient_count: recipients.length,
      total_sms_segments: calculation.segments * recipients.length, status: "simulated_sent", created_at: createdAt
    };
    const deliveries = recipients.map((contact) => ({
      id: `delivery_${crypto.randomUUID()}`, organization_id: organizationId, announcement_id: announcementId,
      contact_id: contact.id, contact_name_snapshot: `${contact.first_name} ${contact.last_name}`,
      mobile_snapshot: contact.mobile, contact_status_snapshot: contact.status,
      consent_status_snapshot: contact.consent_status, status: "simulated_delivered",
      provider_message_id: null, delivered_at: createdAt, error: null
    }));
    return { announcement, deliveries };
  }
  saveSnapshot(organizationId, snapshot) {
    this.store.put("announcements", organizationId, snapshot.announcement);
    for (const delivery of snapshot.deliveries) this.store.put("deliveries", organizationId, delivery);
    return snapshot;
  }
}
