export class GroupsService {
  constructor(store) { this.store = store; }
  list(organizationId) { return this.store.list("groups", organizationId); }
  memberships(organizationId) { return this.store.list("contact_groups", organizationId); }
  save(organizationId, group) {
    const name = group.name.trim();
    if (!name || name.toLowerCase() === "all members") throw new Error("Choose a different group name");
    if (this.list(organizationId).some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== group.id)) throw new Error("A group with this name already exists");
    const record = { ...group, id: group.id || `group_${crypto.randomUUID()}`, organization_id: organizationId, name, created_at: group.created_at || new Date().toISOString() };
    return this.store.put("groups", organizationId, record);
  }
  setMembers(organizationId, groupId, contactIds) {
    this.store.remove("contact_groups", organizationId, (row) => row.group_id === groupId);
    for (const contactId of new Set(contactIds)) this.store.put("contact_groups", organizationId, { id: `membership_${contactId}_${groupId}`, organization_id: organizationId, contact_id: contactId, group_id: groupId });
  }
}
