## Why

Hoje apenas `User` vive no Postgres; todos metadados de scraping (`metadata.json`) e conversão (`config.json`, `status.json` por Job) persistem em arquivos JSON no filesystem. Não existe listagem de conversões por usuário — a "Biblioteca" está documentada como feature futura — porque qualquer listagem exigiria `readdir` + `readJson` em cada `config.json` (`O(n)` de I/O no disco). As interfaces de repositório já estão abstraídas ("permite trocar o adaptador sem alterar use-cases"), então vamos aproveitar isso para formalizar a camada de persistência estruturada.

Esta change é a fundação de todas as demais: cria o schema Prisma para `Source`, `Chapter`, `Cover`, `Conversion`, `ConversionJob` e introduz um mecanismo de composição de adapters (flag `REPO_BACKEND=filesystem|prisma`) que permitirá migrar módulo a módulo sem trocas big-bang.

## What Changes

- **ADDED** 5 novos modelos no `prisma/schema.prisma`: `Source`, `Chapter`, `Cover`, `Conversion`, `ConversionJob` com chaves estrangeiras e índices.
- **ADDED** Migration Prisma `add_sources_conversions_jobs` (Postgres-only; não requer seed).
- **ADDED** Variável de ambiente `REPO_BACKEND=filesystem|prisma` parseada via Zod em `shared/config/env.ts`, default `filesystem` (durante a transição).
- **ADDED** `shared/config/repo-mode.ts` exportando `REPO_BACKEND` tipado e helper `isPrismaBackend()`.
- **ADDED** Composer root `shared/database/repositories/index.ts` ponto único onde futuros factories selecionam adapter por flag (sem remover os atuais `Filesystem*Repository`).
- **MODIFIED** `model User` ganha `conversions Conversion[]` relation (referência de `Conversion.userId`).
- Sem alterações em use-cases, controllers ou workers nesta change — nenhuma dependência de runtime ainda consome o Composer.
- **BREAKING?** Não. Binários (imagens, EPUBs) continuam no filesystem; as tabelas novas começam vazias.

## Capabilities

### New Capabilities

- `persistence-schema`: capacidades do modelo relacional Postgres (tabelas, índices, FKs) que servirão de suporte às próximas migrações.
- `repository-composition`: infraestrutura de composição de adapters (flag + fábrica) que permite alternar entre `Filesystem*Repository` e `Prisma*Repository` por configuração, sem mudar use-cases.

### Modified Capabilities

<!-- Nenhum — a relation User↔Conversion é detalhe de schema, não altera requisitos de spec do `user`. -->

## Impact

- **Arquivos novos:**
  - `apps/backend/prisma/schema.prisma` (modificado)
  - `apps/backend/prisma/migrations/<timestamp>_add_sources_conversions_jobs/`
  - `apps/backend/src/shared/config/repo-mode.ts`
  - `apps/backend/src/shared/database/repositories/index.ts`
  - `apps/backend/src/shared/config/env.ts` (modificado — adiciona `REPO_BACKEND`)
- **Dependências:** Nenhuma biblioteca nova (Prisma e Postgres já presentes).
- **Risco:** Migration em produção deve rodar com DB acessível; default `REPO_BACKEND=filesystem` garante zero impacto em runtime.
- **Downstream:** Habilita implementação dos adapters Prima nas changes `migrate-source-cache-to-postgres`, `migrate-conversions-and-jobs-to-postgres`, `add-redis-live-job-status` e `add-conversion-library-listing`.