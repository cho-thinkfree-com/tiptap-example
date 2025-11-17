# Step S12 – Share Links (View/Comment)

Milestone E1 enables workspace members to generate external-friendly share links that grant view or comment access to a document. Share links may have optional passwords and expirations, and they can be revoked anytime. This step focuses on anonymous access; editing share links and guest collaborators arrive in E2.

- **OpenAPI:** `docs/api/openapi/step-S12.yaml`
- **Dependencies:** Steps S9–S11 (documents + internal ACL + CRUD) must already be deployed.

## Concepts

### ShareLinkResource
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Server identifier returned to managers. |
| `token` | string | Public token appended to share URLs. Only returned at creation time; later queries redact it. |
| `documentId` | UUID | Linked document. |
| `accessLevel` | `viewer|commenter` | Determines allowed operations. |
| `expiresAt` | ISO datetime? | Optional expiration. `null` = never. |
| `passwordProtected` | boolean | Indicates whether password is required. |
| `revokedAt` | ISO datetime? | Non-null when link has been disabled. |
| `allowExternalEdit` | boolean | Controls whether guests can request edit rights (managed via Step S13). |
| `createdAt` / `createdByMembershipId` | metadata. |

### ShareLinkAccessResponse
```
{
  "documentId": "uuid",
  "accessLevel": "viewer|commenter",
  "workspaceId": "uuid",
  "token": "public-token"
}
```
Returned when the token/password pair is valid; clients use it to fetch the document via `/api/share-links/{token}/document` (implemented later) or to request view/comment permissions in the editor shell.

## Manager Endpoints (auth required)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/documents/{documentId}/share-links` | List active share links (owner/admin/document-owner). |
| `POST` | `/api/documents/{documentId}/share-links` | Create link with access level/password/expiration. |
| `DELETE` | `/api/share-links/{shareLinkId}` | Revoke link (soft delete). |

## Public Endpoint (no auth)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/share-links/{token}/access` | Validate token/password and return access payload (view/comment). |

## Manager Endpoint Details

### GET /api/documents/{documentId}/share-links
- **Auth:** workspace owner/admin or document owner membership.
- **Response:**
```json
{
  "shareLinks": ShareLinkResource[]
}
```
(Default listing excludes `token` values; only hashed storage is kept.)

### POST /api/documents/{documentId}/share-links
- **Auth:** same as GET.
- **Body:**
```json
{
  "accessLevel": "viewer|commenter",
  "expiresAt": "2025-12-31T23:59:59Z",
  "password": "optional-password"
}
```
- **Behavior:**
  - Generates unique `token` (16+ chars) and stores Argon2 hash when `password` provided.
  - Rejects `expiresAt` in the past (`400`).
  - Creates entry with `revokedAt=null`.
- **Responses:** `201 Created` with `{ "shareLink": ShareLinkResource, "token": "plaintext" }` (token only appears here).

### DELETE /api/share-links/{shareLinkId}
- **Auth:** same manager rule.
- **Response:** `204 No Content`.
- **Errors:** `403` when requester not authorized, `404` when link missing.

## Public Endpoint Details

### POST /api/share-links/{token}/access
- **Auth:** none.
- **Body:** `{ "password": "..." }` (optional when password not set).
- **Behavior:**
  - Looks up share link by token where `revokedAt IS NULL` and (if `expiresAt` set) time not expired.
  - When password protected, verifies password hash; `401` if mismatch.
  - Returns `ShareLinkAccessResponse` so FE can fetch document via future endpoints.
- **Errors:**
  - `404` when token missing/expired/revoked.
  - `401` `share_link_password_required` when password missing/incorrect.

## Tests (Vitest)
1. Manager can create/view/revoke share links; token returned only once; password hashed.
2. Unauthorized members cannot manage share links.
3. Public access with valid token returns access level; bad password or expired links reject appropriately.
4. Revoked links are excluded from listing and unreachable via token.

These tests, plus existing document ACL specs, must pass via `npm run test` before closing E1.
