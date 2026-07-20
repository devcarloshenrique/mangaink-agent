## Context

A suíte de testes do backend (55 arquivos, 532 testes) usa Vitest com `pool: 'forks'`. O banco de dados é PostgreSQL (`mangaink_agent_test_db`) isolado do ambiente de desenvolvimento. A infraestrutura cobre três estratégias de isolamento: InMemory repositories (maioria dos testes), mocks via `vi.mock` (Redis, BullMQ, ioredis) e testes de integração com PostgreSQL real (3 arquivos).

**Problemas identificados:**

1. 12 testes falham no Windows devido a strings de path POSIX hardcoded em mocks de `env` e asserções.
2. 120+ diretórios acumulam-se em `./storage/conversions/` após execuções consecutivas.
3. O singleton `prisma.ts` (`new PrismaClient({ adapter: new PrismaPg(...) })`) é executado no `import` do módulo — qualquer teste que transitivamente importe este módulo crasha se PostgreSQL não estiver disponível.
4. O singleton `env.ts` executa `safeParse(process.env)` no `import` — se `JWT_SECRET` (obrigatório, sem default) não estiver definido, a suíte inteira crasha.

## Goals / Non-Goals

**Goals:**
- Todos os 532 testes passam em Windows e Linux com 0 falhas.
- Nenhum artefato residual após execução da suíte (duas execuções consecutivas idênticas).
- Testes que não usam banco de dados podem ser executados sem PostgreSQL disponível.
- `.env.test` é autossuficiente (todas as vars obrigatórias definidas).

**Non-Goals:**
- Substituir PostgreSQL por SQLite (schema usa recursos exclusivos do PostgreSQL; apenas 3/55 arquivos usam BD real).
- Alterar código de produção.
- Adicionar CI pipeline (fora do escopo desta change).
- Mockar ou converter os 3 testes de repositório Prisma para InMemory (melhoria futura opcional).

## Decisions

### D1: Paths portáteis entre sistemas operacionais

Paths construídos em tempo de execução devem usar `path.join()` / `path.resolve()`. Strings literais com `/` ou `\` não são portáteis.

**Rationale:** 12 testes falham no Windows porque mocks de `env` injetam strings como `'/test/storage'` e o código de produção usa `path.join()` que produz `\test\storage` no Windows. Asserções como `toContain('/covers/')` falham pelo mesmo motivo.

### D2: Storage de teste isolado e temporário

O diretório de storage usado pelos testes deve ser exclusivo da execução, criado no `globalSetup` e removido no `globalTeardown`.

**Rationale:** 120+ diretórios residuais provam que os testes escrevem em paths reais (`./storage`) e nunca limpam. Usar `os.tmpdir()` + UUID garante isolamento entre execuções e entre workers paralelos.

### D3: Independência de infraestrutura externa

A mera importação de módulos de infraestrutura (`prisma.ts`, `env.ts`) não deve causar falha em testes que não utilizam esses recursos.

**Rationale:** O singleton `prisma.ts` tenta conectar ao PostgreSQL no `import`. Se o banco estiver offline, TODOS os testes crasham — inclusive os 52/55 que não usam banco. Similarmente, `env.ts` crasha no `import` se `JWT_SECRET` não estiver definido.

### D4: Ambiente de teste autossuficiente

`.env.test` deve definir todas as variáveis de ambiente obrigatórias (aquelas sem `.default()` no schema Zod).

**Rationale:** `envSchema.safeParse(process.env)` é executado no `import` do módulo. Se qualquer `z.string()` sem `.default()` estiver ausente, o parse falha e a suíte crasha antes de executar qualquer teste.

### D5: Limpeza automática de recursos

Todos os recursos criados por testes (arquivos, diretórios, registros de BD) devem ser removidos ao final da execução, independentemente de o teste passar ou falhar.

**Rationale:** O acúmulo de 120+ diretórios entre execuções polui o filesystem e pode causar falsos positivos em testes que verificam existência de arquivos.

### D6: Banco de dados de teste isolado

O banco de dados usado por testes de integração deve ser distinto do banco de desenvolvimento.

**Rationale:** O PostgreSQL com database separado (`mangaink_agent_test_db`) já atende este requisito. SQLite não se justifica — exigiria manutenção de schema dual para 3/55 arquivos de teste.

### D7: Workers paralelos com recursos independentes

Quando `fileParallelism > 1`, cada worker deve usar recursos (storage, ports) que não conflitem com outros workers.

**Rationale:** Com `pool: 'forks'` e paralelismo de arquivos, múltiplos processos podem competir pelo mesmo `STORAGE_PATH`. Cada worker deve ter seu próprio subdiretório ou o paralelismo de arquivos deve ser desabilitado quando testes compartilham storage.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `globalTeardown` pode não executar em caso de `SIGKILL` | Usar prefixo identificável (`mangaink-test-`) no tmpdir; SO limpa tmpdir periodicamente |
| Lazy init do `prisma.ts` pode introduzir race condition em produção | O singleton lazy usa padrão thread-safe com variável local; Fastify é single-threaded |
| Testes que mockam `env` podem conflitar com `globalSetup` | `vi.hoisted()` garante que mocks de `env` executam antes do `globalSetup` |
| Mudanças futuras no schema podem adicionar features PostgreSQL-específicas | Já documentado que o schema assume PostgreSQL; migração para SQLite requer change separada |
