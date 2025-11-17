# Step S5 – Workspace Metadata & Delete

Milestone B2 allows owners to edit workspace metadata and soft delete workspaces.

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/workspaces/{id}` | Update workspace metadata (owner only). |
| `DELETE` | `/api/workspaces/{id}` | Soft delete workspace (owner only, idempotent). |

## PATCH request body
```json
{
  "name": "New Name",
  "description": "Optional markdown/summary",
  "coverImage": "https://cdn.example.com/img.png",
  "defaultLocale": "ko-KR",
  "visibility": "listed"
}
```
- All fields optional but at least one must be provided.
- `coverImage` must be HTTPS.
- `defaultLocale`: BCP47 string (2–10 chars).
- `defaultTimezone`: IANA/Olson timezone identifier (defaults to `UTC`).
- Returns updated `WorkspaceResponse`.
- Errors: `403` not owner, `404` not found, `422` invalid payload.

## DELETE semantics
- Sets `deleted_at`; subsequent list/get requests omit or 404.
- Endpoint returns `204` even if already deleted (idempotent). Non-owner => `403`.

## Tests
- Patch updates single/multiple fields while preserving others.
- Invalid cover image (non-HTTPS) fails.
- Invalid timezone (empty string) fails.
- Non-owner patch/delete fails.
- Delete removes workspace from listings and is idempotent.
