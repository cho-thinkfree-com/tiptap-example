# Step S6 – Workspace Membership Model

Milestone C1 introduces the `WorkspaceMembership` model and API to view workspace members, invite/pending statuses, and role assignments (owner/admin/member).

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/workspaces/{workspaceId}/members` | List members with roles/status. |
| `POST` | `/api/workspaces/{workspaceId}/members` | Add member (owner/admin only). |
| `PATCH` | `/api/workspaces/{workspaceId}/members/{membershipId}` | Update role or status (owner/admin). |
| `DELETE` | `/api/workspaces/{workspaceId}/members/{membershipId}` | Remove member (owner/admin). |

## Schema
- `WorkspaceMembership` table: `id`, `workspace_id`, `account_id`, `role` (enum), `status` (`active|invited|pending|removed`), `display_name`, `avatar_url`, `timezone`, `preferred_locale`, `notification_settings`, timestamps.
- Unique constraint on `(workspace_id, account_id)` for active statuses.
- Owner uniqueness enforced: exactly one `owner` per workspace.

## Validation rules
- Only `owner`/`admin` may list or mutate memberships; `member` can only view.
- Owner role cannot be demoted/deleted unless transferring ownership.
- `role` transitions:
  - owner → (transfer) new owner promoted, previous owner demoted to admin.
  - admin/member role changes allowed but only by owner (for admin) or owner/admin(for member).
- `status` transitions:
  - `invited` → `active` on acceptance.
  - `pending` join requests require approval.
  - `removed` indicates explicit removal (soft state).

## Tests (service layer)
- Create membership ensures uniqueness.
- Listing returns sorted active members (owner first).
- Role change enforces owner guard.
- Removing member updates status, prevents duplicate entries.
- Profile updates (display name/timezone/preferred locale) stored per membership.
