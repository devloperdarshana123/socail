/*
  Warnings:

  - Added the required column `targetId` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Report" ADD COLUMN "targetId" TEXT;

-- Populate existing rows - agar dono NULL ho toh 'unknown' use kar
UPDATE "Report" 
SET "targetId" = COALESCE("postId", "reportedUserId", 'unknown-' || id) 
WHERE "targetId" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "Report" ALTER COLUMN "targetId" SET NOT NULL;