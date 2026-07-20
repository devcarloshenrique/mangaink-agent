---
name: change-completion
description: Padroniza o encerramento de uma change OpenSpec — revisão final, validação, arquivamento e organização de commits. Use ao finalizar uma implementação, preparar para PR ou arquivar mudanças concluídas. Gatilhos: "finalizar change", "encerrar implementação", "preparar PR", "arquivar change", "concluir mudança", "completar feature", "definition of done".
---

# Change Completion — Encerramento de Change OpenSpec

Fluxo de qualidade para finalizar uma change: revisão, validação cruzada, arquivamento e commits atômicos.

Esta skill complementa `openspec-implementation` — ela começa onde a implementação termina.

---

## Princípios

Estes fundamentos guiam cada decisão. Quando houver dúvida, retorne a eles.

| # | Princípio | Significado |
|---|-----------|-------------|
| P1 | **Correctness** | A implementação funciona corretamente em todos os cenários. Nenhum TODO, debug log, código morto ou workaround sobrevive ao encerramento. |
| P2 | **Specification Fidelity** | O código implementado corresponde exatamente ao que a spec descreve. Divergências são bugs ou dívida documental. |
| P3 | **Single Responsibility** | Cada commit comunica uma única mudança. Feature, refactor, test e docs vão em commits distintos. O tamanho é consequência da responsabilidade, não um objetivo. |
| P4 | **Revertibility** | Qualquer commit pode ser revertido sem quebrar compilação, testes ou dependências entre commits. |
| P5 | **Build Green** | O projeto compila e testa em qualquer ponto do histórico. |
| P6 | **Project Conventions** | Toda validação usa os comandos oficiais do projeto, nunca suposições sobre ferramentas. |
| P7 | **Narrative History** | A sequência de commits conta uma história lógica: infraestrutura → refatoração → feature → testes → documentação. |
| P8 | **Archive Finality** | Depois do arquivamento, qualquer alteração futura é uma nova change. Tudo deve estar correto antes. |

---

## Failure Policy

**Quando qualquer etapa falhar, o comportamento é imutável:**

1. Interrompa o fluxo imediatamente
2. Explique claramente o que falhou e por quê
3. Corrija o problema
4. Re-execute a etapa
5. Só prossiga quando passar

Nunca ignore falhas. Nunca "siga em frente". Nunca documente para corrigir depois. Uma change com validações quebradas é pior que uma change não finalizada.

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

```
[ ] Existe uma change OpenSpec ativa em docs/openspec/changes/{change-id}/
[ ] O arquivo tasks.md existe e todas as tasks estão marcadas [x]
[ ] A implementação está funcionalmente completa
[ ] Não há bloqueios ou pendências conhecidas
```

Se QUALQUER pré-condição falhar, **interrompa o fluxo**. Uma change incompleta jamais deve ser arquivada.

---

## Fluxo de Trabalho

```
Gate
  → 1. Descoberta do Projeto
  → 2. Revisão Final da Implementação
  → 3. Validação Cruzada
  → 4. Revisão de Escopo
  → 5. Revisão Arquitetural
  → 6. Risk Scan
  → 7. Análise de Impacto
  → 8. Specification Review
  → 9. Evidence Review
  → 10. Arquivamento
  → 11. Atomic Boundary Analysis
  → 12. Commits Atômicos
  → 13. Revisão do Histórico
  → 14. Release Readiness
  → Definition of Done
```

---

### 1. Descoberta do Projeto

Antes de qualquer validação, identifique o ferramental do projeto. Inspecione a raiz do repositório por:

| Categoria | O que procurar |
|-----------|---------------|
| Package manager | `package.json` (npm/pnpm/yarn/bun), `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle` |
| Workspace/monorepo | `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `rush.json`, `moon.yml`, `lerna.json` |
| Task runner | `Makefile`, `Taskfile.yml`, `Justfile`, scripts em `package.json` |
| Build system | `tsconfig.json`, `vite.config.*`, `webpack.config.*`, `esbuild.config.*`, `CMakeLists.txt` |
| CI config | `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `circleci/config.yml` |
| Contributing docs | `CONTRIBUTING.md`, `README.md`, `DEVELOPMENT.md`, `HACKING.md` |

**Resultado esperado**: uma lista clara dos comandos de validação oficiais (lint, test, typecheck, build). Use esses comandos em todo o fluxo — nunca suponha `npm test` se o projeto usa `cargo test`.

---

### 2. Revisão Final da Implementação

Varredura crítica no código alterado. Adapte os padrões de busca à linguagem do projeto.

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

**Ação**: corrija os problemas encontrados ANTES de prosseguir. Cada correção é um commit separado.

> **Regra**: Problema encontrado = problema corrigido agora. Não documente para "depois".

---

### 3. Validação Cruzada

Execute todas as validações oficiais do projeto (descobertas no Passo 1). **Nenhuma falha é aceitável.**

| Validação | Como descobrir o comando |
|-----------|-------------------------|
| OpenSpec | `openspec validate --all --strict` |
| Lint | Procure por `lint`, `eslint`, `ruff`, `clippy`, `golangci-lint` nos scripts |
| Checagem de tipos | Procure por `typecheck`, `tsc`, `mypy`, `pyright`, `cargo check` |
| Testes unitários | Procure por `test`, `test:unit`, `vitest`, `jest`, `pytest`, `cargo test` |
| Testes de integração | Procure por `test:e2e`, `test:integration`, `test:full` |
| Build | Procure por `build`, `compile`, `dist` |
| Smoke tests | Procure por `smoke`, `health`, `check` |

Executar. Falhou? → Corrija → Re-execute → Prossiga só quando tudo passar.

> Se um lint pré-existente falha em arquivos não relacionados à change, documente — mas nunca ignore sem entender.

---

### 4. Revisão de Escopo

Verifique se todas as alterações pertencem à change.

- [ ] Existem alterações que não pertencem à change?
- [ ] Existe código oportunista ("já aproveitei e fiz X também")?
- [ ] Existem refatorações que deveriam ser uma change separada?
- [ ] Existem mudanças de formatação em arquivos não relacionados?

**Ação**: extraia mudanças fora de escopo para stash/branch separado. Se forem valiosas, crie uma nova change. Se forem cosméticas, reverta.

> **Regra**: Cada change entrega exatamente o que sua spec descreve. Nada a mais, nada a menos.

---

### 5. Revisão Arquitetural

Revisão de alto nível orientada por princípios de design.

**Verificações estruturais:**

- [ ] O design implementado corresponde ao `design.md`
- [ ] A solução é a mais simples possível (navalha de Occam)
- [ ] Responsabilidades estão bem separadas (SRP)
- [ ] Interfaces e contratos estão estáveis

**Verificações de qualidade:**

- [ ] Não há duplicação de lógica entre módulos
- [ ] Não há acoplamento desnecessário entre camadas
- [ ] Não há complexidade excessiva (funções longas, aninhamento profundo)
- [ ] Não há violações de SOLID evidentes
- [ ] Código temporário, scaffolding e workarounds foram removidos

**Simplificações bem-vindas:** renomear variáveis ambíguas, extrair funções duplicadas, simplificar condicionais.

**Não faça:** grandes refatorações, reescrita de módulos, mudanças de contrato público.

---

### 6. Risk Scan

Procure ativamente por riscos remanescentes no código. Estes itens são armadilhas comuns que sobrevivem a revisões superficiais.

| Risco | Exemplos |
|-------|---------|
| Feature flags esquecidas | `if (FEATURE_X)` que nunca será removido |
| Código experimental | Blocos `try { ... } catch { /* experimental */ }` |
| Fallbacks temporários | `return data || mockData` |
| Timeouts hardcoded | `setTimeout(fn, 5000)` sem constante nomeada |
| Caminhos absolutos | `/home/user/project/src/file.ts` |
| Credenciais | API keys, tokens, senhas em código fonte |
| Comportamento env-dependent | `if (process.env.NODE_ENV === 'dev')` como lógica de negócio |
| Retries infinitos | `while(true) { try { ... } catch { continue } }` |
| Workarounds temporários | `// FIXME: remove after migration` de 6 meses atrás |

**Ação**: cada risco encontrado deve ser eliminado ou, se for intencional e bem justificado, documentado explicitamente no `design.md` da change.

---

### 7. Análise de Impacto

Verifique superfícies alteradas e seus efeitos em consumidores.

**Superfícies internas:**

| Superfície | O que verificar |
|-----------|----------------|
| APIs públicas | Rotas, endpoints, schemas de request/response |
| Contratos | Interfaces, tipos exportados, DTOs |
| Banco de dados | Schema, migrations, índices, constraints |
| Configurações | Variáveis de ambiente, arquivos de config |
| Permissões | Roles, scopes, políticas de acesso |
| Dependências | Novas libs, upgrades, remoções |

**Superfícies externas — responda explicitamente:**

- [ ] Existe breaking change?
- [ ] APIs públicas ou contratos mudaram?
- [ ] Eventos, webhooks ou mensageria mudaram?
- [ ] CLI, flags ou argumentos mudaram?
- [ ] SDKs ou clientes externos serão afetados?
- [ ] Consumidores externos precisam de adaptação?

**Para cada superfície impactada:** verifique se a documentação, schemas compartilhados, changelogs e release notes foram atualizados.

> **Regra**: Código sem documentação atualizada é código incompleto.

---

### 8. Specification Review

**Antes do arquivamento**, verifique a consistência entre implementação e documentação OpenSpec.

| Documento | Verificação |
|-----------|------------|
| `proposal.md` | O problema descrito foi resolvido? O escopo está correto? |
| `design.md` | As decisões de design refletem o código atual? Nenhuma decisão ficou desatualizada? |
| `specs/*.md` | Os cenários descrevem o comportamento real? Nenhum requisito foi omitido? |
| `tasks.md` | Todas as tasks concluídas? Nenhuma task foi pulada? As descrições correspondem ao trabalho real? |

**Ação**: se houver divergência entre implementação e documentação, atualize a documentação antes de arquivar. O arquivo final deve permitir que qualquer pessoa entenda a change apenas lendo a pasta.

---

### 9. Evidence Review

Revise artefatos auxiliares que demonstram o comportamento da funcionalidade.

Quando existirem, verifique se continuam válidos:

- [ ] `README` — instruções de uso ainda funcionam?
- [ ] Exemplos de código — compilam e executam?
- [ ] Exemplos de API request/response — schemas ainda batem?
- [ ] Exemplos JSON — estrutura corresponde ao schema atual?
- [ ] Diagramas — refletem a arquitetura implementada?
- [ ] Screenshots — UI corresponde ao estado atual?
- [ ] Fixtures de teste — dados de exemplo são representativos?
- [ ] Documentação de integração — endpoints e contratos estão corretos?

> Artefatos desatualizados são piores que artefatos ausentes — eles enganam o leitor.

---

### 10. Arquivamento

Execute o arquivamento via CLI do OpenSpec:

```bash
cd docs/openspec && npx openspec archive {change-id} --yes
```

**Flags relevantes:**
- `--yes`: pula confirmação interativa
- `--skip-specs`: pula mesclagem de specs (changes de infraestrutura)
- `--dry-run`: preview sem alterar arquivos

**Pós-arquivamento:**

- [ ] A change foi removida de `docs/openspec/changes/`
- [ ] A change está em `docs/openspec/archive/{change-id}/`
- [ ] Arquivos base íntegros: `.openspec.yaml`, `README.md`, `proposal.md`, `design.md`, `tasks.md`, `specs/`
- [ ] Repositório consistente (sem referências quebradas)

> O comando pode colocar em `changes/archive/`. Se o projeto usar `archive/` na raiz, mova manualmente.

---

### 11. Atomic Boundary Analysis

Identifique e apresente todas as responsabilidades contidas nas alterações ANTES de criar commits.

```
Para cada responsabilidade:

  1. Objetivo: o que essa mudança entrega (1 frase)
  2. Arquivos: paths envolvidos
  3. Tipo: feat | fix | refactor | test | docs | chore | style
  4. Mensagem: Conventional Commit completo

Exemplo:

  A. Objetivo: Isolar storage de testes em diretório temporário
     Arquivos: vitest.globalSetup.ts (novo), vitest.config.ts (modificado)
     Tipo: test
     Mensagem: test: add isolated test storage with global setup/teardown

  B. Objetivo: Tornar prisma client lazy para evitar conexão no import
     Arquivos: src/shared/database/prisma.ts, src/modules/*/repositories/prisma-*.ts
     Tipo: refactor
     Mensagem: refactor: make prisma client lazy to avoid import-time connection
```

**Regra de interrupção**: só solicite confirmação do usuário se houver ambiguidade real na separação. Se as responsabilidades estão claras e bem delimitadas, prossiga automaticamente para os commits.

> **Por que isso importa**: Commits misturados são o erro mais comum. A análise prévia elimina retrabalho.

---

### 12. Commits Atômicos

Revise cuidadosamente cada arquivo antes de adicioná-lo ao índice. Use staging seletivo.

**Formato Conventional Commits:**

```
{tipo}({escopo}): {descrição imperativa}

{corpo opcional com o "porquê"}
```

**Tipos e propósitos:**

| Tipo | Quando usar |
|------|-----------|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `refactor:` | Mudança estrutural sem alterar comportamento |
| `test:` | Apenas arquivos de teste |
| `docs:` | Apenas documentação |
| `chore:` | Build, CI, dependências, configurações |
| `style:` | Formatação (sem mudança de lógica) |

**Exemplos:**

```
feat(auth): add refresh token rotation
fix(api): handle 404 gracefully on missing chapter
refactor: extract rate-limit config into separate registry
test(conversion): cover error paths in KCC flag mapper
docs: document preview MOBI extraction flow
chore: update test runner to v3
```

> A qualidade dos commits vem da revisão cuidadosa do índice. Revise sempre `git status` e `git diff --staged` antes de commitar.

---

### 13. Revisão do Histórico

Após criar os commits, revise o histórico completo.

- [ ] Ordem lógica (infraestrutura → refatoração → feature → testes → docs)
- [ ] Todas as mensagens seguem Conventional Commits
- [ ] Cada commit encapsula exatamente uma responsabilidade
- [ ] Cada commit pode ser revertido sem efeitos colaterais
- [ ] Nenhum arquivo esquecido (`git status` limpo)
- [ ] `git diff main..HEAD` contém apenas alterações da change

Se precisar reorganizar: `git rebase -i HEAD~N`. Só faça se os commits ainda não foram pushados.

---

### 14. Release Readiness

Verifique se a change está realmente pronta para entrega — não apenas "implementada", mas pronta para produção.

**Checklist de produção:**

- [ ] Existe migração de dados necessária? Ela é reversível?
- [ ] Existe rollback documentado e testado?
- [ ] Existe breaking change comunicado?
- [ ] Existe documentação suficiente para o próximo desenvolvedor?
- [ ] Existe configuração adicional necessária (env vars, secrets, permissões)?
- [ ] Existe feature flag que precisa ser ativada/removida?
- [ ] Existe monitoramento ou alerta necessário?
- [ ] Outros times ou serviços precisam ser comunicados?
- [ ] O deploy pode ser feito de forma independente?

> **Regra**: Se qualquer item de produção não puder ser respondido, a change não está pronta para entrega. Documente o que falta.

---

## Definition of Done

A change só está **concluída** quando todos os itens estiverem marcados:

```
[ ] Todas as tasks concluídas (tasks.md com todos [x])
[ ] Projeto descoberto (comandos de validação identificados)
[ ] Revisão de código finalizada (sem TODOs, debug, código morto)
[ ] OpenSpec validado (validate --all --strict)
[ ] Lint aprovado (0 erros nos arquivos alterados)
[ ] Checagem de tipos aprovada (0 erros)
[ ] Testes aprovados (0 falhas, 0 skipped injustificados)
[ ] Build aprovado (produção compila)
[ ] Revisão de escopo concluída (sem código oportunista)
[ ] Revisão arquitetural concluída (sem duplicação, acoplamento, violações)
[ ] Risk scan concluído (sem riscos remanescentes)
[ ] Análise de impacto concluída (consumidores considerados, docs atualizadas)
[ ] Specification review concluída (docs OpenSpec consistentes)
[ ] Evidence review concluída (artefatos atualizados)
[ ] Change arquivada (saiu de changes/, entrou em archive/)
[ ] Atomic Boundary Analysis apresentada
[ ] Commits atômicos criados (uma responsabilidade por commit)
[ ] Histórico Git revisado (ordem lógica, mensagens claras)
[ ] Release readiness confirmada (pronto para produção)
[ ] Working tree limpo (apenas artefatos de line-ending ignoráveis)
```

**Se qualquer item falhar, a change NÃO está concluída.** Volte ao passo correspondente via Failure Policy.

---

## Anti-Padrões

**Não faça:**

- Misturar feature, refactor e docs no mesmo commit
- Commitar sem revisar `git diff --staged`
- Ignorar validação quebrada ("o lint já estava assim antes")
- Arquivar uma change com testes falhando
- Deixar TODOs, fallbacks ou workarounds para "resolver depois"
- Fazer grandes refatorações durante o encerramento
- Incluir código oportunista ("já aproveitei e fiz X")
- Assumir comandos de validação sem verificar os scripts do projeto
- Pular a Atomic Boundary Analysis
- Arquivar com documentação desatualizada
- Avançar após falha sem corrigir

**Faça:**

- Separar cada responsabilidade em seu próprio commit
- Descobrir os comandos oficiais do projeto no Passo 1
- Abortar o fluxo se as pré-condições falharem
- Corrigir problemas, não documentá-los
- Revisar cada commit antes de prosseguir
- Apresentar a Atomic Boundary Analysis; pedir confirmação só se houver ambiguidade
- Atualizar documentação quando APIs ou contratos mudarem
- Verificar riscos, evidências e readiness antes de declarar concluído
- Seguir a Failure Policy em cada falha

---

## Exemplo de Fluxo Completo

```
Usuário: "finalizei a implementação de fix-testes. Pode finalizar?"

Agente:
  1. Gate: change existe, tasks [x], sem bloqueios ✓
  2. Passo 1: descoberta → package.json + pnpm-workspace.yaml → monorepo pnpm ✓
  3. Passo 2: varredura de TODOs/logs → limpo ✓
  4. Passo 3: validação → pnpm lint/test + openspec validate → tudo passando ✓
  5. Passo 4: escopo → sem código oportunista ✓
  6. Passo 5: arquitetural → sem duplicação, acoplamento ou violações ✓
  7. Passo 6: risk scan → sem credenciais, timeouts, fallbacks ✓
  8. Passo 7: impacto → sem breaking changes; docs de env vars atualizadas ✓
  9. Passo 8: specification review → design.md, tasks.md consistentes ✓
  10. Passo 9: evidence review → fixtures e exemplos válidos ✓
  11. Passo 10: openspec archive fix-testes --yes → archive/ ✓
  12. Passo 11: Atomic Boundary Analysis → 5 responsabilidades claras →
      prossegue automaticamente ✓
  13. Passo 12: 5 commits atômicos criados ✓
  14. Passo 13: git log revisado → ordem lógica, mensagens claras ✓
  15. Passo 14: release readiness → sem migração, sem breaking change, deploy independente ✓
  16. DoD: 20 itens marcados ✓

Agente: "Change fix-testes concluída. 5 commits, pronta para produção."
```

---

**Orçamento de tokens**: ≈500 linhas, dentro do limite.

**Complementa**: `openspec-implementation` (implementação), `test-driven-development` (ciclo TDD).
