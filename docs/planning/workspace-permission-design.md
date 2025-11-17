# Workspace, Permission, and Sharing Design Plan

## Goals
- Provide a detailed blueprint for account/workspace/member relationships before implementation.
- Define how read/write/doc permissions behave for owner/admin/member roles and external collaborators.
- Capture sharing flows (internal + external) including whether external recipients can edit.
- Keep the plan DB-agnostic so we can start on SQLite and later migrate to PostgreSQL/Supabase.

## Auth & Persistence Abstraction Requirements
- All authentication logic must sit behind interface-driven services so backing stores can change (custom ID/password, OAuth provider, Supabase Auth, etc.) without rewriting consumers.
- Introduce `AuthProvider` abstraction with pluggable strategies (LocalPasswordProvider, OAuthProvider, SupabaseProvider). Each implements signup/login/logout/refresh flows with consistent DTOs.
- Session persistence (tokens, password reset, verification) should use repository interfaces; initial implementation targets SQLite but drivers for PostgreSQL/Supabase must be swappable.
- Avoid coupling password hashing/token issuance directly in controllers—keep them in service layer so future OAuth-only mode can bypass unused logic cleanly.

## Core Entities

### Account (Global User)
- Fields: `id`, `email`, `password_hash`, `status (active|suspended|deleted)`, `created_at`, `updated_at`.
- Holds minimal global profile data: `legal_name`, `recovery_email`, `recovery_phone`.
- Relationships: `Account 1:N WorkspaceMembership`, `Account 1:N Session`, `Account 1:N WorkspaceOwnership`.
- A single account **must** support memberships across multiple workspaces simultaneously; each workspace stores its own profile/role for that account.
- Deleting an account cascades to all memberships (blocked if user is active owner; must transfer ownership first).

### Workspace
- Fields: `id`, `name`, `slug`, `description`, `cover_image`, `default_locale`, `plan`, `visibility (private|listed|public)`, `domain_allowlist`.
- Relationships: `Workspace 1:N WorkspaceMembership`, `Workspace 1:N Folder`, `Workspace 1:N Document`.
- Constraints: exactly one `owner` role. Soft delete with `deleted_at` to preserve documents until purged.

### WorkspaceMembership
- Composite key `(workspace_id, account_id)`.
- Fields: `role (owner|admin|member)`, `status (active|pending|invited|removed)`, `invited_by`, `last_active_at`.
- Stores workspace-scoped profile (`display_name`, `avatar_url`, `timezone`, `notification_settings`).
- Membership history log for audit (role changes, invitations, removals).

### WorkspaceRolePolicy
- Reference table enumerating each role’s capabilities (update workspace meta, manage members, create documents, manage ACLs, delete workspace, transfer ownership).
- Enables future enterprise roles without rewriting code.

### Folder
- Hierarchical tree per workspace: `id`, `workspace_id`, `parent_id nullable`, `name`, `path_cache`.
- Stores ordering info for TOC/sidebar.

### Document
- Fields: `id`, `workspace_id`, `folder_id`, `title`, `slug`, `status (draft|published|archived)`, `visibility (private|workspace|shared|public)`, `owner_membership_id`, timestamps.
- Content stored separately (`document_revisions` with `editor_state_json`, `version`, `created_by`).
- `Document 1:N DocumentPermission`.
- Real-time collaboration (TipTap/Yjs) is **out of scope initially**, but schema must allow future integration (e.g., storing CRDT state, change feeds). Keep revision table flexible so collaborative sessions can append snapshots or checkpoints later.

### Tag & DocumentTag
- `Tag`: `id`, `workspace_id`, `name`, `color`, `created_by`, `created_at`.
- `DocumentTag`: join table (`document_id`, `tag_id`, `assigned_by`, `assigned_at`).
- Tags scoped per workspace, used for filtering/search facets.

### DocumentPermission
- Fields: `document_id`, `principal_type (workspace|membership|account|share_link)`, `principal_id`, `role (viewer|commenter|editor|owner)`.
- Determines access for explicit principals; workspace default is derived from `workspace_default_access` on the document row.

### ShareLink
- Fields: `id`, `document_id`, `access_level (view|comment|edit)`, `expires_at`, `password_hash optional`, `allow_external_edit bool`.
- Optionally tied to email invites for tracking (when known). Each link tracked for analytics (views/edits).

### ExternalCollaborator
- Used when allowing non-members to edit. Represents a lightweight “guest” account with fields: `id`, `email`, `display_name`, `status`.
- Linked to `ShareLink` activations to enforce one guest per invitation when edit rights granted.

## Role & Permission Model
- **Owner**: full admin capabilities, billing, workspace deletion, ownership transfer, manage domain allowlist, manage templates.
- **Admin**: manage members (except owner), edit workspace metadata, create/delete folders/documents, manage document permissions, accept/reject join requests.
- **Member**: create/edit documents they own, edit documents shared with them (per ACL), invite guests if allowed, request role upgrade.
- **Guest (external viewer/commenter/editor)**: access limited documents via share link. Only persists if they accept invitation; otherwise ephemeral access token.

### Permission Evaluation Order
1. If requester is `owner` or `admin`, allow unless item explicitly locked (`locked_by_owner` flag).
2. If document visibility is `public` and share link is valid, grant access per link’s access level.
3. If requester is workspace member, check `DocumentPermission` entries; fallback to document’s `workspace_default_access`.
4. If requester is `ExternalCollaborator`, ensure their share link still valid and `allow_external_edit` covers requested action.
5. Deny by default.

### Read vs Write Paths
- **Read** requires at least `viewer`.
- **Write** requires `editor` or `owner`. Comment-only mode uses `commenter`.
- Write operations also validate workspace plan limits (seats, storage) before commit.

## Workflows

### 1. Signup/Login/Logout/Deletion
1. Signup: `account` row + hashed password. Optional email verification flag.
2. Login: create session with refresh token, enforce brute-force limits.
3. Logout: revoke session.
4. Deletion: check `WorkspaceMembership` for owner roles; if present require transfer or workspace deletion before final removal. After deletion, anonymize personal info and mark documents as `orphaned` until reassigned or deleted.

### 2. Workspace Lifecycle
- **Create**: first user becomes `owner`, default folder root and sample doc created. Domain allowlist empty.
- **Invite**: owner/admin sends invitation; `WorkspaceMembership` row with `status=invited`. Acceptance converts to `member`.
- **Join request**: for listed/public workspaces, entries stored with `status=pending`; admin approves.
- **Role changes**: owner can promote/demote; cannot demote/remove self until another owner appointed.
- **Ownership transfer**: API ensures target membership is `admin` or `member` with acceptance prompt.
- **Domain auto-join**: workspace stores allowed domains; signup detects match and auto-adds as `member`.

### 3. Document Creation & Ownership
- Document creator becomes `owner_membership_id`.
- By default `workspace_default_access = private`. Owner toggles to `workspace` (all members viewer/editor) or `shared` (ACL-driven).
- Document revision table keeps audit (who wrote what version) for future collaborative features.

### 4. Internal Sharing Scenarios
1. **Personal**: only owner membership has editor rights. Appears in personal section.
2. **Workspace-wide**: `workspace_default_access` set to `viewer` or `editor`. Owner/admin can restrict editing to admins only via flag.
3. **Targeted**: Add entries to `DocumentPermission` referencing specific memberships/accounts with viewer/commenter/editor.
4. **Folder-level policies** (future): propagate ACLs down tree with override markers.

### 4b. Tagging & Search
- Tag CRUD endpoints allow owners/admins/members to organize documents; Tag palette is workspace-scoped.
- Search service supports filtering by text (title/content), tag, folder, owner, status, and visibility. Query builders must enforce ACLs before returning results.
- Indexing strategy: start with relational queries over SQLite/PostgreSQL; later optional full-text search engine can plug in behind a search interface.
- Tests must cover tag assignment/removal, search filtering, and ACL enforcement (users only see documents they have access to, even if tags match).

### 4c. Frontend Integration Requirements
- **File Tree Panel**: consumes `/api/workspaces/:id/tree` (folder + document metadata). Response fields: `id`, `type (folder|document)`, `parent_id`, `title`, `visibility`, `order`. Supports drag/drop reorder via `/api/folders/:id/move` and `/api/documents/:id/move`.
- **Document Detail Pane**: loads `/api/documents/:id` for metadata + editor JSON, plus breadcrumbs assembled from folder ancestors. Needs change tracking to show unsaved state.
- **Tagging UI**: chip selector fetches workspace tags via `/api/tags`; assign/remove operations call `/api/documents/:id/tags`. FE must gracefully handle permission errors (e.g., member cannot create new tags).
- **Search Bar**: queries `/api/search` with filters (query text, tag ids, folder id, owner id, status, visibility). Results should include snippet highlights and permission badges so FE can render context.
- **Permission Summary**: toolbar requests `/api/documents/:id/permissions/summary` to show who can view/edit. Must update immediately after ACL changes.
- FE components should hide or disable features until the corresponding backend milestone ships (feature flags or capability probe endpoint).

### 5. External Sharing
- Owner/admin/member (with permission) can generate share links.
- UI exposes `view/comment/edit`, optional expiration, password.
- When `allow_external_edit=true`, recipient must create `ExternalCollaborator` profile (email + display name). They receive scoped token tied to link; edits stored under guest ID.
- External editors cannot change workspace metadata, invite others, or delete docs. They may leave comments and edit body depending on link scope.
- Public discoverability toggle ensures only links with `public_indexable=true` show up in search engines.

### 6. Workspace-Level Sharing
- Workspace invites support roles; `owner` always unique.
- Shared templates: documents flagged as template are available workspace-wide; use same ACL model but default to read-only except to admins.

### 7. Audit & Logging
- All membership changes, share link creations, permission grants recorded in `audit_log`.
- Document-level log stores `principal`, `action`, `timestamp`, `source_ip`.
- Required for compliance and debugging unauthorized access.

## Implementation Plan (High-Level)
1. **Phase A – Accounts & Workspaces**
   - Build Account + Workspace + Membership tables (SQLite first).
   - Implement signup/login/logout/deletion flows respecting owner constraints.
2. **Phase B – Roles & Permissions**
   - Populate `WorkspaceRolePolicy`.
   - Enforce permission evaluation order on API endpoints.
3. **Phase C – Document ACL & Internal Sharing**
   - Create Document/Folder schema, `DocumentPermission` logic, workspace default access settings.
4. **Phase D – External Sharing**
   - ShareLink + ExternalCollaborator tables, guest session handling, edit gating.
5. **Phase E – Audit & Governance**
   - Audit logs, rate limits, domain allowlist, workspace join workflows.

Documenting this plan before implementation ensures we can review each relationship (Account ↔ Workspace ↔ Membership, Document ↔ Permissions, ShareLink ↔ ExternalCollaborator) and adjust before coding.

## Backend Milestones & Required Tests
Milestones are intentionally small so each can be implemented + tested before moving on. Every milestone must provide its own automated test suite (unit + integration) and leave the system in a runnable state for the next milestone.

### Milestone A1 – Account Storage
- **Status:** ✅ Completed (2025-11-17) – Prisma schema, migrations, repository/service layer, and Vitest coverage for create/find/duplicate paths.
- Scope: Account table, password hashing, unique email constraint, created/updated timestamps.
- Tests: account creation success, duplicate email rejection, password hashing correctness, serialization/deserialization in SQLite.
- Dependency for A2+ because later auth/session logic relies on stored accounts.

### Milestone A2 – Session & Auth API
- **Status:** ✅ Completed (2025-11-17) – Signup/login/logout/logout-all/refresh services with session table, hashed refresh tokens, login throttling, and Vitest suites.
- Scope: Signup/login/logout endpoints, session tokens (refresh + access), brute-force throttling, logout all sessions.
- Tests: signup validation, login success/fail (bad password, unknown email), session issuance/revocation, throttling triggered after repeated failures.
- Requires A1 complete; once done, enables QA to manually sign up/login without workspace features.

### Milestone A3 – Account Deletion & Recovery
- **Status:** ✅ Completed (2025-11-17) – Password reset tokens + confirmation flow, guarded account deletion, session revocation, and coverage.
- Scope: Password reset requests, token verification, account deletion workflow (blocked if owning workspace), soft delete flags.
- Tests: reset token issuance/expiration, password update flow, deletion blocked when owner, successful deletion when not owner, session invalidation post deletion.
- After A3, auth layer is stable for Workspace milestones.

### Milestone B1 – Workspace Creation Basics
- Scope: Workspace table, create/list/read endpoints, owner auto-assignment (creator becomes owner), SQLite migrations.
- Tests: workspace create/list for a user, verify owner assigned, enforce owner uniqueness (no duplicate owner rows), soft delete flag prevents accidental purge.
- Depends on A2 (needs authenticated user). Provides base for metadata/edit flows.

### Milestone B2 – Workspace Metadata & Delete
- Scope: Update workspace name/description/locale/cover, delete (soft) workspace, ensure owner constraints before deletion.
- Tests: metadata update permissions (owner/admin), delete fails when non-owner, delete success with confirmation, ensure deleted workspaces hidden from listings.
- Enables later membership/invite UI to rely on editable workspace info.

### Milestone C1 – Membership Model
- Scope: WorkspaceMembership table, role field, workspace-scoped profile, owner/admin/member enums.
- Tests: adding membership rows, enforcing one owner per workspace, retrieving memberships, preventing duplicate membership entries per account/workspace.
- Required before invitations/join flows.

### Milestone C2 – Invitations & Join Requests
- Scope: Invitation API (send, accept, decline), join request pending queue, domain allowlist auto-join.
- Tests: invite flow (token validation, expiry), acceptance sets membership active, decline removes pending invite, domain auto-join bypasses approval, join requests require admin approval.
- Builds on C1; upon completion, workspace population flows are functional.

### Milestone C3 – Role Transitions & Ownership Transfer
- Scope: Promote/demote members, transfer ownership, enforce owner uniqueness, member removal.
- Tests: role change authorization (only owner can transfer), transfer success path, demote admin to member, removing members updates audit log, owner cannot demote without new owner.
- Sets stage for document permissions to rely on accurate roles.

### Milestone D1 – Folder & Document Metadata
- Scope: Folder tree CRUD, Document table (title, folder, visibility), DocumentRevision table storing editor JSON.
- Tests: folder nesting, move operations, document create/update metadata, revision append test, retrieving latest revision.
- Provides persistence base for ACL features.

### Milestone D2 – Document Permissions (Internal)
- Scope: DocumentPermission table, workspace default access flags, permission evaluation service for owner/admin/member.
- Tests: private/workspace/shared scenarios, ACL overrides for specific members, denial when insufficient role, ensuring default access cascades.
- After D2, internal editing and viewing is fully governed.

### Milestone D3 – Document Actions & Validation
- Scope: API endpoints for create/update/delete documents using permission checks, optimistic locking, plan limit hooks.
- Tests: create/edit/delete success/failure per role, concurrent edit conflict detection, plan limit enforcement stubs.
- Prepares for external sharing by ensuring internal actions are stable.

### Milestone E1 – Share Links (View/Comment)
- Scope: ShareLink table, generate/revoke links, password + expiration logic, viewer/commenter support for anonymous users.
- Tests: create share link, password validation, expired link rejection, access log entry on view/comment, revoke hides document immediately.
- Allows safe public viewing/commenting before edit rights exist.

### Milestone E2 – External Collaborators (Edit)
- Scope: ExternalCollaborator profiles, linking to share links, allow_external_edit flag, guest session tokens.
- Tests: guest signup via link, edit allowed only when flag true, guest audit log entries, revocation invalidates guest sessions.
- Completes external sharing story.

### Milestone F1 – Audit Logging
- Scope: Audit log table, capture membership changes, share link actions, document permission edits.
- Tests: verify log entries created for each critical action, querying logs by workspace/user.
- Required before governance/monitoring features.

### Milestone F2 – Governance & Rate Limiting
- Scope: Access logs, rate limit enforcement, workspace delete safety checks, template sharing policies.
- Tests: rate limit triggers, workspace delete blocked when docs exist and confirmation missing, template sharing respects ACL, access logs queryable.
- Final milestone ensures operational safety/compliance.

Milestones must be developed sequentially (A1 → F2). Each milestone’s tests double as the regression suite the next milestone will run before adding new ones, guaranteeing we can continue development without regressions.

## API Step Mapping
Each milestone must link to a concrete step spec under `docs/api/step-S{n}.md`. Draft the spec before coding; include request/response schema, validation, error codes, and acceptance tests.

| Milestone | API Step(s) | Scope |
|-----------|-------------|-------|
| A1 – Account Storage | `step-S1.md` | Account repository interface, data model, migrations. |
| A2 – Session & Auth API | `step-S2.md` | `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, session token refresh, throttle strategy. |
| A3 – Account Deletion & Recovery | `step-S3.md` | `/api/auth/password-reset/request`, `/api/auth/password-reset/confirm`, `/api/auth/delete`. |
| B1 – Workspace Creation Basics | `step-S4.md` | `/api/workspaces` (create/list), workspace detail GET. |
| B2 – Workspace Metadata & Delete | `step-S5.md` | `/api/workspaces/:id` PATCH/DELETE, cover upload signed URL endpoints. |
| C1 – Membership Model | `step-S6.md` | Membership listing endpoints, role policy read. |
| C2 – Invitations & Join Requests | `step-S7.md` | `/api/workspaces/:id/invitations` CRUD, join request endpoints, domain allowlist management. |
| C3 – Role Transitions & Ownership Transfer | `step-S8.md` | Role change endpoint, ownership transfer mutation, member removal API. |
| D1 – Folder & Document Metadata | `step-S9.md` | `/api/workspaces/:id/folders` CRUD, `/api/documents` create/list metadata. |
| D2 – Document Permissions (Internal) | `step-S10.md` | `/api/documents/:id/permissions`, workspace default access APIs. |
| D3 – Document Actions & Validation | `step-S11.md` | `/api/documents/:id` GET/PATCH/DELETE, revision history endpoint, optimistic locking error codes. |
| E1 – Share Links (View/Comment) | `step-S12.md` | `/api/documents/:id/share-links` CRUD, password validation endpoint. |
| E2 – External Collaborators (Edit) | `step-S13.md` | `/api/share-links/:id/accept`, guest session issuance, revocation endpoints. |
| F1 – Audit Logging | `step-S14.md` | `/api/audit` query endpoints, event emitter hooks. |
| F2 – Governance & Rate Limiting | `step-S15.md` | Rate limit config endpoints, workspace delete confirmation workflow, template management APIs. |

When extending scope with new sub-features, append additional step files instead of overloading an existing spec.

> 삼국지: API 구현 시에는 반드시 `docs/api/step-S*.md` 파일을 먼저 채워 요청/응답 필드, 검증 로직, 에러 코드까지 상세히 정의하고 TDD 시나리오를 명시한 뒤 개발에 착수한다. 이렇게 해야 프런트엔드/QA가 참조할 API 문서가 항상 최신 상태로 유지된다.

### API Documentation toolchain
- Use **OpenAPI 3.1** as the canonical schema format. Each `step-S*.md` should include an embedded YAML snippet or a link to `/docs/api/openapi/step-S*.yaml`.
- Generate human-readable docs via **Redocly** (Redoc CLI) baked into the repo. The OpenAPI sources will live under `docs/api/openapi/`.
- Validation libraries in implementation must mirror the OpenAPI schema (e.g., use Zod or Yup to define DTOs, convert them to OpenAPI via generators) so docs and runtime stay in sync.
- CI should fail if OpenAPI files are outdated. Provide `npm run docs:api` to regenerate Redoc HTML and ensure it matches the spec.
- **Change control**: If new requirements emerge during implementation, extend the relevant `step-S*.md` (or add a new step file if the change is large). Every change must:
  1. Update the OpenAPI snippet.
  2. Describe new validation/error cases.
  3. List additional tests needed.
  4. Reference the corresponding milestone/task ID for traceability.
- Keep step files concise: if a spec grows beyond ~3 endpoints or 2 pages, split it. Organize by domain (Auth, Workspace, Membership, Documents, Sharing, Governance). Maintain an index in `docs/api/README.md` to keep the collection navigable.

## Testing & TDD Requirements
- Follow strict TDD: write backend tests (unit + integration) before implementing each phase so DB schemas/services stay verifiable.
- Provide factory helpers/mocks to spin up SQLite in-memory databases for fast test feedback; keep interfaces compatible with future PostgreSQL/Supabase drivers.
- Cover every role/permission branch: owner/admin/member actions, pending/removed statuses, share-link password/error paths, external collaborator edit gating, folder ACL inheritance, and workspace deletion edge cases.
- Automate regression suites for signup/login/logout, membership invitations, domain auto-join, document ACL mutations, share-link revocation, and audit logging.
- Include testing strategy summaries within each step spec (e.g., `docs/api/step-S3.md`) so no endpoint ships without exhaustive test cases.
