import { ROLES } from "../data/schema.js";

export class WorkspaceAccessService {
  constructor(config) { this.config = config; }
  resolve({ email, group_emails = [] }) {
    const normalized = email?.trim().toLowerCase();
    const domain = normalized?.split("@")[1];
    if (!normalized || domain !== this.config.hosted_domain) return { authenticated: Boolean(normalized), authorized: false, role: null, reason: "workspace_domain_required" };
    const groups = new Set(group_emails.map((value) => value.toLowerCase()));
    if (groups.has(this.config.executive_group)) return { authenticated: true, authorized: true, role: ROLES.BOARD_ADMIN, email: normalized };
    if (groups.has(this.config.steward_group)) return { authenticated: true, authorized: true, role: ROLES.STEWARD, email: normalized };
    return { authenticated: true, authorized: false, role: ROLES.MEMBER, email: normalized, reason: "administrative_access_required" };
  }
}

