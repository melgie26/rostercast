import { CONTACT_STATUS, CONSENT_STATUS, SCHEMA_VERSION } from "../schema.js";

const organizationId = "org_airdrie_demo";
const groupNames = ["Executive Board", "Alpha Platoon", "Bravo Platoon", "Charlie Platoon", "Delta Platoon", "Captains", "Probationary Firefighters"];
const firstNames = ["Avery", "Blair", "Casey", "Devon", "Emery", "Finley", "Gray", "Harper", "Indigo", "Jordan", "Kai", "Logan", "Morgan", "Noel", "Oakley", "Parker", "Quinn"];
const lastNames = ["Ashford", "Birch", "Cedar", "Drift", "Elmwood"];
const groupId = (name) => `group_${name.toLowerCase().replaceAll(" ", "_")}`;

function makeContacts() {
  return Array.from({ length: 85 }, (_, index) => {
    const n = index + 1;
    return {
      id: `contact_demo_${String(n).padStart(3, "0")}`,
      organization_id: organizationId,
      first_name: firstNames[index % firstNames.length],
      last_name: `${lastNames[Math.floor(index / firstNames.length)]} ${String(n).padStart(2, "0")}`,
      mobile: `+1403555${String(100 + index).padStart(4, "0")}`,
      status: n % 29 === 0 ? CONTACT_STATUS.INACTIVE : CONTACT_STATUS.ACTIVE,
      consent_status: n % 23 === 0 ? CONSENT_STATUS.UNSUBSCRIBED : n % 19 === 0 ? CONSENT_STATUS.UNKNOWN : CONSENT_STATUS.SUBSCRIBED,
      created_at: "2026-07-01T15:00:00.000Z",
      updated_at: "2026-08-01T15:00:00.000Z"
    };
  });
}

function makeRelationships(contacts) {
  const platoons = groupNames.slice(1, 5);
  const rows = [];
  for (const [index, contact] of contacts.entries()) {
    const assigned = [platoons[index % platoons.length]];
    if ((index + 1) % 7 === 0) assigned.push("Captains");
    if ((index + 1) <= 7) assigned.push("Executive Board");
    if ((index + 1) % 11 === 0) assigned.push("Probationary Firefighters");
    for (const name of assigned) rows.push({
      id: `membership_${contact.id}_${groupId(name)}`,
      organization_id: organizationId,
      contact_id: contact.id,
      group_id: groupId(name)
    });
  }
  return rows;
}

export function createDemoData() {
  const contacts = makeContacts();
  const announcements = [
    { id: "announcement_demo_1", title: "August membership meeting", body: "Reminder: membership meeting Tuesday at 7:00 pm.", created_at: "2026-08-15T01:00:00.000Z", recipient_count: 78, total_sms_segments: 78, delivered: 77, failed: 1 },
    { id: "announcement_demo_2", title: "Training registration", body: "Fall training registration closes Friday at noon.", created_at: "2026-08-08T18:30:00.000Z", recipient_count: 21, total_sms_segments: 21, delivered: 21, failed: 0 },
    { id: "announcement_demo_3", title: "Executive board update", body: "Executive board package is ready for review.", created_at: "2026-07-28T16:15:00.000Z", recipient_count: 7, total_sms_segments: 7, delivered: 7, failed: 0 }
  ].map((item) => ({ organization_id: organizationId, created_by: "user_demo_admin", transmitted_body: `APFFA: ${item.body}`, prefix_snapshot: "APFFA: ", suffix_snapshot: "", encoding: "GSM-7", segments_per_recipient: 1, status: "simulated_sent", selection_snapshot: { all: item.id === "announcement_demo_1", group_ids: item.id === "announcement_demo_2" ? [groupId("Alpha Platoon")] : item.id === "announcement_demo_3" ? [groupId("Executive Board")] : [], contact_ids: [] }, calculation_snapshot: { encoding: "GSM-7", segments: 1 }, ...item }));
  return {
    schema_version: SCHEMA_VERSION,
    seeded_at: "2026-08-17T12:00:00.000Z",
    organizations: [{ id: organizationId, name: "Airdrie Professional Firefighters Association", short_name: "APFFA", status: "active", created_at: "2026-07-01T15:00:00.000Z" }],
    users: [{ id: "user_demo_admin", name: "Morgan Sample", email: "admin@example.invalid" }],
    organization_users: [{ id: "orguser_demo_admin", organization_id: organizationId, user_id: "user_demo_admin", role: "organization_admin" }],
    contacts,
    groups: groupNames.map((name) => ({ id: groupId(name), organization_id: organizationId, name, created_at: "2026-07-01T15:00:00.000Z" })),
    contact_groups: makeRelationships(contacts),
    announcements,
    deliveries: [],
    organization_settings: [{ id: "settings_airdrie_demo", organization_id: organizationId, message_prefix: "APFFA: ", message_suffix: "", updated_at: "2026-07-01T15:00:00.000Z" }]
  };
}
