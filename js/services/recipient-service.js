import { CONTACT_STATUS, CONSENT_STATUS } from "../data/schema.js";

export const EXCLUSION_REASON = Object.freeze({ INACTIVE: "inactive", UNSUBSCRIBED: "unsubscribed", CONSENT_UNKNOWN: "consent_unknown", NOT_FOUND: "not_found" });

export class RecipientService {
  constructor(store) { this.store = store; }
  resolve(organizationId, selection = {}) {
    const contacts = this.store.list("contacts", organizationId);
    const memberships = this.store.list("contact_groups", organizationId);
    const byId = new Map(contacts.map((contact) => [contact.id, contact]));
    const selectedIds = new Set(selection.all ? contacts.map(({ id }) => id) : []);
    for (const groupId of selection.group_ids ?? []) {
      for (const row of memberships) if (row.group_id === groupId) selectedIds.add(row.contact_id);
    }
    for (const contactId of selection.contact_ids ?? []) selectedIds.add(contactId);
    const selected = [...selectedIds].map((id) => byId.get(id)).filter(Boolean);
    const excluded = [];
    const eligible = [];
    for (const contact of selected) {
      let reason = null;
      if (contact.status !== CONTACT_STATUS.ACTIVE) reason = EXCLUSION_REASON.INACTIVE;
      else if (contact.consent_status === CONSENT_STATUS.UNSUBSCRIBED) reason = EXCLUSION_REASON.UNSUBSCRIBED;
      else if (contact.consent_status !== CONSENT_STATUS.SUBSCRIBED) reason = EXCLUSION_REASON.CONSENT_UNKNOWN;
      (reason ? excluded : eligible).push(reason ? { contact, reason } : contact);
    }
    return { selected_count: selected.length, eligible_count: eligible.length, excluded_count: excluded.length, selected, eligible, excluded };
  }
}

