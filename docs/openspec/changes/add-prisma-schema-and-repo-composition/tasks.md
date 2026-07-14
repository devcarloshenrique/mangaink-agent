## 1. Schema Prisma

- [ ] 1.1 Adicionar ao `apps/backend/prisma/schema.prisma` os modelos `Source`, `Chapter`, `Cover`, `Conversion`, `ConversionJob` conforme design (com fields JSONB, FKs, índices e `@@map` para nomes de tabela snake_case).
- [ ] 1.2 Adicionar relation `conversions Conversion[]` ao modelo `User` (com `@@map("users")` inalterado).
- [ ] 1.3 Confirmar uso de `gen_random_uuid()` via `@default(dbgenerated(...))` em todas as PKs UUID.
- [ ] 1.4 Garantir que `Conversion.source_id` seja `String` (não FK hard) e armazene `sources.source_id` (VARCHAR sem `@relation`).
- [ ] 1.5 Confirmar que `ConversionJob.cover`, `output`, `metadata`, `options`, `chapters` são `Json` (JSONB).
- [ ] 1.6 Confirmar que `Chapter.placeholder_page_indices` é `Json?` nullable.

## 2. Migration

- [ ] 2.1 Rodar `pnpm db:migrate --name add_sources_conversions_jobs` em ambiente local com Postgres de `docker-compose up -d`.
- [ ] 2.2 Revisar o SQL gerado (arquivo `migration.sql` em `apps/backend/prisma/migrations/<timestamp>_add_sources_conversions_jobs/`).
- [ ] 2.3 Verificar via `pnpm db:studio` que tabelas foram criadas com PKs, FKs e índices.
- [ ] 2.4 Rodar `pnpm build:backend` para confirmar que `Prisma Client` regenerado compila.

## 3. Configuração de Adapter Backend

- [ ] 3.1 Em `apps/backend/src/shared/config/env.ts`, adicionar `REPO_BACKEND` ao schema Zod como `z.enum(["filesystem","prisma"]).default("filesystem")`.
- [ ] 3.2 Atualizar o tipo exportado `env` e o `EnvSchema` accordingly.
- [ ] 3.3 Criar `apps/backend/src/shared/config/repo-mode.ts` exportando `REPO_BACKEND` (tipado) e `isPrismaBackend(): boolean`.

## 4. Composer de Repositórios

- [ ] 4.1 Criar `apps/backend/src/shared/database/repositories/index.ts` com fábricas: `getSourceRepository()`, `getConversionRepository()`, `getConversionJobRepository()` (assinaturas retornam as interfaces conhecidas).
- [ ] 4.2 Implementar cada fábrica para retornar a instância `Filesystem*Repository` atual quando `REPO_BACKEND === "filesystem"`.
- [ ] 4.3 Para `REPO_BACKEND === "prisma"`, lançar `Error("Prisma adapter for <X> not implemented yet — implement in subsequent change")` (placeholder — será substituído pelas changes seguintes).
- [ ] 4.4 Garantir que o arquivo não importa diretamente os `Prisma*Repository` em PR-mode (lazy import opcional; preferível não referenciar — placeholder é suficiente).

## 5. Documentação e Convenções

- [ ] 5.1 Atualizar `CLAUDE.md` seção "Variáveis de Ambiente" com `REPO_BACKEND` (descrição, padrão).
- [ ] 5.2 Atualizar `apps/backend/README.md` (se existir) ou acrescentar nota em `CLAUDE.md` sobre o composer `shared/database/repositories/index.ts`.

## 6. Validação

- [ ] 6.1 Rodar `pnpm build:backend` sem erros de TypeScript.
- [ ] 6.2 Rodar `pnpm test` (Vitest do backend) — todos testes existentes passam com `REPO_BACKEND=filesystem` (default).
- [ ] 6.3 Confirmar via introspecção (`pnpm db:studio`) que 5 novas tabelas existem e o `users` permanece intacto.
- [ ] 6.4 Confirmar que endpoints existentes continuam funcionando sem alteração (`pnpm dev:backend` + smoke `GET /api/conversions/options`, `GET /users/me`).