---
name: prisma-docs
description: Mantém a documentação do schema Prisma sempre atualizada. Use quando o prisma/schema.prisma for modificado, quando novas migrations forem criadas, ou quando modelos/relações do banco mudarem. Gatilhos: "atualizar documentação do prisma", "schema mudou", "nova migration", "documentar banco", "prisma schema docs", "atualizar docs/prisma-schema.md".
---

# Atualização da Documentação do Schema Prisma

Sempre que o schema do banco de dados mudar, esta skill mantém `docs/prisma-schema.md` sincronizado com a realidade.

## Regras de Ouro

1. **NUNCA gere a doc do zero se o arquivo já existe** — leia o existente e atualize só o que mudou.
2. **Mantenha o tom didático** — explique para alguém que nunca viu o banco. Use analogias do mundo real (ex: "uma Conversion é como um pedido no iFood").
3. **Sempre inclua**: diagrama de relações, tabela de colunas, JSONB explicado, fluxo da aplicação no banco, IDs de negócio.
4. **Siga as convenções do projeto**: snake_case nas colunas, `@map()` do Prisma, provedor PostgreSQL.
5. **Verifique** que o arquivo final está em `/docs/prisma-schema.md`.

## Fluxo de Trabalho

### Passo 1: Detectar mudanças

```bash
# O schema Prisma está sempre aqui:
cat apps/backend/prisma/schema.prisma
```

Compare mentalmente com o que está documentado em `docs/prisma-schema.md`:
- Novos modelos? → Adicionar seção completa
- Modelos removidos? → Remover seção
- Colunas novas/alteradas/removidas? → Atualizar tabela de colunas
- Relações novas/alteradas? → Atualizar diagrama e seções de relação
- Índices novos/removidos? → Atualizar

### Passo 2: Atualizar a documentação

Para cada mudança detectada:

**Modelo novo**:
```markdown
### `nome_tabela` (NomeModelo)

Descrição em português do que esse modelo representa no mundo real.

| Coluna | Tipo | Descrição |
|---|---|---|
| ... | ... | ... |

**JSONB — `campo_json`**: (se aplicável)
```json
{ "exemplo": "real" }
```

**Relações**: ...
**Índices**: ...
```

**Coluna nova em modelo existente**: Adicione uma linha na tabela de colunas.

**Coluna removida**: Remova a linha da tabela.

**Relação nova**: Atualize o diagrama ASCII e a seção de relações do modelo.

### Passo 3: Atualizar o diagrama

O diagrama ASCII no topo do documento deve sempre refletir o estado atual. Regras:
- Use `┌─┐└─┘│├┤┬┴┼` para desenhar
- FK com CASCADE → linha sólida
- Soft ref (sem FK) → linha tracejada (`- - -`)
- Cardinalidade: `1` na ponta do pai, `N` na ponta dos filhos
- Cada caixa deve ter nome da tabela + descrição curta de 1 linha

### Passo 4: Atualizar o fluxo da aplicação

Se a mudança altera o fluxo de negócio (ex: nova etapa no pipeline de conversão), atualizar a seção "Fluxo Completo da Aplicação no Banco".

### Passo 5: Verificar convenções

```bash
# Confirmar que o arquivo está no lugar certo
ls -la docs/prisma-schema.md
```

Conferir:
- Todos os nomes de tabela em snake_case e plural
- Campos JSONB têm exemplo de estrutura
- IDs de negócio estão documentados
- Seção "Convenções" está atualizada

## Estrutura Padrão do Documento

O `docs/prisma-schema.md` deve sempre seguir esta estrutura:

```
# Schema do Banco de Dados — MangaInk Agent
## Diagrama de Relações
## Modelos
### `tabela` (Modelo)
## Fluxo Completo da Aplicação no Banco
## IDs de Negócio × IDs Internos
## Convenções
```

## Exemplos de Boas Descrições

**Ruim**: "Tabela que armazena conversões."
**Bom**: "Conversão pedida pelo usuário. Representa a intenção: 'quero converter os capítulos X, Y, Z do mangá W para EPUB no meu Kindle 11'. Cada Book vira um ConversionJob."

**Ruim**: "Coluna status. Tipo: VARCHAR(20)."
**Bom**: "`status` — VARCHAR(20) — `queued` → `preparing` → `downloading` → `converting` → `packaging` → `completed`/`failed`"

## Anti-Padrões

**Não faça**:
- Reescrever o documento inteiro se só uma coluna mudou
- Remover o diagrama ASCII
- Usar linguagem técnica sem explicar (ex: "FK com ON DELETE CASCADE" sem dizer o que acontece)
- Esquecer de atualizar a seção de convenções
- Deixar JSONB sem exemplo da estrutura

**Faça**:
- Atualizações cirúrgicas — só mexer no que mudou
- Manter o diagrama sempre preciso
- Explicar o "porquê" das decisões (ex: soft ref em source_id)
- Verificar que os índices estão documentados
- Testar que o markdown renderiza corretamente

---

**Orçamento de tokens**: Aproximadamente 150 linhas, bem abaixo do limite de 500.
