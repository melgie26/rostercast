# Airdrie Workspace access

## Authorized identity sources

- Hosted domain: `airdriefirefighters.com`
- Executive Board: `exec@airdriefirefighters.com`
- Stewards: `stewards@airdriefirefighters.com`

Because the executive group is nested inside the stewards group, role resolution checks the executive group first. Executive membership yields `board_admin`; otherwise steward-group membership yields `steward`. Other domain members receive no administrative access.

## Permissions

| Action | Executive Board | Steward | Member at large |
| --- | --- | --- | --- |
| View administrative application | Yes | Yes | No |
| Create and edit drafts | Yes | Yes | No |
| Submit for approval | Yes | Yes | No |
| Approve or reject | Yes | No | No |
| Send | Yes | No | No |

The workflow is `draft → pending_approval → approved → sent`. Rejection records the board member and reason. Approval and sending record the responsible board member in an append-only audit trail.

## Production connection required

The current GitHub Pages build demonstrates these rules but does not provide a security boundary. Production requires:

1. Google OpenID Connect sign-in restricted to `airdriefirefighters.com`.
2. Server-side verification of the Google ID token, issuer, audience, expiry, and hosted-domain claim.
3. Server-side membership lookup for both Google Groups. Browser-supplied group claims must not be trusted.
4. A service account with Google Workspace domain-wide delegation and the minimum read-only group-membership scope, approved by a Workspace super administrator.
5. Server-side sessions and a shared database for announcements, approvals, deliveries, and audit events.
6. Authorization on every write endpoint; hiding UI controls is not sufficient.

OAuth client IDs and service-account credentials must be configured as hosted secrets and must never be committed to this public repository or delivered to browser code.

