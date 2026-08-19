-- Adiciona o papel do usuário (RBAC — VULN-02/MEC-52)
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
