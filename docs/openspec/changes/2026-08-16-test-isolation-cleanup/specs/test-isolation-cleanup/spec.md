# Capability: test-isolation-cleanup

> **Status:** DRAFT
> **Data:** 2026-08-16
> **Módulo:** backend (infra de testes)

---

## Requisitos

### R1: Limpeza automática de banco por teste

A suíte de testes E2E deve iniciar cada cenário com o banco de dados em estado completamente vazio e previsível, via hook global de ciclo de vida — sem chamadas manuais nos arquivos de teste.

#### Cenários

**Cenário 1: Estado vazio a cada teste**
- **Given** um banco de teste com registros de domínio persistidos por um teste anterior
- **When** o próximo teste da suíte E2E inicia
- **Then** todas as tabelas de domínio estão vazias e as sequências resetadas

**Cenário 2: Sem chamadas manuais**
- **Given** um arquivo de teste E2E novo sem nenhuma rotina de cleanup no corpo do teste
- **When** o teste executa
- **Then** a limpeza roda automaticamente via hook global (`beforeEach`)

**Cenário 3: Preservação da estrutura**
- **Given** o banco de teste com histórico de migrações (`_prisma_migrations`)
- **When** a limpeza roda
- **Then** a tabela `_prisma_migrations` permanece intacta

**Cenário 4: Resolução de relacionamentos**
- **Given** registros com chaves estrangeiras entre entidades de domínio
- **When** a limpeza roda
- **Then** todos os registros são removidos sem erro de dependência (CASCADE)

**Cenário 5: Guard de isolamento**
- **Given** uma variável de ambiente apontando para um banco que não é de teste (ex: `mangaink_agent_db`)
- **When** a limpeza tenta executar
- **Then** a operação aborta com erro explícito e nenhuma tabela é truncada

### R2: Execução serial da suíte E2E

A suíte E2E com banco compartilhado deve executar arquivos de teste em série, garantindo que a limpeza de um teste nunca interfira na execução de outro.

#### Cenários

**Cenário 6: Serialização de arquivos**
- **Given** dois arquivos de teste E2E
- **When** a suíte executa
- **Then** um arquivo termina antes do outro iniciar (`fileParallelism: false`)

### R3: Preparação automatizada do ambiente

O comando `test:e2e` deve preparar o ambiente (containers, banco e migrations) automaticamente, sem passos manuais.

#### Cenários

**Cenário 7: Um comando só**
- **Given** Docker instalado com containers parados e banco de teste inexistente
- **When** `pnpm test:e2e` executa
- **Then** containers sobem, banco de teste é criado, migrations aplicadas e testes rodam

**Cenário 8: Idempotência**
- **Given** containers rodando e banco migrado
- **When** `pnpm test:e2e` executa novamente
- **Then** nenhuma etapa é refeita desnecessariamente e os testes rodam

### R4: Suíte unitária hermética

Os testes unitários não devem depender de infraestrutura (Docker/Postgres/Redis).

#### Cenários

**Cenário 9: Unit sem infra**
- **Given** um ambiente sem Docker ativo
- **When** `pnpm test:unit` executa
- **Then** a suíte unitária passa sem exigir containers

### R5: Preservação do globalSetup existente

Ambos os configs (unit e e2e) devem herdar o `vitest.globalSetup.ts` existente, que cria diretórios temporários de storage necessários para testes de filesystem.

#### Cenários

**Cenário 10: Diretórios de storage criados**
- **Given** um config Vitest (unit ou e2e)
- **When** a suíte inicia
- **Then** `STORAGE_PATH` e `CONVERSIONS_STORAGE_PATH` apontam para diretórios temporários válidos criados pelo globalSetup

**Cenário 11: Cleanup de storage no teardown**
- **Given** uma suíte que terminou de rodar
- **When** o teardown do globalSetup executa
- **Then** os diretórios temporários são removidos

### R6: Criação segura do banco de teste

O script de preparação deve criar o banco de teste conectando no DB default do compose (`mangaink_agent_db`), não no DB `postgres`, garantindo compatibilidade com a imagem bitnami/postgresql.

#### Cenários

**Cenário 12: CREATE DATABASE via DB default**
- **Given** containers rodando com imagem bitnami/postgresql e user `mangaink`
- **When** o prepare-test-db.mjs tenta criar `mangaink_agent_test_db`
- **Then** conecta no `mangaink_agent_db` (DB default) para executar o CREATE DATABASE
