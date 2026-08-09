## ADDED Requirements

### Requirement: Runtime PostgreSQL portável vendored

O desktop SHALL incluir o binário portable do PostgreSQL (zip de binários EDB para Windows x64) em `apps/desktop/resources/runtime/postgres/`, com versão fixa registrada em `runtime-manifest.json` (URL + SHA256). O manifest MUST incluir o hash de cada artefato vendored, e o script de preparação DEVE falhar se o hash não conferir.

#### Scenario: Runtime preparado com sucesso

- **WHEN** `pnpm desktop:prepare:runtime` executa e todos os hashes do manifest conferem
- **THEN** `apps/desktop/resources/runtime/postgres/bin/pg_ctl.exe` existe e o script reporta sucesso

#### Scenario: Artefato com hash divergente

- **WHEN** um artefato baixado não confere com o SHA256 do manifest
- **THEN** o script falha com mensagem clara e não produz `resources/runtime/` utilizável

### Requirement: Inicialização do cluster (initdb)

Na primeira execução, quando `{userData}/pgdata` não existir, o processo main SHALL executar `initdb` (usuário `postgres`, auth `trust`, encoding UTF-8) antes de iniciar o servidor.

#### Scenario: Primeira execução sem pgdata

- **WHEN** o app inicia em modo embedded e `{userData}/pgdata` não existe
- **THEN** o app executa `initdb` e reporta o cluster pronto para o passo de start

#### Scenario: pgdata já existente

- **WHEN** o app inicia e `{userData}/pgdata` já existe
- **THEN** o app pula `initdb` e parte direto para o start do servidor

### Requirement: Start e stop do servidor gerenciados

O processo main DEVE iniciar o PostgreSQL com `pg_ctl start -w` em uma porta TCP livre auto-atribuída em 127.0.0.1 e encerrá-lo com `pg_ctl stop -m fast -w` no quit do app. O data dir MUST ficar em `{userData}/pgdata` (persistente entre execuções).

#### Scenario: Start em porta auto-atribuída

- **WHEN** o app inicia em modo embedded
- **THEN** o PostgreSQL responde em `127.0.0.1:{porta_livre}` e o app deriva `DATABASE_URL` dessa porta

#### Scenario: Shutdown ordenado no quit

- **WHEN** o usuário fecha o app com o PostgreSQL em execução
- **THEN** o main executa `pg_ctl stop -m fast` e aguarda o processo terminar antes de encerrar

#### Scenario: Start falho

- **WHEN** `pg_ctl start` falha (ex.: porta indisponível, data dir corrompido)
- **THEN** o app transiciona para o estado `postgres_failed` com diagnóstico no stderr

### Requirement: Banco de dados da aplicação garantido

O main SHALL garantir que o banco `mangaink_agent_db` exista no cluster (criando via `createdb` quando ausente) antes de executar as migrations.

#### Scenario: Banco ausente

- **WHEN** o cluster sobe e o banco `mangaink_agent_db` não existe
- **THEN** o main executa `createdb` e prossegue com as migrations

#### Scenario: Banco já existente

- **WHEN** o banco `mangaink_agent_db` já existe
- **THEN** o main não o recria e prossegue com as migrations
