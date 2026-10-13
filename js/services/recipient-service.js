import { CONTACT_STATUS, CONSENT_STATUS } from "../data/schema.js";
import { normalizeCanadianMobile } from "../utils/csv.js";

export const EXCLUSION_REASON = Object.freeze({ INACTIVE: "inactive", UNSUBSCRIBED: "unsubscribed", CONSENT_UNKNOWN: "consent_unknown", NOT_FOUND: "not_found", INVALID_MOBILE: "invalid_mobile", DUPLICATE_MOBILE: "duplicate_mobile" });

export class RecipientService {
  constructor(store, policy = { unknown_consent_eligible: false }) { this.store = store; this.policy = policy; }
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
    const phones = new Set();
    const suppressedPhones = new Set(contacts.filter((contact) => contact.consent_status === CONSENT_STATUS.UNSUBSCRIBED).map((contact) => normalizeCanadianMobile(contact.mobile)).filter(Boolean));
    for (const contact of selected) {
      let reason = null;
      const mobile = normalizeCanadianMobile(contact.mobile);
      if (contact.status !== CONTACT_STATUS.ACTIVE) reason = EXCLUSION_REASON.INACTIVE;
      else if (contact.consent_status === CONSENT_STATUS.UNSUBSCRIBED || suppressedPhones.has(mobile)) reason = EXCLUSION_REASON.UNSUBSCRIBED;
      else if (contact.consent_status !== CONSENT_STATUS.SUBSCRIBED && !this.policy.unknown_consent_eligible) reason = EXCLUSION_REASON.CONSENT_UNKNOWN;
      else if (!mobile) reason = EXCLUSION_REASON.INVALID_MOBILE;
      else if (phones.has(mobile)) reason = EXCLUSION_REASON.DUPLICATE_MOBILE;
      if (reason) excluded.push({ contact, reason });
      else { phones.add(mobile); eligible.push({ ...contact, mobile }); }
    }
    return { selected_count: selected.length, eligible_count: eligible.length, excluded_count: excluded.length, selected, eligible, excluded };
  }
}
