# Step S14 – Audit Logging

Milestone F1 introduces workspace-scoped audit logs to capture sensitive operations (role changes, document/share link mutations, external collaborator access). The goal is to expose a read-only API so admins can review historical actions and trace security incidents.

- **OpenAPI file:** `docs/api/openapi/step-S14.yaml`
- **Authentication:** all endpoints require Bearer auth; only workspace owners/admins may query audit logs.

## Resource

### AuditLogResource
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Immutable log identifier. |
| `workspaceId` | UUID | Workspace owning the log entry. |
| `actorType` | `membership|external` | Indicates whether the actor was an internal member or an external collaborator. |
| `actorMembershipId` | UUID? | Present when `actorType=membership`. |
| `actorCollaboratorId` | UUID? | Present when `actorType=external`. |
| `action` | string | Machine-readable action code (e.g., `share_link.created`). |
| `entityType` | string | e.g., `share_link`, `document`, `document_permission`. |
| `entityId` | string? | Optional entity identifier. |
| `metadata` | object | Arbitrary JSON payload describing the event. |
| `createdAt` | ISO datetime | Server timestamp. |

## Endpoint

- **Authentication:** requests must supply `Authorization: Bearer <access token>` (the access token returned by `/api/auth/login`). Fastify validates the session before invoking the audit service.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/workspaces/{workspaceId}/audit` | Paginated audit log query with filters. |

### GET /api/workspaces/{workspaceId}/audit

- **Query Parameters:**
  - `actorMembershipId` (UUID, optional)
  - `actorCollaboratorId` (UUID, optional)
  - `entityType` (string, optional; accepts comma-separated values)
  - `action` (string, optional)
  - `from` / `to` (ISO datetime range filters)
  - `page` / `pageSize` (pagination; defaults `page=1`, `pageSize=50`, max 200)
- **Response:** `200 OK`
```json
{
  "logs": [AuditLogResource],
  "page": 1,
  "pageSize": 50,
  "hasNextPage": false
}
```
- **Errors:**
  - `403` when requester is not owner/admin of the workspace.
  - `404` if workspace missing or deleted.

## Logging Requirements

The backend must emit audit entries for at least:
1. Workspace membership lifecycle events: direct add/reactivation, join request auto/approval, invitation acceptance, role or status updates, removals, ownership transfers, and members leaving (`metadata.source`, `joinRequestId`, `invitationId` when applicable).
2. Document permissions: grant/revoke operations, workspace default access changes.
3. Share links: creation, revocation, allowExternalEdit toggles, guest session issuance/revocation.
4. External collaborator acceptances (link token -> guest profile) and guest session revocations.

Metadata examples:

```json
{
  "shareLinkId": "uuid",
  "accessLevel": "viewer",
  "allowExternalEdit": true
}
```

```json
{
  "membershipId": "uuid",
  "accountId": "uuid",
  "role": "admin",
  "source": "join_request_auto"
}
```

## Test Strategy

Vitest coverage should include:
- `AuditLogService` unit tests verifying record + query filters.
- Integration tests for membership/invitation/join-request services plus share link + permission services asserting audit entries exist after each operation (add/reactivate/remove/role change/leave, invite accept, join auto/approval, create/revoke/guest acceptance, etc.).
- REST-level tests (when HTTP layer is implemented) for `/api/workspaces/{workspaceId}/audit` ensuring pagination + filter correctness.

All tests must pass via `npm run test` before declaring F1 complete.
