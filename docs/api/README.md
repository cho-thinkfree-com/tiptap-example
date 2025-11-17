# API Specifications Index

모든 백엔드 작업은 해당 Step 문서를 먼저 작성한 뒤 구현합니다. 각 문서에는 요청/응답 스키마, 검증 규칙, 오류 코드, 테스트 시나리오, 그리고 OpenAPI 스니펫(또는 `docs/api/openapi/*.yaml` 링크)을 포함해야 합니다.

| Step | Title | Status | Notes |
|------|-------|--------|-------|
| `step-S1.md` | Account Storage (persistence layer only) | _TBD_ | Non-HTTP module; document schema + repository behaviors when ready. |
| `step-S2.md` | Session & Auth API (signup/login/logout/refresh) | Drafted | Covers Milestone A2 endpoints. |
| `step-S3.md` | Password Reset & Account Deletion | Drafted | Milestone A3: reset tokens + deletion flow. |
| `step-S4.md` | Workspace Creation Basics | Drafted | Milestone B1: create/list/get workspace metadata. |
| `step-S5.md` | Workspace Metadata & Delete | Drafted | Milestone B2: patch/delete endpoints. |
| `step-S6.md` | Workspace Membership Model | Drafted | Milestone C1: membership CRUD + roles. |
| `step-S7.md` | Invitations & Join Requests | Drafted | Milestone C2: invite tokens, domain allowlist, pending approvals. |
| `step-S8.md` | Role Transitions & Ownership Transfer | Drafted | Milestone C3: owner transfer, role changes, removals. |
| `step-S9.md` | Folder & Document Metadata | Drafted | Milestone D1: folder tree CRUD, document metadata + revisions. |
| `step-S10.md` | Document Permissions (Internal) | Drafted | Milestone D2: workspace defaults + ACL management APIs. |
| `step-S11.md` | Document Actions & Validation | Drafted | Milestone D3: document GET/PATCH/DELETE + revision history. |
| `step-S12.md` | Share Links (View/Comment) | Drafted | Milestone E1: share link CRUD + password/expiration validation. |
| `step-S13.md` | External Collaborators (Edit) | Drafted | Milestone E2: external collaborator acceptance + guest sessions. |

새 Step을 추가할 때는 이 표를 업데이트하고 `docs/planning/workspace-permission-design.md`의 매핑도 함께 수정하세요.
