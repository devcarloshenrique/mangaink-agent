-- CreateTable
CREATE TABLE "user_chapter_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "chapter_id" VARCHAR(100) NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_chapter_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_chapter_progress_userId_source_id_idx" ON "user_chapter_progress"("userId", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_chapter_progress_userId_source_id_chapter_id_key" ON "user_chapter_progress"("userId", "source_id", "chapter_id");

-- AddForeignKey
ALTER TABLE "user_chapter_progress" ADD CONSTRAINT "user_chapter_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chapter_progress" ADD CONSTRAINT "user_chapter_progress_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("source_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_chapter_progress" ADD CONSTRAINT "user_chapter_progress_source_id_chapter_id_fkey" FOREIGN KEY ("source_id", "chapter_id") REFERENCES "chapters"("source_id", "chapter_id") ON DELETE CASCADE ON UPDATE CASCADE;
