
# Step S7 – Invitations & Join Requests

Milestone C2 covers workspace invitations, domain allowlists, and join-request approvals.

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workspaces/{workspaceId}/invitations` | Owner/Admin send invitation emails. |
| `POST` | `/api/workspaces/{workspaceId}/invitations/{invitationId}/resend` | Resend invitation email. |
| `DELETE` | `/api/workspaces/{workspaceId}/invitations/{invitationId}` | Cancel invitation. |
| `POST` | `/api/invitations/{token}/accept` | Accept invitation token (anonymous). |
| `POST` | `/api/workspaces/{workspaceId}/join-requests` | Member requests to join (public/listed). |
| `POST` | `/api/workspaces/{workspaceId}/join-requests/{requestId}/approve` | Owner/Admin approve. |
| `POST` | `/api/workspaces/{workspaceId}/join-requests/{requestId}/deny` | Owner/Admin deny. |
| `PUT` | `/api/workspaces/{workspaceId}/allowlist` | Update domain allowlist (owner only). |

## Models
- `WorkspaceInvitation`: `id`, `workspace_id`, `email`, `token_hash`, `status (pending|accepted|cancelled|expired)`, `invited_by`, `expires_at`, `created_at`, `resent_count`.
- `WorkspaceJoinRequest`: `id`, `workspace_id`, `account_id`, `status (pending|approved|denied)`, `message`, timestamps.
- Domain allowlist stored on `Workspace` as array/JSON (`allowed_domains`).

## Validation rules
- Invitations:
  - Owner/Admin only.
  - Email normalized; if domain matches allowlist → auto-add membership without invitation.
  - Max 5 active invitations per email/workspace; throttle resend (e.g., once per minute).
  - Token expiry default 7 days.
  - Accepting token requires account login; membership created with `status=active`.
- Join requests:
  - Allowed only when workspace visibility `listed|public`.
  - Pending requests limited per account; duplicate pending denied.
  - Approve converts to membership; deny records reason.
- Domain allowlist:
  - Must be valid domain strings; persisted as lowercase.

## Tests (service level)
- Creating invitation stores token hash, prevents duplicates, handles allowlist auto-join.
- Resend updates `resent_count` and enforces throttle.
- Accept token creates membership & marks invitation accepted; invalid/expired token fails.
- Join request create/approve/deny flows, blocking duplicates and enforcing visibility.
- Domain allowlist update ensures normalization and immediate auto-join for matching emails.
