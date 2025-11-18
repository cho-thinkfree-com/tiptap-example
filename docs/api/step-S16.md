# Step S16 – Export Jobs (PDF/Markdown/HTML)

Milestone D4 introduces export requests for documents. Users request an export job, poll its status, and optionally cancel while it is pending.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/export` | Create an export job for a workspace document. |
| `GET` | `/api/export/{jobId}` | Fetch job status/result URL. |
| `POST` | `/api/export/{jobId}/cancel` | Cancel a pending/processing job. |

## Request Body (`POST /api/export`)

```json
{
  "workspaceId": "uuid",
  "documentId": "uuid",
  "format": "pdf"
}
```

- Authenticated workspace members only.
- `documentId` must belong to the workspace.
- `format` accepts `pdf`, `md`, `html`.
- Returns `201 Created` with job payload (`id`, `workspaceId`, `status`, timestamps).

## Job Status Flow

1. Created job starts as `pending`.
2. Server transitions it to `processing` and later `completed` with `resultUrl` (simulated in this MVP).
3. Failed/cancelled jobs have `status` `failed`/`cancelled` and optional `errorMessage`.

## GET /api/export/{jobId}

- Authenticated workspace members only.
- Returns job details including `status`, `resultUrl`, `errorMessage`.
- `404` if job not found or belongs to another workspace.

## POST /api/export/{jobId}/cancel

- Authenticated workspace members.
- Cancels job if still `pending`/`processing` (no-op for completed/final statuses).
- Returns `200 OK`.

## Tests

1. Create export job, poll until `completed`, and verify `resultUrl`.
2. Cancel pending job results in `cancelled` status.
3. `GET` job from different workspace returns `401`/`403`.
