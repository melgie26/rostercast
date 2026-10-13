# Account backend deployment

## What is implemented

The Node 24 account service supports invite-only email-code sign-in, sign-out, encrypted HTTP-only sessions, organisation selection, shared contact create/edit/deactivation and group creation. It uses Supabase Auth and PostgreSQL through a pinned official SDK. The same user JWT reaches the database; a service-role key is neither needed nor accepted. Permissions are checked both by the server and database row-level security.

This is a separate account application, not a security wrapper around the device-local demo. The GitHub Pages demonstration still uses fictional browser data. It is not automatically imported into production. No SMS, subscription charging, CSV import, group assignment or verified consent capture is enabled in the account app yet.

Hosting has not been provisioned. Local PostgreSQL tests emulate Supabase's auth claims/session tables, and provider SDK tests use mocked responses. Those tests do not establish that a hosted Supabase project has been configured correctly. Complete the hosted checks below before using real member information.

## Owner setup

1. Create a **new, empty Supabase project in Matt's business-owned account**. Choose Canada Central if available and appropriate for the hosting arrangement; this alone does not guarantee all downstream services/logs stay in Canada. Retain ownership, billing and recovery access. Never use an APFFA-owned account for the platform parent project.
2. Apply `supabase/migrations/202610130001_accounts.sql` to that project through a controlled migration or the SQL editor. The migration deliberately fails on existing tables of the same name; do not apply it casually to another application's project.
3. In Authentication, disable public sign-up. Enable email authentication and configure the email template to show `{{ .Token }}` as the sign-in code rather than only a magic link. Use a production mail provider under platform ownership. Set the site URL to the final account application's HTTPS origin and use exact allowed redirects. Configure provider abuse limits and confirm invite-only behaviour; `shouldCreateUser: false` is also enforced by the API.
4. Create Matt's Auth user through the dashboard, then copy its user UUID. Use the controlled SQL below to create the first organisation and its administrator. Do not put role/organisation access in user-editable metadata. Add future users and memberships through owner-controlled operations until an audited provisioning API is built.
5. Deploy this repository's Node service to a business-owned host that supports Node 24 or the supplied Dockerfile. Set the start command to `npm start`. GitHub Pages cannot run this service. Keep the static demo at its existing URL; use a separate account origin during rollout.
6. Set the environment variables from `.env.example` in the host's secret/settings panel. Use the Supabase **publishable** key (`sb_publishable_...`), not a secret or service-role key. Generate a random 32-byte `SESSION_KEY_HEX`. Set `APP_ORIGIN` to the exact HTTPS origin with no path or trailing slash. Expose `/health` as a health check; `accounts_ready: true` means configuration is present, not that all hosted integrations were verified.
7. Serve the page and API through the same origin. Configure TLS and an ingress with shared request/OTP limits. The in-process rate limit is intentionally conservative and does not trust forwarded IP headers; behind a proxy it may treat all customers as one client. Replace/augment it with correctly configured shared ingress limits before multi-instance use.

Do not paste private keys, cookies, one-time codes or session tokens into chat, source files or GitHub. The example file contains placeholders only. Rotating the session key invalidates existing app cookies.

## Controlled first-organisation provisioning

Replace the user UUID before executing. The generated organisation UUID is returned by the insert. Keep these administrative operations off the browser/API.

```sql
begin;
with organization as (
  insert into public.organizations(name, short_name)
  values ('Airdrie Professional Firefighters Association', 'APFFA')
  returning id
)
insert into public.organization_users(organization_id, user_id, role)
select id, 'REPLACE-WITH-MATTS-AUTH-USER-UUID'::uuid, 'organization_admin'
from organization;
commit;
```

Membership changes, contact writes, groups and settings are recorded in an append-only audit table accessible to organisation administrators. Audit entries contain field names, actor and entity identifiers, not copies of contact data. The owner can deactivate memberships or pause organisations through controlled SQL. Those changes block database access immediately. Database policies also require the JWT's provider session to remain in `auth.sessions`, closing access after that session is removed. Confirm Supabase's actual sign-out/session behaviour during hosted testing.

## Local verification

```bash
npm ci
npm test
npx playwright install --with-deps chromium
npm run test:browser
npm start
```

Without environment configuration, the local server shows setup pending and rejects account operations. For local configured development, use `NODE_ENV=development`, `APP_ORIGIN=http://localhost:3000` and the appropriate project settings. Development cookies omit Secure only on a localhost origin. Production refuses to start with missing/unsafe settings. HTTP session lifetime is at most one hour; the initial implementation deliberately requires another email code instead of storing a provider refresh token.

Tests exercise the actual application migration in an embedded PostgreSQL engine, HTTP endpoints and crypto cookies. Browser smoke tests use a mocked auth/database gateway with fictional records and include the existing billing/announcement demo. CI runs both suites. They do not send emails or access a real customer's data.

## Hosted acceptance before pilot data

- Verify email delivery, code expiry/reuse and disabled self-registration using controlled test accounts.
- Use two organisations and admin/viewer accounts. Confirm roster isolation via both the API and direct Supabase client requests; viewers must not write. Forged organisation fields and role metadata must not grant access.
- Verify a second device sees saved contacts/groups, then test sign-out, expired cookie, deactivated membership and paused organisation. Confirm remaining JWTs lose data access once the provider session is removed.
- Check the configured origin, Secure/HttpOnly/SameSite cookie, HTTPS, CSP, no-store responses and ingress limits. Confirm hosts/logs do not capture personal data, cookies, codes or JWTs.
- Test database backup restoration, owner recovery, retention/export procedures and audit access before loading real member data.

Contact edits cannot set consent or clear an opt-out. New records start at unknown consent, and changing a subscribed phone number resets consent to unknown. Opted-out phone numbers remain in a separate suppression table. Complete an evidence-backed consent workflow and inbound STOP handling before sending is enabled. Sending/billing APIs must retain their own transaction, entitlement and reservation checks; roster access does not grant paid sending.

## Alberta reporting time note

CI's newer time-zone data exposed an obsolete winter-time assertion in the earlier billing prototype. Alberta stays on UTC−6 when the former 1 November 2026 fall transition would occur. Reporting and historical-detail formatting now explicitly apply UTC−6 from that point, including on browsers with older IANA data; dates before it retain America/Edmonton historical rules. The dashboard uses the same reporting-month helper as Usage & billing. Future region expansion should make the reporting zone an organisation setting and keep subscription-cycle accounting separate.

Sources checked 12 October 2026: [Alberta Utilities Commission Bulletin 2026-11](https://media.auc.ab.ca/prd-wp-uploads/News/2026/Bulletin%202026-11.pdf) and [Microsoft's Alberta time-zone guidance](https://techcommunity.microsoft.com/blog/dstblog/interim-guidance-for-alberta-time-zone-changes-2026/4545015).
