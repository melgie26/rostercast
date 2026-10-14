export const SCHEMA_VERSION = 3;
export const STORAGE_KEY = "rostercast.prototype.v3";

export const TABLES = Object.freeze([
  "organizations", "users", "organization_users", "contacts", "groups",
  "contact_groups", "announcements", "deliveries", "organization_settings", "audit_events"
]);

export const CONTACT_STATUS = Object.freeze({ ACTIVE: "active", INACTIVE: "inactive" });
export const CONSENT_STATUS = Object.freeze({ SUBSCRIBED: "subscribed", UNSUBSCRIBED: "unsubscribed", UNKNOWN: "unknown" });
export const ROLES = Object.freeze({ PLATFORM_ADMIN: "platform_admin", BOARD_ADMIN: "board_admin", STEWARD: "steward", MEMBER: "member" });
export const ANNOUNCEMENT_STATUS = Object.freeze({ DRAFT: "draft", PENDING_APPROVAL: "pending_approval", APPROVED: "approved", REJECTED: "rejected", SENT: "simulated_sent" });

export function emptyDatabase() {
  return Object.fromEntries(TABLES.map((table) => [table, []]));
}

export function validateDatabase(database) {
  if (!database || database.schema_version !== SCHEMA_VERSION) throw new Error("Unsupported RosterCast data schema");
  for (const table of TABLES) if (!Array.isArray(database[table])) throw new Error(`Missing data table: ${table}`);
  return true;
}
