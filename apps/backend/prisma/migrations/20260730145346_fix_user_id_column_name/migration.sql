-- DropIndex
DROP INDEX IF EXISTS "user_chapter_progress_userId_source_id_chapter_id_key";

-- DropIndex  
DROP INDEX IF EXISTS "user_chapter_progress_userId_source_id_idx";

-- Rename column userId to user_id
ALTER TABLE "user_chapter_progress" RENAME COLUMN "userId" TO "user_id";

-- CreateIndex
CREATE UNIQUE INDEX "user_chapter_progress_user_id_source_id_chapter_id_key" ON "user_chapter_progress"("user_id", "source_id", "chapter_id");

-- CreateIndex
CREATE INDEX "user_chapter_progress_user_id_source_id_idx" ON "user_chapter_progress"("user_id", "source_id");
