## Context

O `prisma/schema.prisma` atual possui apenas o modelo `User`. Toda a persistência de scraping e conversão é JSON no filesystem (`storage/{sources,conversions}`). Esta change **não** cria adapters Prisma — ela prepara o terreno: schema + mecanismo de composição. As interfaces de repositório (`SourceCacheRepository`, `ConversionRepository`, `ConversionJobRepository`) já existem e permanecem inalteradas.

A motivação original está em `docs/openspec/archive/scraping/design.md` §4.1 ("Por que filesystem para cache em vez de Redis?") — escolha válida para metadados pequenos isolados, mas que inviabiliza listagem/query por usuário (a biblioteca) e força `O(n)` I/O em `syncStatus()`.

## Goals / Non-Goals

**Goals:**
- Adicionar 5 modelos Prisma (Source, Chapter, Cover, Conversion, ConversionJob) + relations + índices.
- Gerar migration e aplicar localmente para validar o DDL.
- Introduzir flag `REPO_BACKEND` + helper `repo-mode.ts`.
- Criar `shared/database/repositories/index.ts` como ponto único de composição, retornando adapters `Filesystem*` por default e "not implemented" para Prisma neste estágio.

**Non-Goals:**
- Implementar `Prisma*Repository` (属于 a `migrate-source-cache-to-postgres` e `migrate-conversions-and-jobs-to-postgres`).
- Alterar use-cases, controllers ou workers.
- Migrar binários (imagens/EPUBs) — permanecem no filesystem.
- Escrever backfill de dados (属 backfill change).
- Migrar status.json para Redis (movido para `add-redis-live-job-status`).

## Decisions

### D1. Postgres-only, sem SQLite shadow
A migration usa `prisma migrate dev` contra o Postgres do `docker-compose.yml`. Testes de repos Prisma usarão a instância Postgres real (testcontainers futuro) — não SQLite — porque JSONB e `gen_random_uuid()` são específicos de Postgres.

### D2. Snapshot JSONB em vez de colunas explode
Para campos flexíveis (`books`, `options`, `metadata`, `cover`, `chapters[]` em jobs) usamos `JSONB`. Já campos que precisam de query/index (status, progresso, userId, createdAt) são escalares. Isso evita schema churn quando o frontend evoluir opções de conversão.

### D3. FKs "soft" para `sourceId` em Conversion
`conversions.source_id` é armazenada como `VARCHAR` referenciando `sources.source_id` (não `sources.id` UUID). Motivo: uma conversão faz referência de longa vida a um Source; se o cache do Source expirar (TTL 30 dias) a Conversion permanece legível. Não usar FK hard evita cascade não intencional quando o Source cacheado for expirado.

### D4. Default `REPO_BACKEND=filesystem`Safe durante transição. Composer usa lazy require do adapter Prisma para evitar import de código ainda não implementado.

### D5. `placeholder_page_indices` em `Chapter` (JSONB)
Substitui `images.json` por capítulo. Mantém o tipo `number[]` sem criar tabela separada (escrita rara, leitura direta por chapter).

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Migration em DB compartilhado travar tabelas existedntes | A migration só cria novas tabelas — sem `ALTER` em `users` além de adicionar relation (não-física). |
| Composer chamar adapter Prisma não-implementado | Lança erro explícito `"Prisma adapter for <X> not implemented"` em vez de crash genérico. |
| JSONB perde validação de tipo | Validado na camada de aplicação (repositorios Prisma sempre cowlem a interface que tipa via TypeScript); em DDL é livre. |
| `REPO_BACKEND` ser inadvertidamente alterado em produção | Default `filesystem` + check em CI para garantir que produção só muda após PR explícito de backfill. |
| `gen_random_uuid()` exige `pgcrypto`/Postgres 13+ | Já usado por `users.id` desde a migration inicial — confirmado compatível. |