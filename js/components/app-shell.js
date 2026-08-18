const items = [
  ["dashboard", "Dashboard"], ["contacts", "Contacts"], ["groups", "Groups"],
  ["announcements", "Announcements"], ["history", "History"], ["settings", "Settings"]
];

const nav = (route, className = "nav") => `<nav class="${className}" aria-label="Primary">${items.map(([key, label]) => `<a href="#/${key}" ${route === key ? 'aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;

export function appShell({ route, organization, user, content }) {
  return `<div class="app-shell">
    <aside class="sidebar"><div class="brand"><span class="brand-mark" aria-hidden="true"></span>RosterCast</div>${nav(route)}<div class="sidebar-footer">Organization communications<br>Prototype · Local data</div></aside>
    <div class="workspace">
      <header class="topbar"><div class="org-switcher"><strong>${organization.name}</strong><span>Demonstration organization</span></div><div class="user-chip"><strong>${user.name}</strong><span>Organization administrator</span></div></header>
      <main class="main" id="main-content" tabindex="-1"><div class="prototype-notice" role="note"><strong>Prototype only</strong><span>No messages are sent. Data stays in this browser and is not encrypted. Do not enter real personal or operational information.</span></div>${content}</main>
    </div>${nav(route, "mobile-bar")}
  </div>`;
}

