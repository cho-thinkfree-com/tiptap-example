-- CreateTable
CREATE TABLE "ExternalCollaborator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentShareLinkSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "share_link_id" TEXT NOT NULL,
    "collaborator_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentShareLinkSession_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "DocumentShareLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentShareLinkSession_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "ExternalCollaborator" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "access_level" TEXT NOT NULL,
    "password_hash" TEXT,
    "expires_at" DATETIME,
    "revoked_at" DATETIME,
    "created_by_membership_id" TEXT NOT NULL,
    "allow_external_edit" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentShareLink_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentShareLink_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "WorkspaceMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentShareLink" ("access_level", "created_at", "created_by_membership_id", "document_id", "expires_at", "id", "password_hash", "revoked_at", "token") SELECT "access_level", "created_at", "created_by_membership_id", "document_id", "expires_at", "id", "password_hash", "revoked_at", "token" FROM "DocumentShareLink";
DROP TABLE "DocumentShareLink";
ALTER TABLE "new_DocumentShareLink" RENAME TO "DocumentShareLink";
CREATE UNIQUE INDEX "DocumentShareLink_token_key" ON "DocumentShareLink"("token");
CREATE INDEX "DocumentShareLink_document_id_idx" ON "DocumentShareLink"("document_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCollaborator_email_key" ON "ExternalCollaborator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLinkSession_token_hash_key" ON "DocumentShareLinkSession"("token_hash");

-- CreateIndex
CREATE INDEX "DocumentShareLinkSession_share_link_id_idx" ON "DocumentShareLinkSession"("share_link_id");

-- CreateIndex
CREATE INDEX "DocumentShareLinkSession_collaborator_id_idx" ON "DocumentShareLinkSession"("collaborator_id");
