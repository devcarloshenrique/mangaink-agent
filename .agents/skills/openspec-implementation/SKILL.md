---
name: openspec-implementation
description: Implementa propostas de especificação aprovadas, executando tarefas sequencialmente com testes e validação. Use ao implementar mudanças, aplicar propostas, executar tarefas de spec ou construir a partir de planos aprovados. Gatilhos: "openspec implement", "implementar", "aplicar mudança", "executar spec", "trabalhar nas tarefas", "construir feature", "iniciar implementação".
---

# Implementação de Especificações

Implementa sistematicamente propostas de spec aprovadas, executando tarefas sequencialmente com testes e validação adequados.

## Início Rápido

A implementação segue um ciclo **ler → executar → testar → validar** para cada tarefa:
1. Leia a proposta completa e a lista de tarefas
2. Execute as tarefas uma de cada vez, em ordem
3. Teste cada tarefa concluída
4. Marque como concluída somente após verificação

**Regra crítica**: Use TodoWrite para acompanhar o progresso. Nunca pule tarefas nem marque trabalho incompleto como concluído.

## Fluxo de Trabalho

Copie este checklist e acompanhe o progresso:

```
Progresso da Implementação:
- [ ] Passo 1: Carregar e entender a proposta
- [ ] Passo 2: Configurar TodoWrite para acompanhamento
- [ ] Passo 3: Executar tarefas sequencialmente
- [ ] Passo 4: Testar e validar cada tarefa
- [ ] Passo 5: Atualizar especificações vivas (se aplicável)
- [ ] Passo 6: Marcar tasks como concluídas no arquivo tasks.md
- [ ] Passo 7: Marcar proposta como implementada (IMPLEMENTED)
```

### Passo 1: Carregar e entender a proposta

Antes de começar, leia todo o contexto:

```bash
# Read the proposal
cat docs/openspec/changes/{change-id}/proposal.md

# Read all tasks
cat docs/openspec/changes/{change-id}/tasks.md

# Read spec deltas to understand requirements
find docs/openspec/changes/{change-id}/specs -name "*.md" -exec cat {} \;
```

**Entenda**:
- Por que essa mudança é necessária (do proposal.md)
- Quais são os resultados esperados
- Quais specs serão afetadas
- Quais são os critérios de aceitação (dos cenários)

### Passo 2: Configurar TodoWrite para acompanhamento

Carregue as tarefas do tasks.md no TodoWrite **antes de começar o trabalho**:

```markdown
**Padrão**:
Leia tasks.md → Extraia a lista numerada → Crie entradas no TodoWrite

**Exemplo**:
Se tasks.md contém:
1. Create database migration
2. Implement API endpoint
3. Add tests
4. Update documentation

Então crie TodoWrite com:
- content: "Create database migration", status: "in_progress"
- content: "Implement API endpoint", status: "pending"
- content: "Add tests", status: "pending"
- content: "Update documentation", status: "pending"
```

**Por que isso importa**: TodoWrite dá visibilidade ao usuário sobre o progresso e garante que nada seja esquecido.

### Passo 3: Executar tarefas sequencialmente

Trabalhe nas tarefas **uma de cada vez, em ordem**:

```markdown
Para cada tarefa:
1. Marque como "in_progress" no TodoWrite
2. Execute o trabalho
3. Teste o trabalho
4. Só marque como "completed" após verificação

NUNCA avance ou agrupe várias tarefas antes de testar.
```

**Padrão de execução de tarefa**:

```markdown
## Task: {Task Description}

**What**: [Brief explanation of what this task does]

**Implementation**:
[Code changes, file edits, commands run]

**Verification**:
[How to verify this task is complete]
- [ ] Code compiles/runs
- [ ] Tests pass
- [ ] Meets requirement scenarios

**Status**: ✓ Complete / ✗ Blocked / ⚠ Partial
```

### Passo 4: Testar e validar cada tarefa

Após cada tarefa, verifique se funciona:

**Para tarefas de código**:
```bash
# Run relevant tests
pnpm test

# Run linter
pnpm lint

# Check types (if applicable)
pnpm run type-check
```

**Para tarefas de banco de dados**:
```bash
# Verify migration runs
pnpm db:migrate

# Check schema matches expected
pnpm db:push
```

**Para tarefas de API**:
```bash
# Test endpoint manually
curl -X POST http://localhost:3333/api/endpoint \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Or run integration tests
pnpm test
```

**Só marque a tarefa como concluída após todas as verificações passarem**.

### Passo 5: Atualizar especificações vivas (se aplicável)

**Durante a implementação**, se você descobrir que os deltas de spec precisam de atualizações:

1. **Documente a descoberta** no proposal.md ou em um arquivo de notas
2. **NÃO modifique os deltas de spec** durante a implementação
3. **Após a conclusão da implementação**, considere se a spec precisa de ajustes

**Nota**: Os deltas de spec são mesclados durante o arquivamento (Passo 6), não durante a implementação.

### Passo 6: Marcar tasks como concluídas no arquivo tasks.md

**Após implementar cada tarefa**, o arquivo `tasks.md` deve ser atualizado para refletir o progresso real:

```markdown
Para cada tarefa concluída:
1. Abra docs/openspec/changes/{change-id}/tasks.md
2. Substitua `- [ ]` por `- [x]` nas linhas correspondentes
3. Use Edit tool — NÃO reescreva o arquivo inteiro
```

**Por que isso importa**: O `tasks.md` é o registro canônico do que foi feito. Quando a change for arquivada, qualquer pessoa que ler o archive saberá exatamente o que foi implementado apenas olhando os checkboxes.

**Exemplo**:

Antes:
```markdown
## 1. Schema Prisma
- [ ] 1.1 Adicionar modelos ao schema.prisma
- [ ] 1.2 Adicionar relation ao User
```

Depois:
```markdown
## 1. Schema Prisma
- [x] 1.1 Adicionar modelos ao schema.prisma
- [x] 1.2 Adicionar relation ao User
```

**Regra**: Só marque `[x]` em tarefas que passaram na verificação (Passo 4). Se uma tarefa falhou ou está bloqueada, mantenha `[ ]` e documente o motivo.

### Passo 7: Marcar proposta como implementada

Após todas as tarefas concluídas:

```bash
# Create a completion marker
echo "Implementation completed: $(date)" > docs/openspec/changes/{change-id}/IMPLEMENTED
```

**Informe o usuário**:
```markdown
## Implementation Complete

**Change**: {change-id}
**Tasks completed**: {count}
**Tests**: All passing

**Next step**: Archive this change to merge spec deltas into living documentation.
Say "openspec archive {change-id}" or "archive this change" when ready.
```

## Boas Práticas

### Padrão 1: Tarefas Bloqueadas

Se uma tarefa não puder ser concluída:

```markdown
**Marcar como bloqueada**:
- Mantenha o status como "in_progress" (NÃO "completed")
- Documente o bloqueio claramente
- Crie uma nova tarefa para resolver o bloqueio
- Informe o usuário imediatamente

**Example**:
Task: "Implement payment processing"
Blocker: "Missing API credentials for payment gateway"
Action: Create new task "Obtain payment gateway credentials"
```

### Padrão 2: Dependências entre Tarefas

Se as tarefas têm dependências, verifique os pré-requisitos antes de começar:

```bash
# Example: Database migration must run before API code
# Check migration status
pnpm db:migrate status

# Only proceed with API task if migration succeeded
```

### Padrão 3: Testes Incrementais

Teste incrementalmente, não no final:

**Good**:
```
Task 1: Create model → Test model → Mark complete
Task 2: Create API → Test API → Mark complete
Task 3: Add validation → Test validation → Mark complete
```

**Bad**:
```
Task 1, 2, 3 → Implement all → Test everything → Debug failures
```

### Padrão 4: Documentação Viva

Mantenha README, documentação de API e comentários atualizados **conforme avança**:

```markdown
When adding a new API endpoint, also:
- Update API documentation
- Add example request/response
- Update OpenAPI/Swagger spec
- Add inline code comments
```

## Tópicos Avançados

**Trabalho paralelo**: Se as tarefas forem verdadeiramente independentes (ex.: módulos separados), você pode trabalhar nelas em paralelo, mas cada uma deve ser testada independentemente.

**Pontos de integração**: Quando existirem dependências entre tarefas, use testes de integração para verificar se a conexão funciona.

**Estratégia de rollback**: Para mudanças arriscadas, crie tarefas de rollback antes de implantar.

## Padrões Comuns

### Padrão 1: Database + API + UI

Ordem típica neste projeto:
1. Database schema/migration (Prisma)
2. Data access layer (repositories)
3. Business logic layer (use-cases/services)
4. API endpoints (controllers + routes)
5. Shared schemas (`apps/shared`)
6. Frontend integration (React + TanStack Query)
7. End-to-end tests (Vitest)

### Padrão 2: Feature Flags

Para implantações graduais:
1. Implement feature behind flag
2. Test with flag enabled
3. Deploy with flag disabled
4. Enable flag incrementally
5. Remove flag after full rollout

### Padrão 3: Breaking Changes

Para mudanças quebradoras de API:
1. Implement new version (v2)
2. Keep old version (v1) working
3. Add deprecation warnings to v1
4. Migrate users to v2
5. Remove v1 (separate task/proposal)

## Anti-Padrões a Evitar

**Don't**:
- Skip testing individual tasks
- Mark tasks complete before verification
- Ignore failing tests ("I'll fix it later")
- Batch multiple tasks before testing
- Modify living specs during implementation
- Work out of order (dependencies break)

**Do**:
- Test each task immediately
- Fix failing tests before proceeding
- Update TodoWrite in real-time
- Document blockers clearly
- Communicate progress to user
- Keep commits atomic and descriptive

## Solução de Problemas

### Problema: Tests failing after task completion

**Solution**:
```markdown
1. Do NOT mark task complete
2. Debug the failure
3. Fix the code
4. Re-run tests
5. Only mark complete after pass
```

### Problema: Task is too large

**Solution**:
```markdown
1. Break into subtasks
2. Update TodoWrite with subtasks
3. Complete subtasks sequentially
4. Mark parent task complete after all subtasks done
```

### Problema: Dependency not met

**Solution**:
```markdown
1. Pause current task
2. Complete dependency first
3. Test dependency
4. Resume original task
```

## Referências

- [TASK_PATTERNS.md](reference/TASK_PATTERNS.md) - Padrões comuns de execução de tarefas
- [TESTING_STRATEGIES.md](reference/TESTING_STRATEGIES.md) - Abordagens de teste por tipo de tarefa

---

**Orçamento de tokens**: Este SKILL.md tem aproximadamente 430 linhas, dentro do limite recomendado de 500 linhas.
