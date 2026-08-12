-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "engine" VARCHAR(20) NOT NULL,
    "tags" TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "description" TEXT,
    "url_example" VARCHAR(2048),
    "homepage" VARCHAR(2048),
    "logo_url" VARCHAR(2048),
    "search_url" VARCHAR(2048),
    "rate_limit_max_concurrent" INTEGER NOT NULL DEFAULT 6,
    "rate_limit_min_time" INTEGER NOT NULL DEFAULT 50,
    "rate_limit_reservoir" INTEGER,
    "rate_limit_reservoir_refresh_interval" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_slug_key" ON "providers"("slug");

-- RenameForeignKey
ALTER TABLE "user_chapter_progress" RENAME CONSTRAINT "user_chapter_progress_userId_fkey" TO "user_chapter_progress_user_id_fkey";
