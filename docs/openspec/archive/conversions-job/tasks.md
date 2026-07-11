# Conversion — Tasks de Implementação

> **Status:** IMPLEMENTED (original) / IMPLEMENTED (refatoração: Conversion + Books + Planner) / IMPLEMENTED (testes)
> **Data:** 2026-07-09 (original) / 2026-07-11 (refatoração e testes)

---

## 1-10. Implementação Original (Concluída)

Todas as tarefas das seções 1-10 foram implementadas conforme o design original:

1. **Configuração e Tipos** — `createJobId()`, env vars, `conversion.types.ts`, `conversion.errors.ts`
2. **Catálogo de Opções** — devices, formats, fields, presets, kcc-flag-mapper
3. **DTOs** — Zod schemas para options, create-job, job-params
4. **Repositórios** — `ConversionJobRepository` interface + impl filesystem
5. **Services** — queue, pubsub, events, image-downloader, kcc-runner
6. **Use Cases** — get-options, create-job, get-job, cancel-job
7. **Controllers** — 5 controllers por endpoint
8. **Routes** — `conversion.routes.ts` com 5 endpoints
9. **Worker** — BullMQ worker com fases download + KCC
10. **Infraestrutura** — registro no server, diretórios, env vars

---

## 11. Refatoração: Arquitetura Conversion + Books (Concluída)

### 11A. Novos Conceitos de Domínio

- [x] 11A.1 `types/conversion.types.ts` — Novos tipos: `ConversionConfig`, `ConversionStatusFile`, `ConversionState`, `Book`, `ConversionJobSummary`, `ConversionStatus` (`queued | processing | completed | failed | cancelled | partial`), `JobMetadata` (title obrigatório), `CoverRef`
- [x] 11A.2 `types/conversion.types.ts` — `ConversionJobConfig` e `ConversionJobData` com `conversionId`, `bookIndex`, `JobMetadata`
- [x] 11A.3 `errors/conversion.errors.ts` — Novos erros: `ConversionNotFoundError`, `SourceNotFoundError`, `InvalidConversionStateError`, `DuplicateChapterError`, `ChapterNotFoundError`

### 11B. Conversion Planner

- [x] 11B.1 `use-cases/create-conversion.use-case.ts` — Planner completo:
  - Valida deviceId e format contra catálogo
  - Verifica existência do `sourceId` e `metadata.json`
  - Valida capítulos: duplicados entre Books e inexistentes na source
  - Aplica herança de capa global (Book sem `cover` herda o global)
  - Gera 1 Job por Book (com `batchSplit: 'none'`, `fileFusion: false`)
  - Persiste Conversion + cada Job em disco aninhado
  - Enfileira todos os Jobs no BullMQ
  - Emite evento `conversion.created`

### 11C. Repositório de Conversion

- [x] 11C.1 `repositories/conversion.repository.ts` — Interface: `create()`, `findById()`, `update()`, `syncStatus()`, `listJobIds()`, `appendLog()`, `delete()`
- [x] 11C.2 `repositories/filesystem-conversion.repository.ts` — Implementação:
  - Layout: `conversions/{convId}/{config.json, status.json, logs/, jobs/}`
  - `syncStatus()` lê todos os `status.json` dos Jobs, computa agregado, escreve `status.json`
  - Contadores: `completedJobs`, `failedJobs`, `runningJobs`, `pendingJobs`
  - Campos temporais: `updatedAt` sempre, `finishedAt` quando terminal
  - **Sem diretório `outputs/`** — cada Job é dono do seu EPUB

### 11D. Repositório de Job (Escopo por Conversion)

- [x] 11D.1 `repositories/conversion-job.repository.ts` — Adicionado `withConversion(conversionId): ConversionJobRepository`
- [x] 11D.2 `repositories/filesystem-job.repository.ts` — Construtor aceita `conversionId`; escopo: `{root}/{conversionId}/jobs/{jobId}/`

### 11E. SSE Fan-in da Conversion

- [x] 11E.1 `services/conversion-pubsub.service.ts` — `subscribeMany(jobIds, cb)`, `unsubscribeMany(jobIds, cb)` para fan-in de múltiplos canais
- [x] 11E.2 `services/conversion-events.service.ts` — `connectConversionToSSE(jobIds, reply)`: assina todos os canais dos Jobs, encaminha eventos com `jobId` em `data`
- [x] 11E.3 `controllers/conversion-events.controller.ts` — SSE que faz fan-in de todos os Jobs da Conversion

### 11F. Novas Rotas

- [x] 11F.1 `POST /api/conversions` — Cria Conversion via Planner (`books: [...]`)
- [x] 11F.2 `GET /api/conversions/:conversionId` — Status agregado (syncStatus em tempo real)
- [x] 11F.3 `GET /api/conversions/:conversionId/events` — SSE fan-in
- [x] 11F.4 `DELETE /api/conversions/:conversionId` + `POST .../cancel` — Cancelamento
- [x] 11F.5 `GET /api/conversions/options` — Mantido, sem `batchSplit`/`fileFusion`

### 11G. Worker Sincronizado

- [x] 11G.1 Worker chama `conversions.syncStatus(conversionId)` após cada `repository.update()`
- [x] 11G.2 Worker handler de erro (`on('failed')`) também chama `syncStatus()`
- [x] 11G.3 `downloadUrl` atualizado para `/api/conversions/{conversionId}/jobs/{jobId}/download`

### 11H. Limpeza da API Pública

- [x] 11H.1 `config/fields.ts` — Removidas definições de `batchSplit` e `fileFusion`
- [x] 11H.2 `use-cases/get-conversion-options.use-case.ts` — Filtro de defesa: remove `batchSplit`/`fileFusion` de `fields` e `presets.values`
- [x] 11H.3 `dtos/create-conversion.dto.ts` — Schema Zod com `books: [...]`, sem `batchSplit`/`fileFusion`
- [x] 11H.4 Removidos arquivos obsoletos: controllers/use-cases/dtos de Job (somente Conversion exposta)

---

## 12. Testes Unitários (Concluído)

### Helpers

- [x] 12.0.1 `tests/helpers/in-memory-conversion.repository.ts` — Repositório in-memory para `ConversionRepository` com `syncStatus()`
- [x] 12.0.2 `tests/helpers/mock-conversion-queue.service.ts` — Mock do `ConversionQueueService` (enqueue/remove/getJob)
- [x] 12.0.3 `tests/helpers/mock-conversion-events.service.ts` — Mock do `ConversionEventsService` (emit)
- [x] 12.0.4 `tests/helpers/fixtures.ts` — Dados: `makeCover()`, `makeBook()`, `makeConversionConfig()`, `makeSourceMetadata()`
- [x] 12.0.5 `tests/helpers/mock-job.repository.ts` — Mock do `ConversionJobRepository` com `withConversion()` scoping

### Use Cases

- [x] 12.1 `tests/unit/create-conversion.use-case.test.ts` — 11 testes (Planner):
  - Cria Conversion com N Books → gera N Jobs → retorna conversionId + totalJobs
  - Valida deviceId inválido → 400
  - Valida format inválido → 400
  - Source inexistente → 404
  - Capítulo duplicado entre Books → 404
  - Capítulo inexistente → 404
  - Herança de capa global (Book sem cover herda o global)
  - Cover específico do Book sobrescreve o global
  - `batchSplit: 'none'` e `fileFusion: false` em todos os Jobs
  - Metadados `metadata.title` vindo de `book.title` em cada Job

- [x] 12.2 `tests/unit/get-conversion-options.use-case.test.ts` — 7 testes:
  - Retorna devices, formats, fields, presets
  - **Não** retorna `batchSplit` nem `fileFusion` em fields
  - **Não** retorna `batchSplit` nem `fileFusion` em presets.values

- [x] 12.3 `tests/unit/get-conversion.use-case.test.ts` — 6 testes:
  - Delega para `syncStatus()` → retorna estado (queued, processing, completed, partial)
  - Conversion inexistente → 404 com `CONVERSION_NOT_FOUND`

- [x] 12.4 `tests/unit/cancel-conversion.use-case.test.ts` — 9 testes:
  - Cancela todos os Jobs queued/running → chama `syncStatus()`
  - Cancela apenas jobs queued ou ativos (completed não é afetado)
  - Conversion completed → 409 (`InvalidConversionStateError`)
  - Conversion cancelled → 409 (`InvalidConversionStateError`)
  - Conversion failed → 409 (`InvalidConversionStateError`)
  - Conversion inexistente → 404 (`ConversionNotFoundError`)
  - Status partial permite cancelamento
  - Emite evento `conversion.cancelled` no canal correto
  - Verifica que `syncStatus` foi invocado após cancelamento

- [x] 12.5 `tests/unit/conversion.errors.test.ts` — 12 testes:
  - Criação de cada erro com name e código corretos
  - Formato da mensagem

- [x] 12.6 `tests/unit/kcc-flag-mapper.test.ts` — 27 testes:
  - Preset manga: `-m -c 2 -u`
  - Preset noProcessing: apenas `-n`
  - Enums: `splitter: "rotate"` → `-r 1`
  - `-p K11 -f EPUB`
  - Numéricos e booleans

---

## 13. Testes E2E (Concluído)

- [x] 13.1 `GET /api/conversions/options` → 200 com devices, formats, fields (sem batchSplit/fileFusion), presets
- [x] 13.2 `POST /api/conversions` → 202 com `conversionId` e `totalJobs`; valida erros 400/404
- [x] 13.3 `GET /api/conversions/:conversionId` → 200 com `status`, `runningJobs`, `pendingJobs`, `jobs[]`
- [x] 13.4 `DELETE /api/conversions/:conversionId` → 200 cancelled; 409 se completed
- [x] 13.5 `GET /api/conversions/:conversionId/events` → headers SSE corretos

> **Tests:** 76 no modulo (27 kcc-flag-mapper + 12 errors + 11 create-conversion + 7 get-options + 6 get-conversion + 9 cancel-conversion + 4 E2E)
> **Cobertura:** 76 passam, 0 falham (31 arquivos, 287 testes totais no projeto)

---

## Ordem de Implementação

```
1-10 (original) → 11A...11H (refatoração) → 12 (testes unitários) → 13 (testes E2E)
```
