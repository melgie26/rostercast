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

1. Email-code authentication restricted to `airdriefirefighters.com`; this is implemented in the account backend through Supabase Auth.
2. Server-side membership lookup for both Google Groups; this is implemented through the Admin SDK Directory API. Browser-supplied group claims are never trusted.
3. A service account with Google Workspace domain-wide delegation and the minimum read-only group-membership scope, approved by a Workspace super administrator. Hosted configuration is still required.
4. Server-side encrypted sessions and shared PostgreSQL storage; the foundation is implemented, but hosting and production acceptance remain outstanding.
5. Authorization on every write endpoint; hiding UI controls is not sufficient. Board roster writes are now checked against both database membership and the verified Workspace role.

Service-account credentials must be configured as hosted secrets and must never be committed to this public repository or delivered to browser code.

