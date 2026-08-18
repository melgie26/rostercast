import { TenantDataStore } from "./data-store.js";
import { createDemoData } from "./seed/demo-data.js";
import { STORAGE_KEY, validateDatabase } from "./schema.js";

export class LocalStorageAdapter extends TenantDataStore {
  constructor(storage = globalThis.localStorage) {
    const saved = storage.getItem(STORAGE_KEY);
    let database;
    try { database = saved ? JSON.parse(saved) : createDemoData(); validateDatabase(database); }
    catch { database = createDemoData(); }
    super(database);
    this.storage = storage;
    if (!saved) this.persist();
  }
  persist() { if (this.storage) this.storage.setItem(STORAGE_KEY, JSON.stringify(this.database)); }
  resetDemoData() { this.database = createDemoData(); this.persist(); return this.export(); }
}

