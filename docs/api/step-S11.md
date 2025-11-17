# Step S11 – Document Actions & Validation

Milestone D3 exposes the canonical document CRUD endpoints that enforce the permission model introduced in D2. These endpoints are consumed by the editor shell (body autosave, metadata panels, delete flows) and must guarantee optimistic locking plus hooks for future plan enforcement.

- **OpenAPI:** `docs/api/openapi/step-S11.yaml`
- **Prerequisites:** Steps S9–S10 deployed so folders, metadata, and permission checks exist.

## Resources

### DocumentView
| Field | Type | Notes |
|-------|------|-------|
| `document` | `DocumentResource` | Same schema defined in S9, now including `workspaceDefaultAccess` + `workspaceEditorsAdminOnly`. |
| `revision` | `DocumentRevisionResource` | Latest revision snapshot (version/content/summary/timestamps). |

### RevisionList
```
{
  "documentId": "uuid",
  "items": [DocumentRevisionResource],
  "limit": 20
}
```

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/documents/{documentId}` | Return metadata + latest revision if requester can view. |
| `PATCH` | `/api/documents/{documentId}` | Update title/summary/folder/status/visibility with optimistic locking. |
| `DELETE` | `/api/documents/{documentId}` | Soft delete document (owner/admin/document-owner). |
| `GET` | `/api/documents/{documentId}/revisions` | List recent revisions (default 20). |

> Note: `/api/workspaces/{workspaceId}/documents` (create/list) and `/api/documents/{documentId}/revisions` POST were introduced in S9. S11 builds on those primitives and does not duplicate creation logic.

## Endpoint Details

### GET /api/documents/{documentId}
- **Auth:** DocumentAccessService.assertCanView (owner/admin/document owner + members with viewer/commenter/editor rights).
- **Response:** `200 OK` with `DocumentView` payload.
- **Errors:** `403` when requester lacks view permission, `404` when document missing/deleted.

### PATCH /api/documents/{documentId}
- **Auth:** DocumentAccessService.assertCanEdit (owner/admin/document owner or members granted `editor`).
- **Body:**
```json
{
  "title": "New title?",
  "summary": "short text",
  "status": "draft|published|archived",
  "visibility": "private|workspace|shared|public",
  "folderId": "uuid|null",
  "sortOrder": 10,
  "expectedUpdatedAt": "2025-11-17T09:10:11.123Z"
}
```
- Requires at least one mutable field plus `expectedUpdatedAt`. Server compares the ISO timestamp against the current `updatedAt` column; if mismatch, returns `409 Conflict` with error code `document_conflict`.
- Validates folder existence (same workspace, not deleted) before moving.
- **Responses:** `200 OK` with updated `DocumentResource`.
- **Errors:** `400` validation failure, `403` insufficient rights, `404` document/folder missing, `409` optimistic locking conflict.

### DELETE /api/documents/{documentId}
- **Auth:** Workspace owner, admin, or the membership recorded as `owner_membership_id`.
- **Behavior:** Sets `deleted_at` timestamp; revisions remain for auditing.
- **Response:** `204 No Content`.
- **Errors:** `403` insufficient rights, `404` document missing.

### GET /api/documents/{documentId}/revisions
- **Auth:** DocumentAccessService.assertCanView.
- **Query:** `limit` (optional, default 20, max 100).
- **Response:** `200 OK` with `RevisionList` sorted by `version` desc.
- **Errors:** `403` insufficient rights, `404` document missing.

## Validation & Plan Hooks
- All edit/delete operations call `DocumentPlanLimitService.assertDocumentEditAllowed(workspaceId)` so plan-aware logic can be injected later (enterprise seats, storage caps). Creation already calls `assertDocumentCreateAllowed` via S9 services.
- Input schemas enforce string length, status/visibility enums, and valid UUIDs.
- Delete is idempotent (repeated DELETE on an already deleted document returns `204`).

## Testing Strategy
Vitest coverage lives under `tests/backend/documents`:
1. `documentActionService.spec.ts`
   - viewer can fetch metadata/revision.
   - editor update succeeds and plan hook triggered; stale `expectedUpdatedAt` throws `DocumentUpdateConflictError` (maps to 409).
   - delete allowed for owner/admin, rejected for regular member.
   - revision listing respects view permissions.
2. `documentAccessService.spec.ts` exercises permission evaluation when defaults or ACLs change (viewer/commenter/editor levels).
3. Existing suites (`documentService`, `documentPermissionService`) cover creation + workspace default mutations.

All tests must pass (`npm run test`) before shipping D3 so later milestones can rely on stable document CRUD semantics.
