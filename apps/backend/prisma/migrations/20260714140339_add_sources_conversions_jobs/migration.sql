-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" VARCHAR(255) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "language" VARCHAR(10),
    "metadata" JSONB NOT NULL,
    "statistics" JSONB,
    "status" VARCHAR(20) NOT NULL,
    "provider_slug" VARCHAR(50) NOT NULL,
    "provider_name" VARCHAR(100) NOT NULL,
    "ttl_expires_at" TIMESTAMPTZ,
    "cache_ttl_hours" INTEGER NOT NULL DEFAULT 24,
    "retention_days" INTEGER,
    "last_access_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chapter_id" VARCHAR(100) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "pages" INTEGER,
    "volume" INTEGER,
    "placeholder_page_indices" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "covers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cover_id" VARCHAR(100) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "image_url" VARCHAR(2048) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "covers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversion_id" VARCHAR(100) NOT NULL,
    "user_id" UUID NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "cover" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "books" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "error_handling_strategy" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "completed_jobs" INTEGER NOT NULL DEFAULT 0,
    "failed_jobs" INTEGER NOT NULL DEFAULT 0,
    "running_jobs" INTEGER NOT NULL DEFAULT 0,
    "pending_jobs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" VARCHAR(100) NOT NULL,
    "conversion_id" UUID NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "book_index" INTEGER NOT NULL,
    "chapters" JSONB NOT NULL,
    "cover" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "error_handling_strategy" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "current_step" VARCHAR(50) NOT NULL DEFAULT '',
    "downloaded_images" INTEGER NOT NULL DEFAULT 0,
    "total_images" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "download_url" VARCHAR(2048),
    "output_file" VARCHAR(500),
    "output_size" BIGINT,

    CONSTRAINT "conversion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_source_id_key" ON "sources"("source_id");

-- CreateIndex
CREATE INDEX "sources_provider_slug_idx" ON "sources"("provider_slug");

-- CreateIndex
CREATE INDEX "sources_ttl_expires_at_idx" ON "sources"("ttl_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_chapter_id_key" ON "chapters"("chapter_id");

-- CreateIndex
CREATE INDEX "chapters_source_id_number_idx" ON "chapters"("source_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "covers_cover_id_key" ON "covers"("cover_id");

-- CreateIndex
CREATE INDEX "covers_source_id_idx" ON "covers"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversions_conversion_id_key" ON "conversions"("conversion_id");

-- CreateIndex
CREATE INDEX "conversions_user_id_created_at_idx" ON "conversions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "conversions_status_idx" ON "conversions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_jobs_job_id_key" ON "conversion_jobs"("job_id");

-- CreateIndex
CREATE INDEX "conversion_jobs_conversion_id_idx" ON "conversion_jobs"("conversion_id");

-- CreateIndex
CREATE INDEX "conversion_jobs_status_idx" ON "conversion_jobs"("status");

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("source_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "covers" ADD CONSTRAINT "covers_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("source_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_jobs" ADD CONSTRAINT "conversion_jobs_conversion_id_fkey" FOREIGN KEY ("conversion_id") REFERENCES "conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
