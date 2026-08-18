import { CONSENT_STATUS, CONTACT_STATUS } from "../data/schema.js";
import { normalizeCanadianMobile, parseCsv } from "../utils/csv.js";

export class CsvImportService {
  constructor(store, contactsService, groupsService) { this.store = store; this.contacts = contactsService; this.groups = groupsService; }
  preview(organizationId, text) {
    const parsed = parseCsv(text); if (!parsed.length) return { rows: [], unknown_groups: [], counts: { ready: 0, issues: 0 } };
    const headers = parsed.shift().map((value) => value.trim().toLowerCase());
    const required = ["first_name", "last_name", "mobile", "groups"];
    if (!required.every((header) => headers.includes(header))) throw new Error(`CSV headers must include ${required.join(", ")}`);
    const existing = new Set(this.contacts.list(organizationId).map(({ mobile }) => mobile));
    const groups = this.groups.list(organizationId); const groupByName = new Map(groups.map((group) => [group.name.toLowerCase(), group]));
    const seen = new Set(); const unknown = new Set();
    const rows = parsed.map((values, index) => {
      const source = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""]));
      const mobile = normalizeCanadianMobile(source.mobile); const names = source.groups.split(";").map((name) => name.trim()).filter(Boolean); const issues = [];
      if (!source.first_name || !source.last_name || !source.mobile) issues.push("missing_required");
      if (source.mobile && !mobile) issues.push("invalid_mobile");
      if (mobile && seen.has(mobile)) issues.push("duplicate_in_file");
      if (mobile && existing.has(mobile)) issues.push("existing_contact");
      if (mobile) seen.add(mobile);
      const unknownGroups = names.filter((name) => !groupByName.has(name.toLowerCase()));
      if (unknownGroups.length) { issues.push("unknown_groups"); unknownGroups.forEach((name) => unknown.add(name)); }
      return { row_number: index + 2, first_name: source.first_name, last_name: source.last_name, mobile, raw_mobile: source.mobile, groups: names, unknown_groups: unknownGroups, issues };
    });
    return { rows, unknown_groups: [...unknown], counts: { ready: rows.filter(({ issues }) => !issues.length).length, issues: rows.filter(({ issues }) => issues.length).length } };
  }
  import(organizationId, preview, { create_groups = [] } = {}) {
    const createdGroups = [];
    for (const name of create_groups) createdGroups.push(this.groups.save(organizationId, { name }));
    const groupMap = new Map(this.groups.list(organizationId).map((group) => [group.name.toLowerCase(), group.id]));
    const imported = []; const skipped = [];
    for (const row of preview.rows) {
      const blocking = row.issues.filter((issue) => issue !== "unknown_groups");
      const unresolved = row.unknown_groups.filter((name) => !groupMap.has(name.toLowerCase()));
      if (blocking.length || unresolved.length) { skipped.push({ ...row, unresolved_groups: unresolved }); continue; }
      imported.push(this.contacts.save(organizationId, { first_name: row.first_name, last_name: row.last_name, mobile: row.mobile, status: CONTACT_STATUS.ACTIVE, consent_status: CONSENT_STATUS.UNKNOWN }, row.groups.map((name) => groupMap.get(name.toLowerCase())).filter(Boolean)));
    }
    return { imported, skipped, created_groups: createdGroups };
  }
}
