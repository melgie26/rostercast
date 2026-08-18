export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = "rostercast.prototype.v2";

export const TABLES = Object.freeze([
  "organizations", "users", "organization_users", "contacts", "groups",
  "contact_groups", "announcements", "deliveries", "organization_settings"
]);

export const CONTACT_STATUS = Object.freeze({ ACTIVE: "active", INACTIVE: "inactive" });
export const CONSENT_STATUS = Object.freeze({ SUBSCRIBED: "subscribed", UNSUBSCRIBED: "unsubscribed", UNKNOWN: "unknown" });
export const ROLES = Object.freeze({ PLATFORM_ADMIN: "platform_admin", ORGANIZATION_ADMIN: "organization_admin", ORGANIZATION_VIEWER: "organization_viewer" });

export function emptyDatabase() {
  return Object.fromEntries(TABLES.map((table) => [table, []]));
}

export function validateDatabase(database) {
  if (!database || database.schema_version !== SCHEMA_VERSION) throw new Error("Unsupported RosterCast data schema");
  for (const table of TABLES) if (!Array.isArray(database[table])) throw new Error(`Missing data table: ${table}`);
  return true;
}
