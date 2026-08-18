import { TABLES, validateDatabase } from "./schema.js";

const clone = (value) => structuredClone(value);

export class TenantDataStore {
  constructor(database) { validateDatabase(database); this.database = clone(database); }
  requireTable(table) { if (!TABLES.includes(table)) throw new Error(`Unknown table: ${table}`); }
  list(table, organizationId) {
    this.requireTable(table);
    if (!organizationId) throw new Error("organizationId is required");
    return clone(this.database[table].filter((record) => record.organization_id === organizationId || (table === "organizations" && record.id === organizationId)));
  }
  get(table, organizationId, id) { return this.list(table, organizationId).find((record) => record.id === id) ?? null; }
  put(table, organizationId, record) {
    this.requireTable(table);
    if (!organizationId || !record?.id) throw new Error("organizationId and record.id are required");
    const tenantKey = table === "organizations" ? record.id : record.organization_id;
    if (tenantKey !== organizationId) throw new Error("Cross-tenant write rejected");
    const index = this.database[table].findIndex((item) => item.id === record.id);
    if (index >= 0) {
      const existingTenant = table === "organizations" ? this.database[table][index].id : this.database[table][index].organization_id;
      if (existingTenant !== organizationId) throw new Error("Cross-tenant overwrite rejected");
      this.database[table][index] = clone(record);
    } else this.database[table].push(clone(record));
    this.persist();
    return clone(record);
  }
  export() { return clone(this.database); }
  persist() {}
}

