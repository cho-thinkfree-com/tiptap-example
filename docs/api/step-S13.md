# Step S13 – External Collaborators (Edit)

Milestone E2 unlocks editing for trusted external guests by pairing share links with lightweight collaborator profiles and guest sessions.

- **OpenAPI:** `docs/api/openapi/step-S13.yaml`
- **Dependencies:** Steps S12 (share links) must be deployed so managers can already create tokens.

## Manager Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/share-links/{shareLinkId}` | Update share-link options (currently `allowExternalEdit`). |
| `DELETE` | `/api/share-links/{shareLinkId}/guest-sessions` | Revoke all guest sessions issued from this link. |

Managers are workspace owners/admins or the document owner membership.

### PATCH /api/share-links/{shareLinkId}
- **Body:** `{ "allowExternalEdit": true }`.
- **Behavior:** toggles whether guests can request edit rights. Turning off the flag invalidates future guest acceptances.
- **Response:** `200 OK` with updated `ShareLinkResource` (includes `allowExternalEdit`).

### DELETE /api/share-links/{shareLinkId}/guest-sessions`
- **Behavior:** marks all guest sessions tied to this link as revoked (server-side sign-out). Idempotent.
- **Response:** `204 No Content`.

## Public Endpoint
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/share-links/{token}/accept` | Guest submits email/display name (and optional password) to receive a guest session token.

### POST /api/share-links/{token}/accept
- **Body:**
```json
{
  "email": "guest@example.com",
  "displayName": "Guest User",
  "password": "secret?" // only when share link is password protected
}
```
- **Behavior:**
  1. Validates token + password (same rules as Step S12 `/access`).
  2. Ensures `allowExternalEdit=true`; otherwise returns `403 share_link_edit_not_allowed`.
  3. Looks up/creates `ExternalCollaborator` by email.
  4. Creates guest session (token + expiry). Revoked automatically when the share link is revoked or via DELETE endpoint.
- **Response:**
```json
{
  "documentId": "uuid",
  "workspaceId": "uuid",
  "accessLevel": "commenter",
  "sessionToken": "guest-session-opaque",
  "expiresAt": "2025-12-31T23:59:59Z",
  "collaboratorId": "uuid"
}
```
- **Errors:**
  - `401 share_link_password_required` when password missing/invalid.
  - `403 share_link_edit_not_allowed` when flag disabled.
  - `404` token invalid/revoked/expired.

Guest sessions last 7 days by default (configurable) and are revoked when the manager revokes the share link or calls the guest-session DELETE endpoint.

## Data Model
- `ExternalCollaborator`: `id`, `email`, `display_name`, `status`, timestamps.
- `DocumentShareLink` gains `allow_external_edit boolean`.
- `DocumentShareLinkSession`: `id`, `share_link_id`, `collaborator_id`, `token_hash`, `expires_at`, `revoked_at`.

## Tests
1. Toggle `allowExternalEdit` via PATCH; verify share-link listings show the flag.
2. Accept guest when flag true → returns session token; ensure password requirement enforced.
3. Acceptance fails when flag false or link revoked.
4. `DELETE .../guest-sessions` revokes existing sessions (subsequent accept already blocked until re-enabled).
5. Regression: existing Step S12 tests still pass (share link view/comment flows unaffected).

All new tests live under `tests/backend/documents/shareLinkService.spec.ts` and must pass with `npm run test` before closing E2.
