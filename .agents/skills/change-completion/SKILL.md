---
name: change-completion
description: Padroniza o encerramento de uma change OpenSpec — revisão final, validação, arquivamento e organização de commits. Use ao finalizar uma implementação, preparar para PR ou arquivar mudanças concluídas. Gatilhos: "finalizar change", "encerrar implementação", "preparar PR", "arquivar change", "concluir mudança", "completar feature", "definition of done".
---

# Change Completion — Encerramento de Change OpenSpec

Fluxo de qualidade para finalizar uma change: revisão, validação cruzada, arquivamento e commits atômicos.

Esta skill complementa `openspec-implementation` — ela começa onde a implementação termina.

---

## Princípios

Estes fundamentos guiam cada decisão no fluxo de encerramento. Quando houver dúvida, retorne a eles.

| # | Princípio | Significado |
|---|-----------|-------------|
| P1 | **Uma responsabilidade por commit** | Cada commit comunica uma única mudança. O tamanho é consequência da responsabilidade, não um objetivo. |
| P2 | **Revertibilidade** | Qualquer commit pode ser revertido sem quebrar compilação, testes ou dependências entre commits. |
| P3 | **Build verde em cada ponto** | O projeto compila e testa em qualquer commit do histórico. |
| P4 | **Separação por natureza** | Feature, refactor, test, docs e chore vão em commits distintos. |
| P5 | **Ferramentas do projeto** | Toda validação usa os comandos oficiais do projeto (`package.json`, `Makefile`, `Taskfile`, scripts), nunca suposições. |
| P6 | **Problema encontrado = problema corrigido** | Nenhum TODO, debug log ou código morto sobrevive ao encerramento. Não documente para "depois" — corrija agora. |
| P7 | **Histórico narra o raciocínio** | A sequência de commits conta uma história lógica, não cronológica: infraestrutura → refatoração → feature → testes → documentação. |
| P8 | **Archive é ponto de inflexão** | Depois do arquivamento, qualquer alteração futura é uma nova change. Tudo deve estar correto antes. |

---

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
Gate (Pré-condições)
  → Passo 1: Revisão Final da Implementação
  → Passo 2: Validação Cruzada
  → Passo 3: Revisão de Escopo
  → Passo 4: Revisão Arquitetural
  → Passo 5: Análise de Impacto
  → Passo 6: Arquivamento da Change
  → Passo 7: Atomic Boundary Analysis
  → Passo 8: Commits Atômicos
  → Passo 9: Revisão do Histórico
  → Definition of Done
```

---

### Passo 1: Revisão Final da Implementação

Execute uma varredura crítica no código alterado. Os padrões de busca variam conforme a linguagem do projeto — adapte as expressões ao ecossistema (ex: `.ts`, `.py`, `.go`, `.rs`, `.java`).

| Problema | O que buscar |
|----------|-------------|
| TODOs residuais | `grep` por `TODO`, `FIXME`, `HACK`, `XXX` nos arquivos fonte |
| Código comentado | Blocos grandes de código dentro de comentários |
| Logs de debug | Chamadas de log/print que não pertencem à saída de produção |
| Código morto | Funções/classes não referenciadas, imports não utilizados |
| Arquivos temporários | `.bak`, `.tmp`, `.old`, `*_backup.*`, `*.orig` |
| Testes desabilitados | `.skip`, `.only`, `.todo` nos arquivos de teste |
| Consistência OpenSpec | O código implementado corresponde ao que a spec descreve |
| Alterações parciais | Stubs incompletos, branches de feature pela metade |

**Ação**: corrija os problemas encontrados ANTES de prosseguir. Cada correção é um commit separado do corpo principal da change.

> **Regra**: Se encontrar um problema, corrija-o. Não documente para "fazer depois".

---

### Passo 2: Validação Cruzada

**Descubra os comandos de validação do projeto** antes de executar qualquer coisa. Procure por:

- Scripts em `package.json` (campo `scripts`)
- Targets em `Makefile`
- Tasks em `Taskfile.yml` ou `Taskfile.yaml`
- Comandos em `Justfile`
- Scripts shell em `scripts/` ou `bin/`
- Documentação de contribuição (`CONTRIBUTING.md`, `README.md`)
- Configurações de CI (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`)

**Validações comuns — descubra o comando específico do projeto:**

| Validação | Como descobrir |
|-----------|---------------|
| OpenSpec | `openspec validate --all --strict` (padrão) |
| Lint | Procure por `lint`, `eslint`, `ruff`, `clippy`, `golangci-lint`, `checkstyle` nos scripts |
| Checagem de tipos | Procure por `typecheck`, `tsc`, `mypy`, `pyright`, `cargo check` |
| Testes unitários | Procure por `test`, `test:unit`, `vitest`, `jest`, `pytest`, `cargo test` |
| Testes de integração | Procure por `test:e2e`, `test:integration`, `test:full` |
| Build | Procure por `build`, `compile`, `dist` |
| Smoke tests | Procure por `smoke`, `health`, `check` |

Execute todas as validações encontradas. **Nenhuma falha é aceitável nesta etapa.**

**Para cada falha:**
1. Identifique a causa raiz
2. Corrija
3. Re-execute a validação
4. Só prossiga quando tudo passar

> **Regra**: Uma change jamais deve ser arquivada com validações quebradas. Se um lint pré-existente falha em arquivos não relacionados à change, documente explicitamente — mas nunca ignore sem entender.

---

### Passo 3: Revisão de Escopo

Verifique se todas as alterações pertencem à change. Mudanças fora de escopo poluem o histórico e dificultam revisão.

**Checklist de escopo:**

- [ ] Existem alterações que não pertencem à change?
- [ ] Existe código oportunista ("já aproveitei e fiz X também")?
- [ ] Existem refatorações que deveriam ser uma change separada?
- [ ] Existem mudanças de formatação em arquivos não relacionados?

**Ação para cada item fora de escopo encontrado:**
1. Extraia a mudança para um branch ou stash separado
2. Se for valiosa, crie uma nova change para ela
3. Se for cosmética (formatação), reverta

> **Regra**: Cada change entrega exatamente o que sua spec descreve. Nada a mais, nada a menos.

---

### Passo 4: Revisão Arquitetural

Execute uma revisão de alto nível orientada por princípios de design.

**Verificações estruturais:**

- [ ] O design implementado corresponde ao `design.md` da change
- [ ] A solução é a mais simples possível (navalha de Occam)
- [ ] Responsabilidades estão bem separadas (Single Responsibility Principle)
- [ ] Interfaces e contratos estão estáveis

**Verificações de qualidade de código:**

- [ ] Não há duplicação de lógica entre módulos
- [ ] Não há acoplamento desnecessário entre camadas
- [ ] Não há complexidade excessiva (funções longas, aninhamento profundo)
- [ ] Não há violações de SOLID evidentes
- [ ] Código temporário, scaffolding e workarounds foram removidos

**Verificações de simplificação:**

Identifique pequenas oportunidades de melhoria:
- Variáveis com nomes ambíguos
- Funções que podem ser extraídas para reduzir duplicação
- Condicionais que podem ser simplificados
- Comentários que explicam "o quê" em vez de "por quê"

**O que NÃO fazer nesta etapa:**
- Grandes refatorações estruturais (merecem uma change própria)
- Reescrita de módulos
- Mudanças de arquitetura que afetam outras changes
- Alterações de contrato de API pública

---

### Passo 5: Análise de Impacto

Verifique se a implementação alterou superfícies que exigem documentação ou comunicação adicional.

| Superfície | O que verificar |
|-----------|----------------|
| APIs públicas | Rotas, endpoints, schemas de request/response |
| Contratos | Interfaces, tipos exportados, DTOs |
| Banco de dados | Schema, migrations, índices, constraints |
| Configurações | Variáveis de ambiente, arquivos de config (.env, .yaml, .toml) |
| Permissões | Roles, scopes, políticas de acesso |
| CLI | Flags, argumentos, comandos, comportamento de saída |
| Dependências | Novas libs, upgrades de versão, remoção de dependências |
| Breaking changes | Incompatibilidades com versões anteriores |

**Para cada superfície impactada, verifique:**

- [ ] A documentação correspondente foi atualizada
- [ ] Schemas compartilhados refletem as mudanças
- [ ] Changelogs ou release notes mencionam o impacto
- [ ] Migrations são reversíveis (se aplicável)
- [ ] Variáveis de ambiente têm valores padrão documentados

> **Regra**: Código sem documentação atualizada é código incompleto.

---

### Passo 6: Arquivamento da Change

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
- [ ] Os arquivos base permanecem íntegros: `.openspec.yaml`, `README.md`, `proposal.md`, `design.md`, `tasks.md`, `specs/`
- [ ] O repositório está consistente (sem referências quebradas entre arquivos)

> **Nota**: o `openspec archive` pode colocar o arquivo em `changes/archive/`. Se o projeto usar `archive/` na raiz do openspec, mova manualmente após o comando.

---

### Passo 7: Atomic Boundary Analysis

**Antes de criar commits**, identifique e apresente todas as responsabilidades contidas nas alterações.

Execute `git status` e para cada grupo de arquivos, classifique por responsabilidade:

```
Para cada responsabilidade identificada, apresente:

  1. Objetivo: o que essa mudança entrega (1 frase)
  2. Arquivos: lista dos paths envolvidos
  3. Tipo: feat | fix | refactor | test | docs | chore | style
  4. Mensagem sugerida: Conventional Commit completo

Exemplo:

  Responsabilidade A:
    Objetivo: Isolar storage de testes em diretório temporário
    Arquivos:
      - vitest.globalSetup.ts (novo)
      - vitest.config.ts (modificado)
    Tipo: test
    Mensagem: test: add isolated test storage with global setup/teardown

  Responsabilidade B:
    Objetivo: Tornar prisma client lazy para evitar conexão no import
    Arquivos:
      - src/shared/database/prisma.ts
      - src/modules/user/repositories/prisma-user.repository.ts
      - src/modules/scraping/repositories/prisma-source.repository.ts
      - src/modules/conversion/repositories/prisma-conversion.repository.ts
      - src/modules/conversion/repositories/prisma-job.repository.ts
      - src/modules/scraping/tests/unit/prisma-source.repository.test.ts
      - src/modules/conversion/tests/unit/prisma-conversion.repository.test.ts
      - src/modules/conversion/tests/unit/prisma-job.repository.test.ts
    Tipo: refactor
    Mensagem: refactor: make prisma client lazy to avoid import-time connection
```

**Valide a análise com o usuário** antes de criar os commits. Pergunte:
- As responsabilidades estão bem separadas?
- Algum grupo deveria ser dividido ou unido?
- Os tipos e mensagens fazem sentido?

> **Por que isso importa**: Commits misturados são o erro mais comum em históricos Git. A análise prévia elimina retrabalho.

---

### Passo 8: Commits Atômicos

Revise cuidadosamente quais arquivos pertencem a cada commit e adicione-os seletivamente ao índice.

**Formato da mensagem (Conventional Commits):**

```
{tipo}({escopo}): {descrição imperativa}

{corpo opcional com o "porquê" da mudança}
```

**Tipos e seus propósitos:**

| Tipo | Quando usar |
|------|-----------|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `refactor:` | Mudança estrutural sem alterar comportamento |
| `test:` | Apenas arquivos de teste |
| `docs:` | Apenas documentação |
| `chore:` | Build, CI, dependências, configurações |
| `style:` | Formatação, espaçamento (sem mudança de lógica) |

**Exemplos de mensagens bem escritas:**

```
feat(auth): add refresh token rotation
fix(api): handle 404 gracefully on missing chapter
refactor: extract rate-limit config into separate registry
test(conversion): cover error paths in KCC flag mapper
docs: document preview MOBI extraction flow
chore: update test runner to v3
```

**Exemplo de fluxo de staging:**

```
# Responsabilidade A: test infra
git add vitest.globalSetup.ts vitest.config.ts
git commit -m "test: add isolated test storage with global setup/teardown"

# Responsabilidade B: refactor prisma
git add src/shared/database/prisma.ts src/modules/*/repositories/prisma-*.repository.ts src/modules/*/tests/unit/prisma-*.repository.test.ts
git commit -m "refactor: make prisma client lazy to avoid import-time connection"
```

> **Princípio > Proibição**: A qualidade dos commits vem da revisão cuidadosa do índice, não da proibição de comandos. Revise sempre `git status` e `git diff --staged` antes de commitar.

---

### Passo 9: Revisão do Histórico

Após criar os commits, revise o histórico completo:

```bash
git log --oneline -N    # últimos N commits
git status              # working tree deve estar limpo
git diff main..HEAD     # confirme que tudo pertence à change
```

**Checklist de revisão:**

- [ ] Ordem lógica (infraestrutura → refatoração → feature → testes → docs)
- [ ] Todas as mensagens seguem Conventional Commits
- [ ] Cada commit encapsula exatamente uma responsabilidade
- [ ] Cada commit pode ser revertido sem efeitos colaterais
- [ ] Nenhum arquivo esquecido (`git status` limpo, exceto artefatos de line-ending)
- [ ] `git diff main..HEAD` contém apenas alterações da change

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
[ ] Lint aprovado (0 erros nos arquivos alterados)
[ ] Checagem de tipos aprovada (0 erros)
[ ] Testes aprovados (0 falhas, 0 skipped injustificados)
[ ] Build aprovado (produção compila)
[ ] Revisão de escopo concluída (sem código oportunista)
[ ] Revisão arquitetural concluída (sem duplicação, acoplamento, violações)
[ ] Análise de impacto concluída (documentação atualizada onde necessário)
[ ] Change arquivada (saiu de changes/, entrou em archive/)
[ ] Atomic Boundary Analysis apresentada e validada
[ ] Commits atômicos criados (uma responsabilidade por commit)
[ ] Histórico Git revisado (ordem lógica, mensagens claras)
[ ] Working tree limpo (apenas artefatos de line-ending ignoráveis)
```

**Se qualquer item falhar, a change NÃO está concluída.** Volte ao passo correspondente.

---

## Anti-Padrões

**Não faça:**

- Misturar feature, refactor e docs no mesmo commit
- Commitar sem revisar `git diff --staged`
- Ignorar validação quebrada ("o lint já estava assim antes")
- Arquivar uma change com testes falhando
- Deixar TODOs para "resolver depois"
- Fazer grandes refatorações durante o encerramento
- Incluir código oportunista ("já aproveitei e fiz X")
- Assumir comandos de validação sem verificar os scripts do projeto
- Criar commits sem antes apresentar a Atomic Boundary Analysis
- Pular a revisão do histórico ("os commits estão bons, confia")

**Faça:**

- Separar cada responsabilidade em seu próprio commit
- Descobrir os comandos de validação oficiais do projeto
- Abortar o fluxo se as pré-condições falharem
- Corrigir problemas encontrados, não documentá-los
- Revisar cada commit individualmente antes de prosseguir
- Apresentar a análise de responsabilidades antes de commitar
- Verificar se documentação e schemas foram atualizados quando APIs mudam
- Manter a DoD como checklist viva durante todo o processo

---

## Exemplo de Fluxo Completo

```
Usuário: "finalizei a implementação de fix-testes. Pode finalizar?"

Agente:
  1. Gate: change existe, tasks [x], sem bloqueios ✓
  2. Passo 1: varredura de TODOs/logs → limpo ✓
  3. Passo 2: descobre comandos do projeto → package.json scripts →
     openspec validate --all --strict ✓
     pnpm lint ✓
     pnpm test ✓
     tsc --noEmit ✓
  4. Passo 3: revisão de escopo → sem código oportunista ✓
  5. Passo 4: revisão arquitetural → sem duplicação ou acoplamento ✓
  6. Passo 5: análise de impacto → sem breaking changes, docs atualizadas ✓
  7. Passo 6: openspec archive fix-testes --yes → archive/ ✓
  8. Passo 7: Atomic Boundary Analysis → 5 responsabilidades:
     A: test: globalSetup/Teardown
     B: refactor: prisma lazy
     C: test: cross-platform paths
     D: docs: TDD skill
     E: docs: openspec archive
     → usuário aprova divisão ✓
  9. Passo 8: 5 commits atômicos criados ✓
  10. Passo 9: git log --oneline revisado → ordem lógica ✓
  11. DoD: todos os 15 itens marcados ✓

Agente: "Change fix-testes concluída com 5 commits atômicos."
```

---

**Orçamento de tokens**: Aproximadamente 430 linhas, dentro do limite de 500.

**Complementa**: `openspec-implementation` (implementação da change), `test-driven-development` (ciclo TDD por tarefa).
