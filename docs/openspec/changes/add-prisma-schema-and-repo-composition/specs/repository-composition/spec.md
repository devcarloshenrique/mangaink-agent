## ADDED Requirements

### Requirement: Composição configurável de adapters de persistência
The system MUST allow selecting between filesystem-based and Prisma-based repository implementations through a single configuration flag, without modifying use-cases or controllers.

#### Scenario: Flag de configuração REPO_BACKEND
- **WHEN** o backend inicia
- **THEN** `env.ts` (Zod) valida a variável `REPO_BACKEND` aceitando `filesystem` (default) ou `prisma`
- **THEN** qualquer valor inválido dispara erro de inicialização (Zod parse)
- **THEN** o helper `shared/config/repo-mode.ts` exporta `REPO_BACKEND` tipado e `isPrismaBackend(): boolean`

#### Scenario: Composer central de factories
- **WHEN** um módulo (scraping, conversion) precisa instanciar um repositório
- **THEN** o ponto único de composição é `shared/database/repositories/index.ts`
- **THEN** em `REPO_BACKEND=filesystem` as factories retornam instâncias `Filesystem*Repository` existentes
- **THEN** em `REPO_BACKEND=prisma` as factories retornarão instâncias `Prisma*Repository` (criadas nas changes subsequentes); se ainda inexistentes, lançam erro explícito em runtime indicando "adapter Prisma para <X> não implementado"

#### Scenario: Comportamento inalterado por default
- **WHEN** `REPO_BACKEND` não está definido no ambiente
- **THEN** o backend usa `filesystem` como fallback
- **THEN** nenhum use-case, controller ou worker precisa ser alterado
- **THEN** a produção pode continuar operando sem migrar dados até a change `backfill-and-cleanup-legacy-json`

### Requirement: Coexistência de adapters durante a transição
The system MUST keep both `Filesystem*Repository` and `Prisma*Repository` implementations available simultaneously so migrations can occur per-module and be reversible.

#### Scenario: Implementações de Filesystem permanecem
- **WHEN** a change é aplicada
- **THEN** nenhum arquivo de `Filesystem*Repository` é removido
- **THEN** nenhum teste existente de `Filesystem*Repository` é alterado
- **THEN** testes E2E atuais continuam passando com `REPO_BACKEND=filesystem`

#### Scenario: Relação User ↔ Conversion exposta via Prisma
- **WHEN** o modelo `User` é consultado
- **THEN** o campo `conversions` (relationado a `Conversion[]`) está disponível `include` em queries Prisma
- **THEN** o tipo TypeScript do Prisma Client reflete essa relação