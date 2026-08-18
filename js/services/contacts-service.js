export class ContactsService {
  constructor(store) { this.store = store; }
  list(organizationId) { return this.store.list("contacts", organizationId); }
  groups(organizationId) { return this.store.list("groups", organizationId); }
  memberships(organizationId) { return this.store.list("contact_groups", organizationId); }
}

