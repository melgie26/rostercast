# RosterCast

RosterCast is a multi-tenant SMS announcement platform prototype for membership organizations, owned by Matt Elgie. The prototype includes contact and group management, staged CSV import, an Announcement composer, recipient review, test preview, confirmed simulated delivery, and historical delivery detail. Twilio is selected for the future server-side integration. It intentionally does **not** send real SMS, authenticate users, take payments, call AI providers, or contain real member data.

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

“All Members” is a dynamic recipient selection rather than a managed group. Inactive, unsubscribed, unknown-consent and invalid-phone contacts are excluded. Normalized phone numbers are deduplicated; opt-outs suppress every copy of a number. Contact editing cannot clear an opt-out.

## Try the announcement workflow

1. Open Announcements and write an internal title and message.
2. Select All Members, groups or individuals. Overlaps are deduplicated.
3. Use Test preview or Review Announcement to inspect the complete SMS, required text, segment count, estimated usage and exclusions.
4. Confirm a simulated send, then open its recipient snapshots in History.

Drafts survive route navigation but not a page reload. Cost estimates are planning assumptions, not Twilio quotes or charges. Older seeded history has summary totals only; the app explicitly labels the absence of historical recipient data. Confirmation rechecks eligibility/settings and requires another review if they changed. Repeated send request IDs do not create a second history record. History and its deliveries persist together or not at all.

## Commercial planning

See [decisions](docs/decisions.md) and [billing architecture](docs/billing.md). The planned paid service bills per organization, with an included segment allowance and authorized overage. Stripe Billing is recommended but not chosen. The subscription layer must enforce sending access server-side; this prototype has no production security boundary.

## Explore usage and subscription planning

Open **Usage & billing** to select a Mountain-time reporting month and see simulated segment totals. The calculator uses the unapproved C$39 / 500 segment / C$0.05 overage illustration; it considers existing usage, queued reservations and the next send against an optional monthly overage cap. Use the button to copy simulated monthly usage into the scenario. Nothing is billed, no subscription is activated, and calculator settings do not affect simulated sending. Scenarios survive navigation only, resetting on reload.

`js/billing/plan-quote.js` contains provider-independent integer-cent arithmetic and validates quantities and overflow. It is reusable calculation code, not server-side authorization or a transactional reservation system. Actual subscription billing cycles and the usage ledger remain production work.
