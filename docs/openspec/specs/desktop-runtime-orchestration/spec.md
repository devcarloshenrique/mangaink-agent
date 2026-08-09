# desktop-runtime-orchestration Specification

## Purpose
TBD - created by archiving change desktop-portable-runtime. Update Purpose after archive.
## Requirements
### Requirement: Boot sequence gerenciada do runtime

Em modo embedded, o `BackendManager` SHALL orquestrar: (1) porta livre para PostgreSQL e porta do backend; (2) initdb/pg_ctl/createdb (capability `embedded-postgres`); (3) `prisma migrate deploy` via Node do Electron; (4) spawn do backend com env gerenciada; (5) health poll em `/api/health` até `ok`. O backend DEVE receber `DATABASE_URL` derivada da porta do Postgres gerenciado, `MI_EMBEDDED_MODE=1`, `MI_DESKTOP_MANAGED=1`, `STORAGE_PATH={userData}/storage` e `PORT` da porta gerenciada.

#### Scenario: Boot completo em máquina limpa

- **WHEN** o app inicia em modo embedded em máquina sem Docker/Node/Redis/Postgres
- **THEN** o app executa a sequência completa e atinge o estado `ready` com o frontend carregado

#### Scenario: Falha do Postgres no boot

- **WHEN** `pg_ctl start` falha
- **THEN** o app transiciona para `postgres_failed` e a status screen exibe diagnóstico com stderr

### Requirement: Spawn sem Node no host

Em produção (packaged), o `BackendManager` SHALL spawnar backend e migrations usando `process.execPath` com `ELECTRON_RUN_AS_NODE=1` — nunca o binário `node` do PATH. Em dev (`desktop:dev` não packaged), o `node` do host permanece aceito.

#### Scenario: Backend spawnado pelo Node do Electron

- **WHEN** o app packaged inicia o backend
- **THEN** o comando spawnado é `{process.execPath} dist/app.js` com `ELECTRON_RUN_AS_NODE=1` no env

#### Scenario: Migrations spawnadas pelo Node do Electron

- **WHEN** o app packaged executa `prisma migrate deploy`
- **THEN** o comando spawnado usa `process.execPath` com `ELECTRON_RUN_AS_NODE=1`

### Requirement: Estados e status screen

A máquina de estados do `BackendManager` em modo embedded SHALL incluir `idle | starting | postgres_failed | migration_failed | backend_failed | ready`. A status screen MUST exibir mensagens em PT-BR com o estado atual, stderr de diagnóstico e botão de retry para estados de falha; o preflight de `docker version` DEVE ser removido do fluxo embedded.

#### Scenario: Retry após falha

- **WHEN** o app está em `postgres_failed` e o usuário clica em retry
- **THEN** o backend é reiniciado e o boot sequence roda novamente

#### Scenario: Sem dependência de Docker

- **WHEN** o app inicia em modo embedded
- **THEN** nenhuma checagem de Docker é executada e o estado `prereq_failed` não é alcançado por ausência de Docker

### Requirement: Settings gerenciados

Em modo embedded, `databaseUrl` e `redisUrl` do `settings.json` SHALL ser ignoradas — portas e URLs são gerenciadas pelo app. `backendPort` e `jwtSecret` continuam persistidos. O `SettingsStore` DEVE persistir o estado gerenciado (ex.: porta do Postgres escolhida) sem expor credenciais.

#### Scenario: URLs derivadas do runtime

- **WHEN** o backend é spawnado em modo embedded
- **THEN** o env `DATABASE_URL` aponta para `127.0.0.1:{porta_gerenciada}` e `REDIS_URL` não é injetado

### Requirement: Shutdown ordenado

No quit, o main SHALL encerrar na ordem: backend (SIGTERM → SIGKILL após grace), processos Python (KCC/extract_mobi em execução), e PostgreSQL (`pg_ctl stop -m fast -w`), sem deixar processos órfãos.

#### Scenario: Quit sem órfãos

- **WHEN** o usuário fecha o app com backend, conversão e Postgres em execução
- **THEN** todos os processos filhos terminam e nenhum processo `postgres.exe`/`python.exe`/`node.exe` do app sobrevive

