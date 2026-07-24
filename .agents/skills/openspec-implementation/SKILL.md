---
name: openspec-implementation
description: Implementa propostas de especificação aprovadas com TDD estrito (Red-Green-Refactor), executando tarefas sequencialmente com testes antes do código. Use ao implementar mudanças, aplicar propostas, executar tarefas de spec ou construir a partir de planos aprovados. Gatilhos: "openspec implement", "implementar", "aplicar mudança", "executar spec", "trabalhar nas tarefas", "construir feature", "iniciar implementação".
---

# Implementação de Especificações com TDD

Implementa propostas de spec aprovadas com **TDD estrito**: testes primeiro, código depois. Cada tarefa segue o ciclo Red-Green-Refactor.

## Início Rápido

1. Leia a proposta completa e a lista de tarefas
2. Configure TodoWrite com todas as tarefas
3. Para **cada tarefa**, siga TDD: **RED** (escrever teste falhando) → **GREEN** (código mínimo) → **REFACTOR** (limpar)
4. Só marque como concluída após verificação

**Regra de ferro**: NENHUM código de produção sem um teste falhando primeiro. Use TodoWrite para acompanhar o progresso.

## Fluxo de Trabalho

```
Progresso da Implementação:
- [ ] Passo 1: Carregar e entender a proposta
- [ ] Passo 2: Configurar TodoWrite para acompanhamento
- [ ] Passo 3: Executar tarefas com TDD (Red-Green-Refactor)
- [ ] Passo 4: Validar integração (test suite completa)
- [ ] Passo 5: Atualizar especificações vivas (se aplicável)
- [ ] Passo 6: Marcar tasks como concluídas no arquivo tasks.md
- [ ] Passo 7: Marcar proposta como implementada (IMPLEMENTED)
```

### Passo 1: Carregar e entender a proposta

```bash
cat docs/openspec/changes/{change-id}/proposal.md
cat docs/openspec/changes/{change-id}/tasks.md
find docs/openspec/changes/{change-id}/specs -name "*.md" -exec cat {} \;
```

**Entenda**: por que essa mudança é necessária, resultados esperados, specs afetadas, critérios de aceitação.

### Passo 2: Configurar TodoWrite para acompanhamento

Carregue as tarefas do `tasks.md` no TodoWrite **antes de começar o trabalho**:

```markdown
Leia tasks.md → Extraia a lista numerada → Crie entradas no TodoWrite

Exemplo:
- content: "Criar migration do banco", status: "in_progress"
- content: "Implementar endpoint da API", status: "pending"
- content: "Adicionar testes E2E", status: "pending"
```

### Passo 3: Executar tarefas com TDD (Red-Green-Refactor)

Cada tarefa segue o ciclo TDD. **NUNCA** pule etapas, **NUNCA** escreva código antes do teste.

#### 3.1 RED — Escrever teste falhando

Escreva um teste mínimo mostrando o comportamento esperado:

```typescript
// ✅ BOM: Nome claro, comportamento real, uma coisa só
test('rejeita email vazio', async () => {
  const resultado = await enviarFormulario({ email: '' });
  expect(resultado.erro).toBe('Email obrigatório');
});
```

**Requisitos**: um comportamento por teste, nome descritivo, código real (mocks apenas se inevitável).

#### 3.2 Verificar RED — Ver a falha

**OBRIGATÓRIO. Nunca pule.**

```bash
pnpm test -- --reporter=verbose caminho/para/teste
```

Confirme:
- Teste **falha** (não dá erro de compilação)
- Mensagem de falha é a esperada
- Falha porque funcionalidade está faltando, não por erros de digitação

**Teste passou?** Você está testando comportamento existente. Corrija o teste.
**Teste deu erro?** Corrija o erro, execute novamente até falhar corretamente.

#### 3.3 GREEN — Código mínimo

Escreva o código mais simples para passar no teste. **Nada além do que o teste exige.**

```typescript
function enviarFormulario(dados: DadosFormulario) {
  if (!dados.email?.trim()) {
    return { erro: 'Email obrigatório' };
  }
  // ...
}
```

Não adicione funcionalidades extras, não refatore outro código, não "melhore" além do teste.

#### 3.4 Verificar GREEN — Ver passar

**OBRIGATÓRIO.**

```bash
pnpm test -- --reporter=verbose caminho/para/teste
```

Confirme: teste passa, outros testes ainda passam, saída limpa (sem erros ou warnings).

**Teste falhou?** Corrija o código, não o teste.
**Outros testes falharam?** Corrija agora.

#### 3.5 REFACTOR — Limpar

Após o verde apenas: remova duplicação, melhore nomes, extraia helpers. Mantenha os testes verdes. Não adicione comportamento.

#### 3.6 Próximo teste

Repita o ciclo para o próximo comportamento da mesma tarefa. Só avance para a próxima tarefa quando a atual estiver completa.

### Passo 4: Validar integração

Após concluir uma tarefa ou um grupo delas, execute a suíte completa:

```bash
pnpm test          # Testes unitários e de integração
pnpm lint          # ESLint
pnpm run type-check  # Verificação de tipos (se aplicável)
```

### Passo 5: Atualizar especificações vivas

Durante a implementação, se descobrir que os deltas de spec precisam de ajustes:
1. Documente a descoberta no proposal.md
2. **NÃO modifique os deltas de spec** durante a implementação
3. Após conclusão, considere se a spec precisa de ajustes

### Passo 6: Marcar tasks no arquivo tasks.md

Para cada tarefa concluída, use Edit tool para substituir `- [ ]` por `- [x]` no `tasks.md`. Só marque tarefas que passaram na verificação completa.

### Passo 7: Marcar proposta como implementada

```bash
echo "Implementation completed: $(date)" > docs/openspec/changes/{change-id}/IMPLEMENTED
```

```
## Implementation Complete
**Change**: {change-id}
**Tasks completed**: {count}
**Tests**: All passing

**Next step**: Use a skill `change-completion` para finalizar: revisão, validação, arquivamento, commits atômicos.
```

## A Lei de Ferro do TDD

```
NENHUM CÓDIGO DE PRODUÇÃO SEM UM TESTE FALHANDO PRIMEIRO
```

Escreveu código antes do teste? Delete. Comece de novo. **Sem exceções:**
- Não mantenha como "referência"
- Não "adapte" enquanto escreve os testes
- Não olhe para ele — deletar significa deletar

Implemente do zero a partir dos testes. Ponto final.

## Boas Práticas

### Tarefas Bloqueadas

Se uma tarefa não puder ser concluída: mantenha como "in_progress", documente o bloqueio, crie uma nova tarefa para resolvê-lo, informe o usuário.

### Dependências entre Tarefas

Verifique pré-requisitos antes de começar cada tarefa. Ex.: migration do banco deve rodar antes do código da API.

### TDD: Bons Testes

| Qualidade | Bom | Ruim |
|-----------|-----|------|
| **Mínimo** | Uma coisa. "e" no nome? Divida. | `test('valida email e domínio e espaço')` |
| **Claro** | Nome descreve comportamento | `test('teste1')` |
| **Mostra intenção** | Demonstra a API desejada | Obscurece o que o código deveria fazer |

### TDD: Compatibilidade Cross-Platform

Testes devem passar em qualquer SO sem modificação.

- ❌ `const p = basePath + '/covers/' + filename`
- ✅ `const p = path.join(basePath, 'covers', filename)`
- ❌ `expect(result.filePath).toContain('/covers/')`
- ✅ `expect(result.filePath).toContain(path.join('sources', id, 'covers'))`

Mocks de I/O: normalize separadores com `replace(/\\/g, '/')` para buscas por prefixo.

### TDD: Isolamento de Recursos

- **Diretórios temporários**: use `os.tmpdir()` + sufixo aleatório. Remova em `afterAll`/`globalTeardown`.
- **Banco de dados**: testes de integração usam banco dedicado (`_test_db`). Limpe com `beforeEach deleteMany`.
- **Todo recurso criado** por teste deve ser removido ao final, passe ou falhe.

### TDD: Singletons e Efeitos Colaterais

A mera importação de um módulo não deve causar efeitos colaterais.
- ❌ `export const prisma = new PrismaClient()` no nível do módulo
- ✅ `let _client; export function getClient() { ... }` com inicialização lazy

### TDD: Execução Paralela

Se `fileParallelism > 1`, cada worker deve usar diretórios, portas e namespaces de banco independentes. Considere `pool: 'forks'` para isolamento de memória.

## Padrões Comuns

### Database + API + UI

Ordem típica neste projeto:
1. Database schema/migration (Prisma)
2. Data access layer (repositories)
3. Business logic (use-cases/services) — **TDD cada camada**
4. API endpoints (controllers + routes)
5. Shared schemas (`apps/shared`)
6. Frontend integration (React + TanStack Query)
7. End-to-end tests (Vitest)

### Feature Flags

Para implantações graduais: implemente atrás de flag → teste com flag habilitada → deploy com flag desabilitada → habilite incrementalmente → remova flag após rollout completo.

### Breaking Changes

Mudanças quebradoras de API: implemente v2 → mantenha v1 funcionando → adicione avisos de depreciação → migre usuários → remova v1 (tarefa/proposta separada).

## Racionalizações Comuns (Não Caia Nessas)

| Desculpa | Realidade |
|----------|-----------|
| "Simples demais para testar" | Código simples quebra. Teste leva 30 segundos. |
| "Vou testar depois" | Testes passando imediatamente não provam nada. |
| "Testes depois alcançam mesmos objetivos" | Testes-depois = "o que isso faz?" Testes-primeiro = "o que isso deveria fazer?" |
| "Já testei manualmente" | Ad-hoc ≠ sistemático. Sem registro, não pode reexecutar. |
| "Deletar X horas é desperdício" | Falácia do custo irrecuperável. Manter código não verificado é dívida. |
| "Manter como referência, escrever testes primeiro" | Você vai adaptar. Isso é testar depois. Delete. |
| "Preciso explorar primeiro" | Tudo bem. Jogue fora a exploração, comece com TDD. |
| "TDD vai me atrasar" | TDD é mais rápido que debug. Pragmático = test-first. |

## Bandeiras Vermelhas — PARE e Recomece

- Código antes do teste
- Teste passa imediatamente (sem ter visto falhar)
- Não consegue explicar por que o teste falhou
- Testes adicionados "depois"
- Racionalizando "só desta vez"
- "Já testei manualmente"
- "Manter como referência" ou "adaptar código existente"

**Tudo isso significa: Delete o código. Recomece com TDD.**

## Anti-Padrões a Evitar

**Don't:**
- Escrever código de produção sem teste pendente
- Marcar tarefas como completas antes da verificação
- Ignorar testes falhando ("arrumo depois")
- Agrupar várias tarefas antes de testar
- Modificar specs durante a implementação
- Trabalhar fora de ordem (dependências quebram)

**Do:**
- Seguir Red-Green-Refactor em cada tarefa
- Ver o teste falhar antes de implementar
- Corrigir testes falhando antes de prosseguir
- Atualizar TodoWrite em tempo real
- Manter commits atômicos e descritivos

## Quando Estiver Travado (TDD)

| Problema | Solução |
|----------|---------|
| Não sabe como testar | Escreva a API desejada. Escreva a asserção primeiro. |
| Teste complicado demais | Design complicado demais. Simplifique a interface. |
| Precisa mockar tudo | Código muito acoplado. Use injeção de dependência. |
| Setup do teste enorme | Extraia helpers. Ainda complexo? Simplifique o design. |

**Bug encontrado?** Escreva um teste falhando que o reproduza. Siga o ciclo TDD. O teste prova a correção e previne regressão.

## Solução de Problemas

### Testes falhando após tarefa

1. NÃO marque como concluída
2. Debug a falha
3. Corrija o código
4. Re-execute os testes
5. Só marque como concluída após passar

### Tarefa muito grande

1. Quebre em subtarefas
2. Atualize TodoWrite com subtarefas
3. Complete subtarefas sequencialmente
4. Marque tarefa pai como concluída após todas as subtarefas

### Dependência não atendida

1. Pause a tarefa atual
2. Complete a dependência primeiro
3. Teste a dependência
4. Retome a tarefa original

## Referências

- [testing-anti-patterns.md](reference/testing-anti-patterns.md) — Anti-padrões de teste: mocks, métodos só para teste, etc.
- [TASK_PATTERNS.md](reference/TASK_PATTERNS.md) — Padrões comuns de execução de tarefas
- [TESTING_STRATEGIES.md](reference/TESTING_STRATEGIES.md) — Abordagens de teste por tipo de tarefa

---

**Orçamento de tokens**: Este SKILL.md integra o fluxo de implementação do OpenSpec com TDD estrito como motor de cada tarefa.
