# Step S9 – Folder & Document Metadata

Milestone D1 defines the first persistence layer for workspace file trees and document metadata so future permission layers (D2+) can rely on stable IDs and revision history. All endpoints require Bearer auth + active workspace membership.

- **OpenAPI source:** `docs/api/openapi/step-S9.yaml` (rendered via `npm run docs:api`).
- **Primary roles:** create/update/move/delete folders restricted to owner/admin; document CRUD allowed for any active member; revision writes require the membership that is editing.

## Resources

### FolderResource
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Stable server-generated ID. |
| `workspaceId` | UUID | Must match path parameter. |
| `parentId` | UUID? | Null for root. Validated to prevent cycles. |
| `name` | string (1-80) | Trimmed, unique per parent for UX warning (backend enforces case-insensitive compare when validating). |
| `path` | string | Cached breadcrumb text (e.g., `Projects/Q1/Docs`). Updated when parent/name changes. |
| `sortOrder` | integer | Default 0. Allows FE to order siblings. |
| `createdAt`/`updatedAt` | ISO date | Audit fields. |

### DocumentResource
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (internal index) | Never exposed as friendly slug. |
| `workspaceId` | UUID | Workspace scope. |
| `folderId` | UUID? | Null for root-level docs. Must reference folder in same workspace. |
| `title` | string (1-160) | Display title. |
| `slug` | string | URL slug unique within workspace. Auto-generated from title unless provided. |
| `status` | `draft|published|archived` | Default `draft`. |
| `visibility` | `private|workspace|shared|public` | D1 only stores this column; enforcement handled by D2. |
| `ownerMembershipId` | UUID | References workspace membership row. |
| `summary` | string? | Optional short description (<= 280 chars). |
| `sortOrder` | integer | Default 0 for ordering inside folder. |
| `workspaceDefaultAccess` | `none|viewer|commenter|editor` | Controls workspace-wide fallback role (default `none`, configured via Step S10 APIs). |
| `workspaceEditorsAdminOnly` | boolean | When true and default access grants `editor`, only owner/admin memberships keep editor rights (members fall back to viewer). |
| `createdAt`/`updatedAt`/`deletedAt?` | ISO date | Soft-delete only. |

### DocumentRevisionResource
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID |
| `documentId` | UUID |
| `version` | int | Sequential starting at 1. Unique per document. |
| `content` | JSON | Raw TipTap JSON structure. Validated to be object/array. |
| `createdByMembershipId` | UUID | Editor membership. |
| `createdAt` | ISO date |

## Endpoint Summary
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/workspaces/{workspaceId}/folders` | List folder tree (flat array with parent references). |
| `POST` | `/api/workspaces/{workspaceId}/folders` | Create folder under workspace or parent. |
| `PATCH` | `/api/folders/{folderId}` | Rename folder or update sort order. |
| `POST` | `/api/folders/{folderId}/move` | Move folder to new parent, reordering siblings. |
| `DELETE` | `/api/folders/{folderId}` | Soft-delete folder (documents are moved to parent). |
| `GET` | `/api/workspaces/{workspaceId}/documents` | List document metadata (filter by folder). |
| `POST` | `/api/workspaces/{workspaceId}/documents` | Create metadata + optional initial revision. |
| `PATCH` | `/api/documents/{documentId}` | Update metadata (title/slug/status/folder/summary/sortOrder). |
| `POST` | `/api/documents/{documentId}/revisions` | Append revision with JSON payload. |
| `GET` | `/api/documents/{documentId}/revisions/latest` | Fetch latest revision + metadata.

## Endpoint Details

### GET /api/workspaces/{workspaceId}/folders
- **Auth:** owner/admin/member.
- **Query:** `?includeDeleted=false` (default false) for admin diagnostics.
- **Response:** `200 OK` with `{ "folders": FolderResource[] }` sorted by `sortOrder` then `name`.
- **Errors:** `404` if workspace missing or requester not member.

### POST /api/workspaces/{workspaceId}/folders
- **Body:** `{ "name": string, "parentId?": uuid, "sortOrder?": int }`.
- Validates parent belongs to workspace and requester is owner/admin.
- Sets `path` derived from parent path + name.
- Returns `201 Created` with folder payload.
- Errors:
  - `400` invalid name or depth > 8 levels.
  - `403` when requester lacks admin rights.
  - `404` parent not found / workspace missing.

### PATCH /api/folders/{folderId}
- Rename or update `sortOrder`.
- **Body:** `{ "name?": string, "sortOrder?": int }` (at least one field).
- Updates `path` and descendant paths when `name` changes.
- **Responses:** `200 OK` with updated folder.
- **Errors:** `400` invalid data, `403` insufficient role, `404` folder outside requester workspace.

### POST /api/folders/{folderId}/move
- **Body:** `{ "parentId": uuid|null, "sortOrder?": int }`.
- Moves folder to new parent (null moves to root). Prevents cycles by checking ancestry.
- Recomputes `path` for folder + descendants, updates `sortOrder`.
- **Responses:** `200 OK` with folder summary.
- **Errors:** `400` when attempting to move under descendant, `403` unauthorized, `404` folder or parent missing.

### DELETE /api/folders/{folderId}
- Soft deletes folder (sets `deletedAt`). Documents under deleted folder are reassigned to deleted folder’s parent (or root if parent missing) before deletion completes.
- Only owner/admin allowed.
- **Response:** `204 No Content`.
- **Errors:** `404` missing, `409` when folder still contains protected subfolders (future feature placeholder).

### GET /api/workspaces/{workspaceId}/documents
- **Query params:** `folderId?`, `status?`, `visibility?`, `search?` (title substring) to help FE tree panels.
- Returns `200` with `{ "documents": DocumentResource[], "folders": FolderResource[] }` to hydrate FE tree in one call.

### POST /api/workspaces/{workspaceId}/documents
- **Body:**
```json
{
  "title": "Doc Title",
  "folderId": "uuid?",
  "slug": "optional-custom-slug",
  "visibility": "private|workspace|shared|public",
  "status": "draft|published|archived",
  "summary": "optional",
  "sortOrder": 0,
  "initialRevision": {
    "content": {"type": "doc", "content": []}
  }
}
```
- OwnerMembership defaults to the requester’s membership ID.
- Server auto-generates slug from title using `ensureUniqueSlug` if not provided.
- Creates optional initial revision (version=1) when `initialRevision` supplied; otherwise document exists without content until first revision call.
- **Responses:** `201 Created` with document payload + `revisionVersion` when created.
- **Errors:** `400` invalid payload, `403` requester not active member, `404` folder missing, `409` slug collision.

### PATCH /api/documents/{documentId}
- Allows updating `title`, `slug`, `folderId`, `status`, `visibility`, `summary`, `sortOrder`.
- Slug validation reuses workspace uniqueness; folder updates ensure workspace match.
- **Response:** `200 OK` with updated metadata.
- **Errors:** `400` invalid, `403` when requester lacks permission (non-member or document deleted), `404` doc missing.

### POST /api/documents/{documentId}/revisions
- **Body:** `{ "content": TipTapJSON, "summary?": string }`.
- Appends new revision with `version = latest + 1` (start at 1). Requires requester to be active member of workspace.
- **Response:** `201 Created` with `{ "revision": DocumentRevisionResource }`.
- **Errors:** `400` invalid JSON (must be object/array), `403` unauthorized, `404` doc missing/deleted.

### GET /api/documents/{documentId}/revisions/latest
- Returns the newest revision and metadata snapshot.
- **Response:** `200 OK` with `{ "revision": DocumentRevisionResource, "document": DocumentResource }`.
- **Errors:** `404` when no revisions exist or doc missing.

## Validation & Notes
- Folder depth hard limit 8 levels for now (configurable). Additional guard ensures a workspace cannot exceed 500 folders until quotas implemented.
- `sortOrder` stored as signed 32-bit integer to allow FE drag/drop insert algorithms.
- Document titles trimmed; duplicates allowed but slug must remain unique. When slug omitted, generator appends numeric suffix on collision.
- Revision payload stored verbatim JSON; future collaborative engine can store CRDT snapshots in same column because we preserve JSON.
- All timestamps stored as UTC (`DateTime` in Prisma) and FE receives ISO-8601.

## Test Matrix (Vitest)
1. **Folder nesting**: create root + child + grandchild, verify `path` strings and parent references.
2. **Move operations**: move child under different parent, ensure descendants inherit new path, and cycle prevention throws `400`.
3. **Document creation**: rejects non-members, creates slug + metadata + optional revision.
4. **Document update**: changing title/folder/visibility persists and respects folder existence.
5. **Revision append/retrieve**: appending multiple revisions increments version; latest endpoint returns newest content.
6. **Soft delete behavior**: deleting folder reassigns documents to parent; listing excludes soft-deleted folders unless `includeDeleted=true`.
7. **Search filters**: listing documents with `folderId` filter only returns matches and ignores deleted docs.

Passing this suite is mandatory before moving to D2 because DocumentPermission logic builds on these storage invariants.
