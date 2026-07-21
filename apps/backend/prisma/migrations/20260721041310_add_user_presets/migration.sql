-- CreateTable
CREATE TABLE "user_presets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "values" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMPTZ,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_presets_user_id_idx" ON "user_presets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_presets_user_id_name_key" ON "user_presets"("user_id", "name");

-- AddForeignKey
ALTER TABLE "user_presets" ADD CONSTRAINT "user_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
