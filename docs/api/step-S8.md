
# Step S8 – Role Transitions & Ownership Transfer

Milestone C3 implements role management (owner/admin/member) and ownership transfer safeguards.

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/workspaces/{workspaceId}/transfer-ownership` | Owner selects new owner (requires confirmation). |
| `PATCH` | `/api/workspaces/{workspaceId}/members/{membershipId}/role` | Owner/Admin change role. |
| `POST` | `/api/workspaces/{workspaceId}/members/{membershipId}/leave` | Member self-removal. |
| `POST` | `/api/workspaces/{workspaceId}/owner/leave` | Owner leaves after transfer/delete. |

## Rules
- Ownership transfer:
  - Only current owner can initiate; target must be active admin/member.
  - Confirmation requires both parties (owner initiates, target accepts). Optionally email confirmation.
  - After transfer, previous owner becomes admin.
- Role changes:
  - Owner can promote/demote admins/members; Admin can demote members only.
  - Cannot remove or demote owner without transfer flow.
- Leaving:
  - Members can leave; if last admin leaving → guard to avoid ownerless workspace.
  - Owner leave requires transfer or workspace deletion.
- Audit logging: every role change/transfer recorded (schema defined in future milestone, but API returns `auditId`).

## Tests
- Transfer flow success/failure (target invalid, target declines).
- Role change permissions enforced (admin cannot promote to admin/owner).
- Member leave removes membership; owner leave blocked without transfer.
