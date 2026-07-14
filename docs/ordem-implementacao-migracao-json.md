# Ordem de Implementacao — Migracao JSON para Postgres + Redis

> **Status:** Changes prontas para implementacao (6 changes em `docs/openspec/changes/`)
> **Data:** 2026-07-14
> **Resultado `openspec validate --all --strict`:** 6 passed, 0 failed
> **Para validar:** `cd docs/openspec && npx openspec validate --all --strict`

---

## Resumo

Plano completo para migrar a persistencia de metadados do filesystem JSON para PostgreSQL (e Redis para status live), habilitando:

1. **Biblioteca por usuario** — listagem paginada de conversoes com filtros (`GET /api/conversions`)
2. **Performance no hot path** — status de Job em Redis Hash em vez de Postgres `UPDATE` por fase
3. **Arquitetura limpa** — repositorios Prisma implementando as interfaces existentes (`SourceCacheRepository`, `ConversionRepository`, `ConversionJobRepository`), selecionaveis via `REPO_BACKEND=filesystem|prisma`

**Binarios** (imagens `.webp`, capas, EPUBs de saida) **permanecem no filesystem** — apenas metadados estruturados migram para o DB.

---

## Ordem de implementacao

```
1) add-prisma-schema-and-repo-composition
        │
        ├──2) migrate-source-cache-to-postgres           ┐ pode rodar em paralelo
        │                                                │ interfaces distintas
        └──3) migrate-conversions-and-jobs-to-postgres   ┘
                  │
                  ├──4) add-conversion-library-listing
                  │
                  └──5) add-redis-live-job-status
                            │
                            └──6) backfill-and-cleanup-legacy-json
```

---

## Detalhamento das Changes

### 1. `add-prisma-schema-and-repo-composition` (Foundation)
**Depende de:** nada
**Descricao:** Adiciona 5 modelos ao Prisma (`Source`, `Chapter`, `Cover`, `Conversion`, `ConversionJob`) + migration + `REPO_BACKEND` flag + composer `shared/database/repositories/index.ts`. Default `filesystem` — zero impacto em producao.
**Habilita:** todas as changes seguintes.

### 2. `migrate-source-cache-to-postgres`
**Depende de:** #1
**Descricao:** Implementa `PrismaSourceRepository` cobrindo `SourceCacheRepository`. Migra `metadata.json` para tabelas `sources`/`chapters`/`covers`; absorve `images.json` como `Chapter.placeholder_page_indices` (JSONB). Binarios (imagens) continuam no filesystem.
**Habilita:** lookup indexado de fontes, future admin panel.

### 3. `migrate-conversions-and-jobs-to-postgres`
**Depende de:** #1
**Descricao:** Implementa `PrismaConversionRepository` + `PrismaJobRepository`. Move config/estado/snapshot para Postgres. `syncStatus()` le de Postgres (nao mais I/O de arquivos). Worker brancha por `REPO_BACKEND` para persistir no DB.
**Habilita:** queries por usuario (FK user_id -> users.id).

### 4. `add-conversion-library-listing`
**Depende de:** #3
**Descricao:** Novo endpoint `GET /api/conversions` paginado por usuario (`userId` do JWT) com filtros `status`/`sourceId`. Usa indice `(user_id, created_at DESC)`. Retorna 501 em filesystem mode. Use-case + controller + DTO Zod + testes.
**Habilita:** tela `biblioteca.index.tsx` a consumir dados reais. **Feature prioritaria (biblioteca).**

### 5. `add-redis-live-job-status`
**Depende de:** #3
**Descricao:** Mover status quente do Job para Redis Hash (`conv:status:{jobId}`) com TTL (`JOB_STATUS_TTL_SEC=21600`). Worker escreve `HSET` no hot path; `UPDATE` Postgres apenas em terminal. `syncStatus()` hibrido (Redis live + Postgres durave). Cancelamento Redis-first (detectado em <1s). `JobLiveStatusStore` em `shared/redis/`.
**Habilita:** performance no hot path de conversao; reduz carga de Postgres em ~500+ `UPDATE`s por conversao grande.

### 6. `backfill-and-cleanup-legacy-json`
**Depende de:** #2, #3, #5
**Descricao:** Scripts `pnpm backfill` + `pnpm cleanup:legacy-{metadata,status}`. Backfill idempotente com `--dry-run` preview, checkpoint Redis, skip se `userId` missing. Cleanup apaga JSONs confirmados (preserva logs/binarios). Runbook `docs/migracao-json-para-postgres.md` com passo a passo operacional.
**Habilita:** switch definitivo de `REPO_BACKEND=prisma` em producao.

---

## Estrutura de cada change

Cada change em `docs/openspec/changes/<nome>/` contem:
- `proposal.md` — Por que, o que muda, capacidades, impacto
- `design.md` — Decisoes tecnicas, goals/non-goals, riscos, trade-offs
- `tasks.md` — Tarefas quebradas em grupos (com checkboxes `[ ]`)
- `specs/<capability>/spec.md` — Requisitos com cenarios WHEN/THEN
- `README.md` — Descricao curta (auto-scaffold)
- `.openspec.yaml` — Metadata (schema + data de criacao)

---

## Novos endpoints

| Metodo | Rota | Change | Objetivo |
|--------|------|--------|----------|
| `GET` | `/api/conversions` | #4 | Listagem paginada de conversoes por usuario |
| `GET` | `/api/conversions/:id` | #3 | Atualizado para ler do Postgres |
| `DELETE` | `/api/conversions/:id` | #3 | Cancelamento persiste no DB |

---

## Novas tabelas (Change #1)

| Tabela | Quantidade estimada | Indices principais |
|--------|-------------------|--------------------|
| `sources` | dezenas/centenas | `source_id` PK, `(provider_slug)`, `(ttl_expires_at)` |
| `chapters` | milhares (50-200 por source) | `(source_id, number)`, `chapter_id` UNIQUE |
| `covers` | centenas | `(source_id)`, `cover_id` UNIQUE |
| `conversions` | centenas/milhares | `(user_id, created_at DESC)`, `(status)`, `conversion_id` UNIQUE |
| `conversion_jobs` | milhares (1-10 por conversion) | `(conversion_id)`, `(status)`, `job_id` UNIQUE |

---

## Novas variaveis de ambiente

| Variavel | Change | Default | Descricao |
|----------|--------|---------|-----------|
| `REPO_BACKEND` | #1 | `filesystem` | Seleciona adapter de persistencia (`filesystem` ou `prisma`) |
| `JOB_STATUS_TTL_SEC` | #5 | `21600` (6h) | TTL do Redis Hash para status live de Job |

---

## Convencoes

- **Nao remover `Filesystem*Repository`** durante a transicao — coexistem com os adapters Prisma via flag
- **`syncStatus()`** mantem contrato de retorno inalterado (adapter decide de onde ler)
- **Binarios nunca migram** — so metadados; caminhos no disco continuam derivaveis de IDs
- **`REPO_BACKEND=prisma` so em producao apos backfill** (change #6)
- **Parametro `--dry-run`** disponivel nos scripts de backfill e cleanup
