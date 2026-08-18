const placeholders = {
  contacts: ["Contacts", "Search, filtering, editing, group assignment, and CSV import arrive in Stage 3."],
  groups: ["Groups", "Group management UI arrives in Stage 3. The normalized group relationships are already available in the domain layer."],
  announcements: ["Announcements", "Recipient resolution, SMS calculation, snapshots, and simulated AI contracts are ready. The composer UI is intentionally deferred."],
  history: ["Announcement history", "Historical records will use immutable announcement and delivery snapshots rather than current contact information."],
  settings: ["Settings", "Organization-scoped prefix and suffix settings exist in demo data. Editing UI is deferred."]
};

export function dashboardView({ contacts, groups, eligibleCount }) {
  return `<header class="page-header"><div><p class="eyebrow">Organization dashboard</p><h1>Good evening, Morgan.</h1><p class="muted">The foundation and demonstration data are ready. Operational screens remain intentionally paused until Stage 3.</p></div><button class="button button-accent" disabled aria-describedby="stage-note">+ New Announcement</button></header>
    <div class="card-grid" aria-label="Organization summary"><article class="card"><span class="muted">Demo contacts</span><p class="metric">${contacts.length}</p></article><article class="card"><span class="muted">Eligible recipients</span><p class="metric">${eligibleCount}</p></article><article class="card"><span class="muted">Organization groups</span><p class="metric">${groups.length}</p></article><article class="card"><span class="muted">SMS sent</span><p class="metric">0</p></article></div>
    <section class="card reset-panel"><div class="data-note"><h2>Stage 1–2 foundation</h2><p class="muted" id="stage-note">Routing, responsive layout, local persistence, tenant boundaries, recipient eligibility, historical snapshots, and SMS calculations are implemented.</p></div><button class="button button-secondary" id="reset-demo">Reset demo data</button></section>`;
}

export function placeholderView(route) { const [title, description] = placeholders[route] ?? ["Page not found", "Use the navigation to continue."]; return `<header class="page-header"><div><p class="eyebrow">RosterCast</p><h1>${title}</h1><p class="muted">${description}</p></div></header><section class="card empty-state"><div><h2>Foundation ready</h2><p class="muted">This screen is outside the approved Stage 1–2 implementation scope.</p></div></section>`; }

