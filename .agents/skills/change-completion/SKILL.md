---
name: change-completion
description: Padroniza o encerramento de uma change OpenSpec — revisão final, validação, arquivamento e organização de commits. Use ao finalizar uma implementação, preparar para PR ou arquivar mudanças concluídas. Gatilhos: "finalizar change", "encerrar implementação", "preparar PR", "arquivar change", "concluir mudança", "completar feature", "definition of done".
---

# Change Completion — Encerramento de Change OpenSpec

Fluxo de qualidade para finalizar uma change: revisão, validação cruzada, arquivamento e commits atômicos.

Esta skill complementa `openspec-implementation` — ela começa onde a implementação termina.

## Objetivo

Garantir que nenhuma change seja considerada concluída sem passar por todas as etapas de validação de qualidade, arquivamento e organização do histórico Git.

**Quando usar:**
- Implementação da change concluída (todas as tasks marcadas)
- Preparação para entregar uma feature
- Antes de abrir um Pull Request
- Ao arquivar uma change OpenSpec

**Quando NÃO usar:**
- Durante a implementação ativa (use `openspec-implementation`)
- Para hotfixes sem change associada
- Para mudanças puramente documentais (aplica-se apenas arquivamento)

---

## Pré-condições (Gate)

Antes de iniciar QUALQUER etapa deste fluxo, verifique:

```
[ ] Existe uma change OpenSpec ativa em docs/openspec/changes/{change-id}/
[ ] O arquivo tasks.md existe e todas as tasks estão marcadas [x]
[ ] A implementação está funcionalmente completa
[ ] Não há bloqueios ou pendências conhecidas
```

Se QUALQUER pré-condição falhar, **interrompa o fluxo** e informe o usuário. Uma change incompleta jamais deve ser arquivada.

---

## Fluxo de Trabalho

```
Revisão Final → Validação → Revisão Arquitetural → Arquivamento → Organização Git → Commits → Revisão do Histórico → DoD
```

### Passo 1: Revisão Final da Implementação

Execute uma varredura crítica no código alterado procurando:

| Problema | O que buscar |
|----------|-------------|
| TODOs residuais | `grep -r "TODO\|FIXME\|HACK" --include="*.ts" --include="*.tsx"` |
| Código comentado | Blocos grandes de código em comentário |
| Logs de debug | `console.log`, `console.debug`, `console.dir` (exceto em scripts CLI) |
| Código morto | Funções/classes não referenciadas, imports não usados |
| Arquivos temporários | `.bak`, `.tmp`, `.old`, `*_backup.*` |
| Testes desabilitados | `.skip`, `.only`, `.todo` nos arquivos de teste |
| Consistência OpenSpec | O código implementado corresponde ao que a spec descreve |
| Alterações parciais | Metade de uma feature implementada, stubs não preenchidos |

**Ação**: corrija os problemas encontrados ANTES de prosseguir. Cada correção deve ser um commit separado do resto do trabalho.

> **Regra**: Se encontrar um problema, corrija-o. Não documente para "fazer depois".

### Passo 2: Validação Cruzada

Execute todas as validações disponíveis no projeto. **Nenhuma falha é aceitável nesta etapa.**

| Validação | Comando típico |
|-----------|---------------|
| OpenSpec | `openspec validate --all --strict` |
| Lint | `pnpm lint` ou `npm run lint` |
| TypeScript | `tsc --noEmit` ou `npm run typecheck` |
| Testes unitários | `pnpm test` ou `npm test` |
| Build | `pnpm build` ou `npm run build` |
| Smoke tests | `pnpm test:e2e` (se existir) |

**Para cada falha:**
1. Identifique a causa raiz
2. Corrija
3. Re-execute a validação
4. Só prossiga quando tudo passar

> **Regra**: Uma change jamais deve ser arquivada com testes quebrados, lint falhando ou build quebrado. Se o lint falha em arquivos pré-existentes, documente mas NÃO ignore — resolva ou exclua do escopo.

### Passo 3: Revisão Arquitetural

Execute uma revisão final de alto nível:

**Verificações obrigatórias:**

- [ ] O design implementado corresponde ao `design.md` da change
- [ ] A solução é a mais simples possível (navalha de Occam)
- [ ] Não há duplicação de lógica entre módulos
- [ ] Responsabilidades estão bem separadas (single responsibility)
- [ ] Código temporário ou scaffolding foram removidos
- [ ] Interfaces e contratos estão estáveis

**O que NÃO fazer nesta etapa:**
- Grandes refatorações estruturais (merecem uma change própria)
- Reescrita de módulos
- Mudanças de arquitetura que afetam outras changes

Pequenas melhorias (renomear uma variável ambígua, extrair uma função duplicada) são bem-vindas.

### Passo 4: Arquivamento da Change

Execute o arquivamento via CLI do OpenSpec:

```bash
cd docs/openspec && npx openspec archive {change-id} --yes
```

**Flags importantes:**
- `--yes`: pula confirmação interativa (tasks incompletas ainda geram warning)
- `--skip-specs`: pula mesclagem de specs (use para changes de infraestrutura que não alteram specs de funcionalidade)
- `--dry-run`: preview sem alterar arquivos (útil para revisão prévia)

**Pós-arquivamento, verifique:**

- [ ] A change foi removida de `docs/openspec/changes/`
- [ ] A change foi movida para `docs/openspec/archive/{change-id}/`
- [ ] Os 6 arquivos base permanecem íntegros: `.openspec.yaml`, `README.md`, `proposal.md`, `design.md`, `tasks.md`, `specs/`
- [ ] O repositório está consistente (sem referências quebradas)

> **Nota sobre localização**: o `openspec archive` pode colocar o arquivo em `changes/archive/` ao invés de `archive/`. Se o projeto usar `archive/` na raiz do openspec, mova manualmente após o comando.

### Passo 5: Organização do Git

Com o `git status`, analise todas as alterações e agrupe-as por responsabilidade.

**Princípios para agrupamento:**

| Princípio | Significado |
|-----------|-------------|
| Um commit = uma responsabilidade | Cada commit resolve um problema distinto |
| Commits pequenos | Alvo: 10-50 linhas por commit. Nunca >200 linhas |
| Commits revertíveis | Cada commit pode ser revertido sem quebrar compilação |
| Commits compiláveis | O projeto compila e testa em cada commit |
| Separar por natureza | Feature, refactor, test, docs, chore — commits separados |

**Exemplos de boas divisões:**

```
Boa divisão:
  e3b3806 test: add isolated test storage with global setup/teardown
  35f764d refactor: make prisma client lazy to avoid import-time DB connection
  fcc9c16 test: fix cross-platform path handling in test mocks
  0ff01fe docs: add cross-platform and test isolation guidance to TDD skill

Má divisão:
  abc1234 fix: a bunch of stuff (test, refactor, docs misturados)
```

**Padrões de agrupamento comuns:**

- `feat:` / `fix:` — código de produção
- `refactor:` — mudanças estruturais sem alteração de comportamento
- `test:` — apenas arquivos de teste
- `docs:` — apenas documentação
- `chore:` — build, CI, configs, dependências
- `style:` — formatação, lint (sem lógica)

### Passo 6: Commits Atômicos

Execute `git add` específico e `git commit` com mensagens no padrão **Conventional Commits**.

**Formato da mensagem:**

```
{tipo}({escopo}): {descrição imperativa}

{corpo opcional explicando o "porquê"}
```

**Exemplos:**

```bash
# Feature
feat(auth): add refresh token rotation

# Bug fix
fix(scraping): handle 404 without throwing on chapter fetch

# Refatoração
refactor: extract rate-limit config into separate registry

# Testes
test(conversion): add unit tests for KCC flag mapper

# Documentação
docs: document preview MOBI architecture in design.md

# Infra/chore
chore: update vitest to v3
```

**Como usar `git add`:**

```bash
# SEMPRE use paths específicos — NUNCA git add -A
git add apps/backend/vitest.globalSetup.ts apps/backend/vitest.config.ts
git commit -m "test: add isolated test storage with global setup/teardown"

git add apps/backend/src/shared/database/prisma.ts apps/backend/src/modules/*/repositories/prisma-*.repository.ts
git commit -m "refactor: make prisma client lazy to avoid import-time connection"
```

### Passo 7: Revisão do Histórico

Após criar os commits, revise o histórico:

```bash
git log --oneline -N   # últimos N commits
git status             # working tree deve estar limpo
```

**Checklist de revisão do histórico:**

- [ ] Ordem dos commits é lógica (dependências vêm antes)
- [ ] Mensagens seguem Conventional Commits
- [ ] Granularidade adequada (nem muito grandes, nem triviais)
- [ ] Cada commit pode ser revertido independentemente
- [ ] Não há arquivos esquecidos (`git status` limpo, exceto artefatos CRLF)
- [ ] `git diff main..HEAD` mostra apenas o esperado

**Se precisar reorganizar:**

```bash
git rebase -i HEAD~N   # reordene, squash, edite mensagens
```

> **Atenção**: só faça rebase se os commits ainda não foram pushados.

---

## Definition of Done

A change só pode ser considerada **concluída** quando todos os itens estiverem marcados:

```
[ ] Todas as tasks concluídas (tasks.md com todos [x])
[ ] Revisão de código finalizada (sem TODOs, debug, código morto)
[ ] OpenSpec validado (validate --all --strict)
[ ] Lint aprovado (0 erros, 0 warnings relevantes)
[ ] TypeScript compilando (0 erros nos arquivos alterados)
[ ] Testes aprovados (0 falhas, 0 skipped injustificados)
[ ] Build aprovado (produção compila)
[ ] Change arquivada (saiu de changes/, entrou em archive/)
[ ] Commits atômicos (um propósito por commit)
[ ] Histórico Git revisado (ordem lógica, mensagens claras)
[ ] Working tree limpo (apenas artefatos de CRLF ignoráveis)
```

**Se qualquer item falhar, a change NÃO está concluída.** Volte ao passo correspondente.

---

## Boas Práticas

### Padrão 1: Falhou Validação? Pare.

Se uma validação falhar no Passo 2, corrija ANTES de prosseguir. Arquivar com validação quebrada é pior que não arquivar.

### Padrão 2: Commits Pequenos Salvarão sua Vida

Um commit de 500 linhas é impossível de revisar. Um commit de 30 linhas é trivial. Na dúvida, divida mais.

### Padrão 3: O Histórico Conta uma História

Os commits devem narrar o desenvolvimento: infraestrutura → refatorações → funcionalidade → testes → documentação. Não é uma ordem cronológica — é uma ordem lógica.

### Padrão 4: Corrigir Depois do Archive é Mais Custoso

Arquivar é o ponto de inflexão. Depois que a change vai para o archive, qualquer correção futura é uma nova change. Garanta que está tudo certo antes.

### Padrão 5: Working Tree Limpo é Sinal de Profissionalismo

Se o `git status` mostra arquivos modificados não commitados, o trabalho não está completo. A única exceção são artefatos de CRLF (Windows) que não representam mudanças reais.

---

## Anti-Padrões

**Não faça:**
- Misturar feature, refactor e docs no mesmo commit
- Commitar `git add -A` ou `git commit -a`
- Ignorar validação quebrada ("o lint já estava assim")
- Arquivar uma change sem testes passando
- Deixar TODOs para "resolver depois"
- Fazer grandes refatorações durante o encerramento
- Pular a revisão do histórico ("os commits estão bons, confia")

**Faça:**
- Commits atômicos com `git add` específico
- Abortar o fluxo se pré-condições falharem
- Corrigir problemas encontrados, não documentá-los
- Revisar cada commit antes de dar o trabalho como concluído
- Manter a DoD como checklist viva durante todo o processo

---

## Exemplo de Fluxo Completo

```
Usuário: "finalizei a implementação de fix-testes. Pode finalizar?"

Agente:
  1. Verifica pré-condições: change existe, tasks marcados [x] ✓
  2. Passo 1: varredura de TODOs/logs/código morto → limpo ✓
  3. Passo 2: openspec validate, lint, tsc, test, build → tudo passando ✓
  4. Passo 3: revisão do design.md vs implementação → aderente ✓
  5. Passo 4: openspec archive fix-testes --yes → movido para archive/ ✓
  6. Passo 5: git status → 15 arquivos alterados → agrupados em 5 responsabilidades
  7. Passo 6: 5 commits atômicos criados
  8. Passo 7: git log --oneline revisado → ordem lógica, mensagens claras ✓
  9. DoD: todos os 11 itens marcados ✓

Agente: "Change fix-testes concluída. Histórico: [...]"
```

---

**Orçamento de tokens**: Aproximadamente 350 linhas, dentro do limite recomendado de 500.

**Complementa**: `openspec-implementation` (implementação), `test-driven-development` (ciclo TDD).
