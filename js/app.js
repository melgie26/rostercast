import { PROTOTYPE_SESSION } from "./config/prototype-session.js";
import { LocalStorageAdapter } from "./data/local-storage-adapter.js";
import { appShell } from "./components/app-shell.js";
import { startRouter } from "./router.js";
import { RecipientService } from "./services/recipient-service.js";
import { dashboardView, placeholderView } from "./views/foundation-views.js";

const root = document.querySelector("#app");
const store = new LocalStorageAdapter();
const recipients = new RecipientService(store);

function render(route) {
  const organization = store.get("organizations", PROTOTYPE_SESSION.organization_id, PROTOTYPE_SESSION.organization_id);
  const user = store.list("organization_users", PROTOTYPE_SESSION.organization_id).find(({ user_id }) => user_id === PROTOTYPE_SESSION.user_id);
  const profile = store.export().users.find(({ id }) => id === user.user_id);
  const contacts = store.list("contacts", organization.id);
  const groups = store.list("groups", organization.id);
  const resolution = recipients.resolve(organization.id, { all: true });
  const content = route === "dashboard" ? dashboardView({ contacts, groups, eligibleCount: resolution.eligible_count }) : placeholderView(route);
  root.innerHTML = appShell({ route, organization, user: profile, content });
  document.querySelector("#reset-demo")?.addEventListener("click", () => { store.resetDemoData(); render("dashboard"); });
  document.title = `${route === "dashboard" ? "Dashboard" : "RosterCast"} · RosterCast`;
}

startRouter(render);
