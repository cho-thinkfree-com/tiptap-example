-- AlterTable
ALTER TABLE "Account" ADD COLUMN "preferred_locale" TEXT;
ALTER TABLE "Account" ADD COLUMN "preferred_timezone" TEXT;

-- AlterTable
ALTER TABLE "WorkspaceMembership" ADD COLUMN "preferred_locale" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_image" TEXT,
    "default_locale" TEXT NOT NULL DEFAULT 'en',
    "default_timezone" TEXT NOT NULL DEFAULT 'UTC',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "owner_account_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "Workspace_owner_account_id_fkey" FOREIGN KEY ("owner_account_id") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Workspace" ("cover_image", "created_at", "default_locale", "deleted_at", "description", "id", "name", "owner_account_id", "slug", "updated_at", "visibility") SELECT "cover_image", "created_at", "default_locale", "deleted_at", "description", "id", "name", "owner_account_id", "slug", "updated_at", "visibility" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
