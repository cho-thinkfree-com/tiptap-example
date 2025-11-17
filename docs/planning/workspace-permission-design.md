# Workspace, Permission, and Sharing Design Plan

## Goals
- Provide a detailed blueprint for account/workspace/member relationships before implementation.
- Define how read/write/doc permissions behave for owner/admin/member roles and external collaborators.
- Capture sharing flows (internal + external) including whether external recipients can edit.
- Keep the plan DB-agnostic so we can start on SQLite and later migrate to PostgreSQL/Supabase.

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

## Testing & TDD Requirements
- Follow strict TDD: write backend tests (unit + integration) before implementing each phase so DB schemas/services stay verifiable.
- Provide factory helpers/mocks to spin up SQLite in-memory databases for fast test feedback; keep interfaces compatible with future PostgreSQL/Supabase drivers.
- Cover every role/permission branch: owner/admin/member actions, pending/removed statuses, share-link password/error paths, external collaborator edit gating, folder ACL inheritance, and workspace deletion edge cases.
- Automate regression suites for signup/login/logout, membership invitations, domain auto-join, document ACL mutations, share-link revocation, and audit logging.
- Include testing strategy summaries within each step spec (e.g., `docs/api/step-S3.md`) so no endpoint ships without exhaustive test cases.
