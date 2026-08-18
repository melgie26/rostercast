export class ContactsService {
  constructor(store) { this.store = store; }
  list(organizationId) { return this.store.list("contacts", organizationId); }
  groups(organizationId) { return this.store.list("groups", organizationId); }
  memberships(organizationId) { return this.store.list("contact_groups", organizationId); }
  save(organizationId, contact, groupIds = []) {
    const now = new Date().toISOString();
    const record = { created_at: now, ...contact, id: contact.id || `contact_${crypto.randomUUID()}`, organization_id: organizationId, updated_at: now };
    if (this.list(organizationId).some((item) => item.mobile === record.mobile && item.id !== record.id)) throw new Error("A contact with this mobile number already exists");
    this.store.put("contacts", organizationId, record);
    this.setGroups(organizationId, record.id, groupIds);
    return record;
  }
  setGroups(organizationId, contactId, groupIds) {
    this.store.remove("contact_groups", organizationId, (row) => row.contact_id === contactId);
    for (const groupId of new Set(groupIds)) this.store.put("contact_groups", organizationId, { id: `membership_${contactId}_${groupId}`, organization_id: organizationId, contact_id: contactId, group_id: groupId });
  }
  setStatus(organizationId, contactId, status) {
    const contact = this.store.get("contacts", organizationId, contactId);
    if (!contact) throw new Error("Contact not found");
    return this.store.put("contacts", organizationId, { ...contact, status, updated_at: new Date().toISOString() });
  }
  bulkAddGroup(organizationId, contactIds, groupId) {
    const memberships = this.memberships(organizationId);
    for (const contactId of contactIds) if (!memberships.some((row) => row.contact_id === contactId && row.group_id === groupId)) this.store.put("contact_groups", organizationId, { id: `membership_${contactId}_${groupId}`, organization_id: organizationId, contact_id: contactId, group_id: groupId });
  }
}
