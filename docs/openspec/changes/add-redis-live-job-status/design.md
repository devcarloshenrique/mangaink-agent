## Context

Pós-change `migrate-conversions-and-jobs-to-postgres`, o hot path de status Job é Postgres — sobrecarga de `UPDATE` por fase + progress. Redis já é usado para journals (TTL 1h), locks e Pub/Sub; falta adicionar Hash live status. Voltar para Redis solucione:

1. **Hot path O(1)**: `HSET` atômico em RAM (vs `UPDATE` indexado em Postgres + WAL).
2. **syncStatus barato**: `HGETALL` em massa, em vez de `SELECT` por Job.
3. **Cancel signal O(1)**: `HGET status`, em vez de `SELECT` por PK a cada capítulo.

## Goals / Non-Goals

**Goals:**
- Introduzir `JobLiveStatusStore` (Hash + TTL).
- Worker branch: escreve HSET em execução, `UPDATE` Postgres apenas no terminal.
- `syncStatus` híbrido: Redis live + Postgres terminal.
- Cancelamento write Redis-first (worker detecta em <1s).
- `JOB_STATUS_TTL_SEC` configurável.

**Non-Goals:**
- Persistir status live permanentemente — terminal snapshot é em Postgres.
- Migrar logs para Redis — `conversion.log` continua append-only em filesystem.
- Migrar config imutável de Job/Conversion — fica em Postgres (já feito pela change 3).
- Migrar binários — filesystem.
- Mover journals de eventos — já estão em Redis (TTL 1h), permanecem.
- Implementar em filesystem mode — inalterado.

## Decisions

### D1. Undo dúvida: syncStatus ainda persiste em Postgres Aggregates
Após mesclar Redis + Postgres, ainda faz `UPDATE conversions SET status, progress, contadores`. Motivo: listagem por usuário (change 4) e `GET /:id` precisam de último snapshot durável → cliente conecta após Redis ter expirado/limpo.

### D2. Fallback durável
Se Redis estiver vazio para um Job running (reboot/crash/expira TTL antes do terminal), `syncStatus` cai para o último snapshot em Postgres (que pode ser stale mas existe). Worker continua escrevendo live assim que possível. Trade-off aceitável — estado terminal é canonizado em Postgres.

### D3. Cancel Redis-first com eventual Postgres write
Cancel escreve no Redis imediato (worker aborta em <1s); Postgres UPDATE pode ser feito em background pelo use-case, mas nunca opcópia o Redis-first (ordem importa). Worker, ao detectar aborta, ele próprio faz `UPDATE ... SET status='cancelled'` + `clear(jobId)` no Redis.

### D4. TTL de 6h ~ duração máxima de conversão
Conversões longas (KCC em volumes grandes) podem durar até minutos. TTL 6h dá margem. Job terminais limpam a chave explicitamente via `clear`.

### D5. MGET em massa em `syncStatus`
Em vez de N `HGETALL` individuais, usar `HGETALL` por chave (não há MGET Hash bulk em Redis; usar pipeline ioredis). Custos marginais.

### D6. Acoplamento com `progress` eventos de SSE
SSE continua funcionando através da Pub/Sub existente (`conversion-job:{jobId}`) — não muda. O journal (List com TTL 1h) continua dando replay.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Redis cai mid-conversion → live status perdido | Worker, ao restaurar, recriia HSET com estado atual; syncStatus fallback Postgres |
| TTL expira antes de Job completar (conversão > 6h) | Renova TTL a cada `set`. Se ainda expira, fallback Postgres para syncStatus; worker ainda escreve terminal ao concluir |
| Cancelamento chega antes do worker pausar o download | Loop de ciclo-check é por capítulo; relido `HGET status` antes de cada download — máximo 1 capítulo de trabalho perdido |
| Postgres UPDATE em syncStatus ainda chato em poll alto | Mitigado pois leitura é Redis-first; UPDATE agregado é barato (índices PK). Futuro: skip UPDATE se estado não mudou |
| Pipeline ioredis precisa de conexão separada | Reusar `getRedis()` singleton ou usar a conexão pub sub existente |