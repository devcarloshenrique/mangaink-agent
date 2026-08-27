# Schema do Banco de Dados — MangaInk Agent

> Fonte da verdade: `apps/backend/prisma/schema.prisma`. PostgreSQL, colunas em
> snake_case via `@map()`.

## Diagrama de Relações

```text
┌──────────┐ 1     N ┌────────────────────┐ N     1 ┌─────────────┐
│  users   ├─────────┤    conversions     ├─────────┤   sources   │
│ usuário  │         │ pedido de conversão│ (soft)  │ obra no site│
└────┬─────┘         └─────────┬──────────┘         └──────┬──────┘
     │ 1                       │ 1
     │                         │ N
     │ N              ┌────────┴──────────┐
┌────┴──────────────┐│  conversion_jobs  │
│   notifications   ││ job de um volume  │
│ atividade em bg   │└───────────────────┘
├───────────────────┤
│ user_presets      │ N──1 → users
├───────────────────┤
│user_chapter_progress│ N──1 → users, sources, chapters
└───────────────────┘
```

- Linha sólida = FK com `ON DELETE CASCADE` (apagar o pai apaga os filhos).
- `conversions → sources` é referência **soft** (sem FK): o cache de scraping
  pode expirar sem quebrar o histórico de conversões.

## Modelos

### `users` (User)

Quem usa a aplicação. Login por email/username com senha hash.

### `sources` / `chapters` / `covers` (cache de scraping)

Cópia local dos metadados da obra raspada do site de origem (`sourceId`
determinístico via SHA-256 da URL). As imagens baixadas vivem no filesystem,
não no banco.

### `conversions` / `conversion_jobs`

Conversão pedida pelo usuário: "quero os capítulos X, Y, Z do mangá W em EPUB
para meu Kindle". Cada Book do plano vira um `conversion_job`, processado por
worker BullMQ. `config.json` persiste `userId` para checagem de ownership.

### `notifications` (Notification)

**Novo.** Atividade em background que terminou (volume pronto/conversão falhou/
download concluído ou falhou). É o que alimenta o sino do header e o modal
"histórico completo". Progresso ao vivo NÃO mora aqui — é SSE + status store.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID pk | gerado pelo banco (`gen_random_uuid()`) |
| `user_id` | UUID, FK → users | dono da notificação; CASCADE ao deletar o usuário |
| `type` | VARCHAR(40) | `volume_ready` \| `conversion_failed` \| `conversion_cancelled` \| `download_completed` \| `download_failed` |
| `title` | VARCHAR(200) | título curto exibido no sino |
| `message` | VARCHAR(500) | linha de detalhe ("12 capítulos • 3.4k imagens") |
| `metadata` | JSONB nullable | dados de navegação/expansão (ver abaixo) |
| `read_at` | TIMESTAMPTZ null | null = não lida (badge vermelho); idempotente ao marcar |
| `created_at` | TIMESTAMPTZ | ordenação "mais recente primeiro" |

**JSONB — `metadata`**: exemplo real de um lote download-only com falhas:

```json
{
  "conversionId": "conv_abc123",
  "jobId": "job_def456",
  "successfulChapters": 8,
  "totalImages": 1240,
  "failedChapters": [
    { "chapterId": "chap_0007", "reason": "Sem imagens disponíveis no site de origem" }
  ]
}
```

Para conversões completas entram `bookTitle`, `format`, `outputFile`,
`outputSize`. O frontend usa `conversionId`/`sourceId` para navegar ao clicar.

**Retenção**: serviço (`NotificationService`) mantém as **100 mais recentes**
por usuário via `pruneKeepLatest` (fire-and-forget após cada `notify`). O
empate de `created_at` pode manter alguns registros extras — inofensivo.

**Índices**:
- `(user_id, created_at DESC)` — listagem do sino.
- `(user_id, read_at)` — contagem de não lidas.

### `user_presets` / `user_chapter_progress`

Presets de opções de conversão por usuário; progresso de leitura por capítulo
(únicos por `(user, source, chapter)`).

## Fluxo Completo da Aplicação no Banco

1. Usuário inspeciona URL → cache de scraping (`sources/chapters/covers`).
2. Wizard cria `conversions` (+ jobs); workers atualizam jobs e status agregado.
3. Ao terminar/falhar/cancelar um job, o worker chama `NotificationService.notify()`
   → INSERT em `notifications` + publish no Pub/Sub (`user-notifications:{userId}`).
4. Conversões canceladas **não geram** notificação (suprimidas no owner-notifier).
5. Frontend recebe via SSE, lista via `GET /api/notifications`, marca leitura
   com `PATCH .../read` e limpa histórico com `DELETE /api/notifications`.

## IDs de Negócio × IDs Internos

- `sourceId` — SHA-256 da URL normalizada (determinístico).
- `conversionId`/`jobId` — ids de negócio nos arquivos de storage; no banco as
  linhas têm UUID interno.
- `notification.id` — UUID do banco, usado direto na API/UI.

## Convenções

- Tabelas plural em snake_case (`@@map`), colunas snake_case (`@map`).
- Timestamps `Timestamptz`; datas trafegam como ISO string na API.
- Todo acesso escopado por `userId` na camada de repositório (ownership).
- JSONB sempre documentado com exemplo nesta página.
