-- AlterTable
ALTER TABLE "covers" ADD COLUMN "user_id" UUID;

-- CreateIndex
CREATE INDEX "covers_user_id_idx" ON "covers"("user_id");

-- AddForeignKey
ALTER TABLE "covers" ADD CONSTRAINT "covers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
