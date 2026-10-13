# RosterCast decisions

## Confirmed on 12 October 2026

- Owner: Matt Elgie. The product is intended to be marketed to other organizations.
- First pilot: APFFA IAFF Local 4778, approximately 85–100 members, 4–5 announcements monthly.
- SMS provider: Twilio. One business-owned parent account, customer subaccounts, and a dedicated verified toll-free number per local.
- Use “Announcement” in the interface. No member app or member login is needed to receive SMS.
- Start with CSV imports, separate organization data, one-way announcements, mandatory opt-out handling, previews, delivery history, and usage reporting.
- Plan a subscription and paid-access system now; integrate actual charging after the secure backend and reliable SMS workflow exist.

## Commercial recommendations awaiting decisions

- Stripe Billing with hosted Checkout and customer portal.
- One subscription per organization: monthly platform fee, included SMS segments, and explicitly authorized overage.
- Per-organization usage caps, visible remaining allowance and additional cost before sending.
- Monthly payments first; annual plans, tiers, prices, trial duration and grace periods remain open.
- Simulated delivery is non-billable. Never store card numbers in RosterCast.

## Current milestone

The existing browser prototype now supports composer → test preview → recipient review → confirmed simulated delivery → immutable history. A Usage & billing page now reports simulated activity and demonstrates included allowances and capped overage using unapproved example prices. It is device-local and uses fictional contacts. It does not establish secure authentication or production tenant isolation.

## Production dependencies

Business structure/domain; backend/database hosting; real authentication and server-side roles; Twilio account/subaccounts; sender verification; consent records; signed webhooks; durable sending worker; usage ledger and entitlements; backup recovery; subscription terms and tax configuration.

Do not enable real sends or payments until the relevant milestones are complete and a specific live pilot send is authorized.
