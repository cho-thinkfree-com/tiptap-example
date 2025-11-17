# Step S10 – Document Permissions (Internal)

Milestone D2 adds explicit ACL controls so owners/admins (and document owners) can grant or revoke access inside a workspace. It also defines the runtime permission evaluator used by all future document APIs.

- **OpenAPI source:** `docs/api/openapi/step-S10.yaml` (rendered via `npm run docs:api`).
- **Primary actors:** workspace owner/admin, document owner (membership on the document), regular members requesting access.
- **Dependency:** Step S9 (folders/documents) must be deployed so document IDs and metadata already exist.

## Resources

### DocumentPermissionResource
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Unique identifier per ACL entry. |
| `documentId` | UUID | Target document. |
| `principalType` | `workspace|membership|account|share_link` | Milestone D2 uses `membership`; other types reserved for sharing milestones. |
| `principalId` | string | Identifies the principal (membership ID when `principalType=membership`). |
| `role` | `viewer|commenter|editor` | Highest capability granted by this entry. |
| `membership` | object | Present when `principalType=membership`; includes `membershipId`, `displayName`, `role` (owner/admin/member). |
| `createdAt`/`updatedAt` | ISO date | Audit timestamps. |

### DocumentWorkspaceAccess
| Value | Meaning |
|-------|---------|
| `none` | Workspace members rely on explicit ACL entries. |
| `viewer` | All active members can view (read-only). |
| `commenter` | Members can view + comment; editing still requires ACL/editor role. |
| `editor` | Members can edit unless `workspaceEditorsAdminOnly` is true. |

### Permission Summary Response
```
{
  "documentId": "uuid",
  "workspaceDefaultAccess": "none|viewer|commenter|editor",
  "workspaceEditorsAdminOnly": true,
  "grants": [DocumentPermissionResource]
}
```

## Endpoint Summary
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/documents/{documentId}/permissions` | Owner/admin/document-owner lists explicit ACL entries. |
| `POST` | `/api/documents/{documentId}/permissions` | Upsert a permission (currently membership principals). |
| `DELETE` | `/api/documents/{documentId}/permissions/{permissionId}` | Remove an ACL entry. |
| `PATCH` | `/api/documents/{documentId}/workspace-access` | Update workspace-default access + admin-only editor flag. |
| `GET` | `/api/documents/{documentId}/permissions/summary` | Anyone with view rights fetches summarized ACL data for the toolbar.

## Endpoint Details

### GET /api/documents/{documentId}/permissions
- **Auth:** workspace owner/admin or membership that owns the document (`owner_membership_id`).
- **Response:**
```json
{
  "documentId": "...",
  "workspaceDefaultAccess": "viewer",
  "workspaceEditorsAdminOnly": false,
  "permissions": [DocumentPermissionResource]
}
```
- **Errors:** `403` when requester lacks manage rights, `404` when document missing.

### POST /api/documents/{documentId}/permissions
- **Auth:** same as GET.
- **Body:**
```json
{
  "principalType": "membership",
  "principalId": "membership-uuid",
  "role": "editor"
}
```
- **Behavior:** upserts the entry (subsequent POST with same principal updates `role`). Skips already-removed memberships.
- **Responses:** `201 Created` with `{ "permission": DocumentPermissionResource }`.
- **Errors:**
  - `400` invalid payload or unsupported `principalType`.
  - `403` insufficient rights.
  - `404` document or membership not found.

### DELETE /api/documents/{documentId}/permissions/{permissionId}
- **Auth:** owner/admin/document-owner.
- **Response:** `204 No Content`.
- **Errors:** `403` insufficient rights, `404` when permission or document missing.

### PATCH /api/documents/{documentId}/workspace-access
- **Auth:** owner/admin/document-owner.
- **Body:** `{ "defaultAccess": "none|viewer|commenter|editor", "editorsAdminOnly": true }` (at least one field required).
- **Rules:**
  - `defaultAccess="editor"` + `editorsAdminOnly=true` restricts edit rights to owner/admin roles even though the workspace default is editor.
  - Lowering to `none` immediately revokes workspace-wide view rights (members still need explicit grants).
- **Responses:** `200 OK` with updated `{ "document": DocumentResource }` snapshot.

### GET /api/documents/{documentId}/permissions/summary
- **Auth:** any member who can currently view the document (permission evaluator used internally).
- **Response:** same shape as GET `/permissions` but omits internal-only metadata and may redact emails if needed.
- **Errors:** `403` when viewer rights missing, `404` when document missing.

## Permission Evaluation Service
- `DocumentAccessService` consumes Document, WorkspaceMembership, DocumentPermission rows to compute the effective role (`viewer|commenter|editor|owner`).
- Evaluation order:
  1. Workspace owners/admins always receive `editor` (owner) rights unless a future `locked_by_owner` flag is set.
  2. Document owner (creator) inherits `owner` role regardless of workspace role.
  3. Explicit ACL entries override workspace defaults (highest role wins).
  4. Workspace defaults (`workspaceDefaultAccess`) apply when `visibility=workspace`; editor defaults honor the `workspaceEditorsAdminOnly` flag.
  5. Private/shared documents fall back to explicit ACL; public documents grant `viewer` to all members but still require ACL for edit/comment.
- `DocumentAccessService.assertCanView/Edit` is required before any document read/write endpoint executes.

## Tests (Vitest)
1. **Default access cascades:** workspace-default `viewer` allows members to read; switching to `none` revokes view rights until ACL added.
2. **Admin-only editors:** with `defaultAccess=editor` and `editorsAdminOnly=true`, admins edit but members fall back to viewer.
3. **Explicit grants:** granting `editor` overrides private/shared visibility; revoking removes access.
4. **ACL management auth:** only owner/admin/document-owner can POST/DELETE/PATCH; other members receive `MembershipAccessDeniedError`.
5. **Summary visibility:** members with viewer rights can GET summary; unauthorized users receive `DocumentAccessDeniedError`.

Passing these tests is required before advancing to Milestone D3.
