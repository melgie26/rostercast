# RosterCast

RosterCast is a multi-tenant SMS announcement platform prototype for membership organizations, owned by Matt Elgie. The prototype includes contact and group management, staged CSV import, an Announcement composer, recipient review, test preview, confirmed simulated delivery, and historical delivery detail. Twilio is selected for the future server-side integration. The static demonstration does **not** send real SMS, authenticate users, take payments, call AI providers, or contain real member data. A separate account backend now provides hosted authentication, shared roster management and a durable steward-to-board announcement approval queue; it requires owner-controlled hosting configuration.

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

## Account backend foundation

See [backend setup](docs/backend-setup.md) for the implemented Node/Supabase account service, database migration, ownership/setup steps and hosted acceptance checks. Run `npm ci && npm start` for the account server; without configuration it displays setup pending. The GitHub Pages demonstration remains independent and device-local. Tests require Node 24 or later; Node 24 is used in CI and the Dockerfile.

`render.yaml` provides the no-cost pilot deployment definition for the protected account service. It uses the existing Docker image and prompts for all credentials in Render; no deployment secret belongs in the repository. Free hosting is for controlled acceptance testing and may sleep or pause after inactivity.

The account service supports enabled-user email-code sign-in, HTTP-only encrypted sessions, organisation-scoped shared contacts and groups, shared announcement drafts, submission, board approval/rejection, version-conflict protection and append-only workflow events. It is not yet connected to a hosted project. Approval does not send an SMS. Actual sends, payments, consent capture, CSV imports and group assignment remain subsequent account workflows.

## Airdrie Workspace roles

The authorization model now reserves `airdriefirefighters.com` for administrative access. `exec@airdriefirefighters.com` resolves to Executive Board administrators; `stewards@airdriefirefighters.com` resolves to stewards, with Executive Board membership taking precedence because the exec group is nested inside stewards. Stewards may create and submit drafts; only board administrators may approve, reject, or send. The account backend verifies these memberships server-side through the Google Admin SDK before issuing a session. See [Workspace access](docs/workspace-access.md).

The public demonstration still models the workflow locally. The secure account backend contains the real Directory membership enforcement, but it must be deployed and configured by a Google Workspace administrator before production use.
