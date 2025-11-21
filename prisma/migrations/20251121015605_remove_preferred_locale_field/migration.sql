/*
  Warnings:

  - You are about to drop the column `preferred_locale` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `preferred_locale` on the `WorkspaceMembership` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "legal_name" TEXT,
    "recovery_email" TEXT,
    "recovery_phone" TEXT,
    "preferred_timezone" TEXT,
    "preferred_language" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Account" ("created_at", "email", "id", "legal_name", "password_hash", "preferred_language", "preferred_timezone", "recovery_email", "recovery_phone", "status", "updated_at") SELECT "created_at", "email", "id", "legal_name", "password_hash", "preferred_language", "preferred_timezone", "recovery_email", "recovery_phone", "status", "updated_at" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
CREATE TABLE "new_WorkspaceMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "display_name" TEXT,
    "avatar_url" TEXT,
    "timezone" TEXT,
    "preferred_language" TEXT,
    "notification_settings" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceMembership_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMembership_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkspaceMembership" ("account_id", "avatar_url", "created_at", "display_name", "id", "notification_settings", "preferred_language", "role", "status", "timezone", "updated_at", "workspace_id") SELECT "account_id", "avatar_url", "created_at", "display_name", "id", "notification_settings", "preferred_language", "role", "status", "timezone", "updated_at", "workspace_id" FROM "WorkspaceMembership";
DROP TABLE "WorkspaceMembership";
ALTER TABLE "new_WorkspaceMembership" RENAME TO "WorkspaceMembership";
CREATE UNIQUE INDEX "WorkspaceMembership_workspace_id_account_id_key" ON "WorkspaceMembership"("workspace_id", "account_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
