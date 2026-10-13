# RosterCast prototype architecture

## Scope

This implementation includes the Stage 4 simulated Announcement workflow: composer, audience selection, transmitted-message preview, confirmation and operational history detail. Settings displays the Twilio choice and production boundaries. Real authentication, SMS and billing remain production milestones.

## Boundaries

The browser application is divided into four boundaries:

1. Views and components render routes and accept user actions.
2. Services express organization-scoped domain operations.
3. The store contract provides normalized persistence without exposing browser storage to views.
4. Pure utilities calculate SMS encoding and usage without UI or persistence dependencies.

A future backend adapter can replace the local adapter. The backend must enforce authentication, authorization, tenant isolation, validation, rate limits, consent rules, and auditability; the browser cannot be trusted as a security boundary.

## Recipient selection

`RecipientService.resolve()` accepts `all`, `group_ids`, and `contact_ids` in any combination. IDs are collected into a set before eligibility evaluation, so overlaps between groups and individuals do not duplicate recipients. The result contains selected and eligible contacts plus excluded contacts with reason codes.

The prototype conservatively excludes inactive, unsubscribed, and unknown-consent contacts. The policy is injected into the recipient service so future compliance rules can change without redesigning selection. “All Members” is dynamic and is never persisted as a managed group.

CSV import parses, normalizes, and validates entirely before writing. Unknown groups can be selected for explicit creation during confirmation; unresolved and otherwise invalid rows are skipped rather than silently imported.

## Announcement history

`SimulationService` creates a review from tenant-scoped contacts and settings, then recomputes it at confirmation. A changed recipient set, number, name, message or required text invalidates the review. Normalized phone deduplication and opt-out suppression apply across all matching contacts. Request IDs provide device-local idempotency and cannot be reused for changed content. The store validates batch writes in a staging copy and persists the announcement and deliveries once, rolling back on storage failure. These are prototype safeguards; durable server transactions and authorization remain necessary.

An announcement has an internal, non-transmitted `title`. Send-time records preserve the original body, transmitted body, required-text snapshots, calculation snapshot, encoding, segments, recipient count, total usage, creator, and time. Each delivery preserves contact ID plus name, mobile, status, and consent snapshots. Delivery membership is therefore the authoritative historical recipient list; current groups and contacts are not used to reconstruct it.

## SMS calculations

SMS logic distinguishes GSM-7 septets, GSM extension-table characters, and UCS-2 code units. Segment capacities are 160/153 for GSM-7 and 70/67 for UCS-2. Prefix and suffix text are included before calculation. Results include a simple administrator summary and an explanation when Unicode materially reduces capacity.

Provider behavior must be reconciled when an SMS provider is selected because normalization and character replacement can differ.

## AI abstraction

The UI will depend on `AnnouncementAiService`, not a provider SDK. The simulated implementation returns an explicit suggestion and never mutates administrator text. A future implementation should call a secured backend endpoint; credentials and direct external calls do not belong in the static application.

## Local data

The normalized database is versioned and stored under one namespaced `localStorage` key. Demo reset reconstructs fresh fixtures. All demo contacts are generated deterministically and use reserved North American `555-0100` through `555-0199` example numbers. No real data is appropriate for this unencrypted prototype.

## Routing and deployment

Hash routing avoids server rewrite requirements and works from a GitHub Pages project subpath. Asset references are document-relative and the app requires no build step.

## Subscription and paid access

See [billing.md](billing.md) for proposed organization subscriptions, plan versions, entitlements, reservations, metering ledger, invoice reconciliation and payment-failure behaviour. Simulations are non-billable. The future sending service checks roles, subscription eligibility, consent and authorized budget both before queueing and dispatch. Opt-out processing continues even when paid access ends. Stripe is a recommended billing integration; Twilio is the confirmed SMS provider.

## Account backend foundation

A separate `server/` application and `web/account/` portal now support provider-backed sign-in and shared roster management when configured. The public demonstration's synchronous local adapter remains unchanged. The account portal uses same-origin HTTP endpoints; JWTs stay in encrypted HTTP-only cookies and are forwarded to Supabase using the user's authorization, never a service-role key. The SQL migration implements organisation membership, row-level security, column grants, composite tenant foreign keys, consent/opt-out protections and append-only audit events. See [backend-setup.md](backend-setup.md) for configuration, tested boundaries and work still required before real data is used.
