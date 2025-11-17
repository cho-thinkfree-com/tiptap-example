-- CreateTable
CREATE TABLE "DocumentPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "principal_type" TEXT NOT NULL,
    "principal_id" TEXT NOT NULL,
    "membership_id" TEXT,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "DocumentPermission_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentPermission_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "WorkspaceMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "owner_membership_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "summary" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "workspace_default_access" TEXT NOT NULL DEFAULT 'none',
    "workspace_editor_admins_only" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Document_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_owner_membership_id_fkey" FOREIGN KEY ("owner_membership_id") REFERENCES "WorkspaceMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("created_at", "deleted_at", "folder_id", "id", "owner_membership_id", "slug", "sort_order", "status", "summary", "title", "updated_at", "visibility", "workspace_id") SELECT "created_at", "deleted_at", "folder_id", "id", "owner_membership_id", "slug", "sort_order", "status", "summary", "title", "updated_at", "visibility", "workspace_id" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_workspace_id_folder_id_idx" ON "Document"("workspace_id", "folder_id");
CREATE INDEX "Document_owner_membership_id_idx" ON "Document"("owner_membership_id");
CREATE UNIQUE INDEX "Document_workspace_id_slug_key" ON "Document"("workspace_id", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DocumentPermission_membership_id_idx" ON "DocumentPermission"("membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPermission_document_id_principal_type_principal_id_key" ON "DocumentPermission"("document_id", "principal_type", "principal_id");
