-- CreateTable
CREATE TABLE "DocumentShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "access_level" TEXT NOT NULL,
    "password_hash" TEXT,
    "expires_at" DATETIME,
    "revoked_at" DATETIME,
    "created_by_membership_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentShareLink_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentShareLink_created_by_membership_id_fkey" FOREIGN KEY ("created_by_membership_id") REFERENCES "WorkspaceMembership" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShareLink_token_key" ON "DocumentShareLink"("token");

-- CreateIndex
CREATE INDEX "DocumentShareLink_document_id_idx" ON "DocumentShareLink"("document_id");
