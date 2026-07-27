-- Drop the globally-unique index on chapter_id (causes cross-source collision)
DROP INDEX IF EXISTS "chapters_chapter_id_key";

-- Add composite unique constraint (unique per source)
CREATE UNIQUE INDEX "chapters_source_id_chapter_id_key" ON "chapters"("source_id", "chapter_id");

-- Drop the globally-unique index on cover_id (causes cross-source collision)
DROP INDEX IF EXISTS "covers_cover_id_key";

-- Add composite unique constraint (unique per source)
CREATE UNIQUE INDEX "covers_source_id_cover_id_key" ON "covers"("source_id", "cover_id");
