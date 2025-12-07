-- Step 1: Rename the old enum to free up the name
ALTER TYPE "ShareLinkAccessType" RENAME TO "ShareLinkAccessType_old";

-- Step 2: Create the new enum with the desired values
CREATE TYPE "ShareLinkAccessType" AS ENUM ('private', 'link', 'public');

-- Step 3: Update the column to use the new enum, mapping 'link_only' to 'link'
ALTER TABLE "share_links" ALTER COLUMN "access_type" DROP DEFAULT;
ALTER TABLE "share_links" 
  ALTER COLUMN "access_type" TYPE "ShareLinkAccessType" 
  USING (
    CASE "access_type"::text
      WHEN 'link_only' THEN 'link'::"ShareLinkAccessType"
      ELSE "access_type"::text::"ShareLinkAccessType"
    END
  );

-- Step 4: Drop the old enum
DROP TYPE "ShareLinkAccessType_old";

-- Step 5: Restore default value if needed (setting it to 'link' as per original intent)
ALTER TABLE "share_links" ALTER COLUMN "access_type" SET DEFAULT 'link';
