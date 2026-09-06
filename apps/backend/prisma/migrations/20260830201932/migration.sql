-- CreateTable
CREATE TABLE "user_library" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_library_user_id_updated_at_idx" ON "user_library"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "user_library_user_id_is_favorite_idx" ON "user_library"("user_id", "is_favorite");

-- CreateIndex
CREATE UNIQUE INDEX "user_library_user_id_source_id_key" ON "user_library"("user_id", "source_id");

-- AddForeignKey
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("source_id") ON DELETE CASCADE ON UPDATE CASCADE;
