# Subscription and paid access architecture

## Service model

Organizations pay Matt's business for RosterCast access. RosterCast separately pays Twilio for numbers and messaging. Members receiving texts are not charged by RosterCast. Retail subscription pricing is distinct from Twilio's wholesale bill.

The commercial build includes a subscription, organization billing page, hosted payment portal, usage accounting and server-side access rules. Stripe Billing is the recommended payment provider, not a confirmed choice. The current prototype cannot accept payments.

## Recommended pricing model

One subscription per organization, billed in CAD. Charge a platform fee at the beginning of each billing period, including a monthly SMS segment allowance. Invoice explicitly authorized excess usage at the period's end. Avoid per-administrator pricing initially; rotating union executives should not each need a paid seat. Start with one monthly plan and manual customer onboarding. Defer annual discounts and multiple tiers until pilot costs are known.

Illustration only: C$39/month including 500 outbound segments, plus C$0.05 per additional segment. At 700 segments the charge would be C$49 before applicable tax. These rates are not approved or validated. Cost wholesale SMS, number rental, hosting/database, processing, subscription tooling, support, taxes and profit before setting prices. Long or Unicode messages can use multiple segments per recipient. Avoid unlimited-text promises.

Finalize allowances, overage rates, trials, cancellation, refunds, price changes and payment-failure policies before live checkout. Overage defaults off; the billing admin may enable it up to an explicit monthly cap.

## Customer workflow

Owner approves organization → admin selects a plan → hosted Checkout collects payment → verified payment events update its entitlement → authorized users send within plan and budget → billing page shows allowance and overage → hosted portal manages payment details, invoices and cancellation.

Create Checkout and portal sessions server-side after checking organization-admin membership. Map the payment customer to an internal organization ID. A success-page redirect or browser “paid” flag must never grant access. RosterCast does not store card numbers.

## Production records

- Billing account: organization, billing admin, legal name/address, provider customer ID, currency and applicable tax details.
- Versioned plan: base fee in integer cents, included segments, overage rate, interval, limits, features and effective date.
- Subscription: organization, provider subscription/price IDs, provider status, resolved access entitlement, period dates, cancellation and grace-period end.
- Usage ledger: unique event ID, organization/period, delivery/provider ID, units, event type, source, price version and timestamp. Corrections use separate adjustment entries.
- Usage reservations: planned units for queued sends, release/expiry and reconciliation state. Prevent simultaneous sends spending the same allowance.
- Billing webhook events: verified provider event ID, processing status/time. Deduplicate retries; reconcile current provider state for out-of-order updates.
- Invoice references: invoice ID, frozen period totals, billed units, credits and refunds.

All records are organization-scoped. Billing admins see their own invoices and usage; ordinary senders see allowance/estimates without changing billing. Support access is explicit and audited.

## Metering and sending entitlement

Count segments rather than announcements or clicks. Separate estimated, provider-billable and customer-billable usage. Define how inbound replies, opt-out acknowledgements, failures, retries and provider adjustments are charged before paid launch. Provider-billable is not the same as delivered or read. Each delivery usage event is recorded once. Simulation and previews generate zero billable usage.

The internal ledger is authoritative for customer usage and is reconciled with Twilio. Export idempotent usage events to the payment provider through a durable outbox. Freeze invoiced periods; use credits or adjustments for late corrections.

Before queueing and dispatch, enforce server-side role, active membership, consent/suppression, subscription entitlement and authorized budget. Reserve usage transactionally and release unused reservations. Show incremental cost before confirmation; block sends above the cap. Trial accounts receive a small allowance and approved destination limits.

Payment failure triggers notice and a defined grace period; afterwards pause new outbound sends. Continue inbound STOP processing and delivery callbacks. Permit authenticated admins to access invoices and export roster/history under the retention policy. Cancellation normally ends sending access at the paid period's end. Never automatically delete data or release a sender number solely because a subscription ends.

Use payment-provider test mode to verify checkout, failed payment, cancellation, refunds, webhook replay, cross-organization access, simultaneous sends, metering reconciliation and period rollover before charging customers.

## Sources checked 12 October 2026

- Pricing models: https://docs.stripe.com/billing/subscriptions/usage-based/pricing-models
- Checkout: https://stripe.com/en-ca/payments/checkout
- Portal and subscriptions: https://stripe.com/billing/features
- Fees: https://stripe.com/en-ca/pricing and https://stripe.com/en-ca/billing/pricing

Payment and subscription fees are separate from Twilio. Confirm actual merchant terms before pricing. Determine applicable tax obligations for the business before paid launch; configuring tax collection is not itself a determination of registration obligations.

## Implemented planning milestone — 12 October 2026

The Usage & billing route reports tenant-scoped simulated activity by Mountain-time calendar month, including seeded demo history. Every simulation remains non-billable. A separate interactive scenario uses the illustrative plan above, with overage off by default. Existing usage and queued reservations both consume allowance; the cap covers total overage, not merely the next send. Integer-cent calculations reject invalid, fractional segment and unsafe values. Blocked scenarios still show their hypothetical full cost, explicitly labelled as unauthorized.

This page does not establish a subscription, take payment, persist a billing preference, or gate simulated sending. The pure quote function can be reused behind authenticated server endpoints, but does not implement transactional reservations, a ledger, entitlements or provider integration. These remain prerequisites for paid sending.
