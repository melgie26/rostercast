# RosterCast

RosterCast is a multi-tenant SMS announcement platform prototype for membership organizations. The current prototype includes the foundation, local domain layer, dashboard, contact and group management, and staged CSV import. It intentionally does **not** send SMS, authenticate users, call AI providers, or contain real member data.

## Run locally

```bash
npm run serve
```

Open <http://localhost:8000>. A local web server is required because the app uses native ES modules. Run tests with `npm test`.

## GitHub Pages

The app has no build step. Publish the repository root from the `main` branch in GitHub Pages settings. Hash routes work under both user and project Pages URLs.

## Prototype privacy

All included people and contact details are fictional. Browser data is device-local and unencrypted. Do not enter real personal, confidential, or operational information in this prototype.

## Architecture

- `js/data`: versioned schema, immutable fixtures, and browser persistence.
- `js/services`: tenant-scoped domain operations and future provider abstractions.
- `js/sms`: pure SMS encoding and segmentation calculations.
- `js/views` and `js/components`: application shell and route-level UI.
- `tests`: domain, tenant isolation, recipient resolution, snapshots, and SMS boundaries.

Views do not access `localStorage` directly. Services depend on a store contract, allowing a future HTTP-backed store to replace the local adapter. Every organization-owned entity carries `organization_id`, and store reads/writes require a tenant scope.

“All Members” is a dynamic recipient selection rather than a managed group. Inactive, unsubscribed, and unknown-consent contacts are excluded from eligible recipients. The Announcement composer and sending workflow are intentionally deferred to the next approved stage.
