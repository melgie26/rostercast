const ROUTES = new Set(["dashboard", "contacts", "groups", "announcements", "history", "settings"]);

export function currentRoute(hash = globalThis.location?.hash ?? "") {
  const route = hash.replace(/^#\/?/, "").split("/")[0] || "dashboard";
  return ROUTES.has(route) ? route : "not-found";
}

export function startRouter(render) {
  const update = () => render(currentRoute());
  globalThis.addEventListener("hashchange", update);
  update();
  return () => globalThis.removeEventListener("hashchange", update);
}

