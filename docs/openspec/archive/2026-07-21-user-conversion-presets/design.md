# User Conversion Presets — Design

> **Status:** DRAFT
> **Data:** 2026-07-21
> **Modulo:** backend/conversion + frontend/wizard

---

## 1. Motivacao / Context

Apos a change `wizard-conversion-fields`, o usuario consegue configurar os 35 campos de conversao. Porem, essas configuracoes sao efemeras — perdem-se ao sair do wizard. Usuarios frequentes precisam recriar suas combinacoes favoritas toda vez.

Esta change adiciona persistencia de configuracoes como **presets do usuario**, um novo capability do sistema com CRUD completo, endpoint dedicado, e integracao no wizard.

## 2. Goals & Non-Goals

### Goals
- Persistir configuracoes de conversao como presets reutilizaveis por usuario
- API dedicada para presets do usuario (`/api/conversions/presets`), separada do catalogo
- Separar visualmente presets do sistema e do usuario no dropdown
- Permitir atualizar os valores de um preset existente (nao apenas metadados)
- Pre-selecionar preset padrao ao abrir o wizard

### Non-Goals
- Nao compartilhar presets entre usuarios
- Nao exportar/importar presets como JSON
- Nao ordenar automaticamente por uso (campos existem, UI futura)
- Nao alterar o endpoint `GET /api/conversions/options`

## 3. Principios de Design

1. **Endpoints separados por responsabilidade**: `GET /api/conversions/options` eh um catalogo estatico do sistema. `GET /api/conversions/presets` retorna dados do usuario autenticado. Sem acoplamento.

2. **Preset eh apenas overrides**: `values` segue o mesmo formato de `fieldOptions` — `Record<string, string | number | boolean>`. O frontend aplica da mesma forma que um preset do sistema. Campos ausentes usam defaults do backend.

3. **Limite configuravel, nao hardcoded**: O backend impoe um limite de presets por usuario via variavel de ambiente/config, nao via constante na spec.

4. **Unicidade de isDefault**: Cada usuario pode ter no maximo 1 preset padrao. A troca eh atomica (transacao Prisma).

## 4. Modelo de Dados

### 4.1 Prisma Model

```prisma
model UserPreset {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  name        String    @db.VarChar(100)
  description String?   @db.VarChar(500)
  values      Json      @db.JsonB
  isDefault   Boolean   @default(false) @map("is_default")
  lastUsedAt  DateTime? @map("last_used_at") @db.Timestamptz
  usageCount  Int       @default(0) @map("usage_count")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, name])
  @@index([userId])
  @@map("user_presets")
}
```

**Campos adicionais vs versao anterior:**
- `lastUsedAt`: atualizado quando o usuario seleciona o preset no wizard. Permite ordenacao "Recentes" no futuro.
- `usageCount`: incrementado quando o preset eh usado em uma conversao efetiva (`POST /api/conversions`). Permite ordenacao "Mais usados" no futuro.

### 4.2 Relacao no User

```prisma
model User {
  // ... campos existentes
  userPresets  UserPreset[]
}
```

### 4.3 Limites

| Constraint | Valor | Configuravel? |
|-----------|-------|--------------|
| Max presets por usuario | Padrao: 20 | Sim — variavel de ambiente `MAX_USER_PRESETS` |
| Nome max length | 100 chars | Nao (schema fixo) |
| Nome min length | 1 char | Nao (schema fixo) |
| Descricao max length | 500 chars | Nao (schema fixo) |
| Values max keys | 35 | Nao (limitado pelo catalogo de campos) |

## 5. API REST

### 5.1 Endpoints

| Metodo | Rota | Descricao | Auth |
|--------|------|-----------|------|
| `GET` | `/api/conversions/presets` | Lista presets do usuario autenticado | Sim |
| `POST` | `/api/conversions/presets` | Cria novo preset | Sim |
| `PATCH` | `/api/conversions/presets/:presetId` | Edita nome, descricao, isDefault | Sim |
| `PUT` | `/api/conversions/presets/:presetId/values` | Atualiza valores do preset | Sim |
| `DELETE` | `/api/conversions/presets/:presetId` | Exclui preset | Sim |

### 5.2 Schemas (Zod)

```ts
// POST body — criar preset
const createUserPresetSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  isDefault: z.boolean().optional().default(false),
})

// PATCH body — editar metadados
const updateUserPresetSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  isDefault: z.boolean().optional(),
})

// PUT body — atualizar valores
const updateUserPresetValuesSchema = z.object({
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
})
```

### 5.3 Respostas

```ts
// GET /api/conversions/presets → 200
interface UserPresetResponse {
  id: string
  name: string
  description?: string
  values: Record<string, string | number | boolean>
  isDefault: boolean
  lastUsedAt?: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

// POST → 201 (UserPresetResponse)
// PATCH → 200 (UserPresetResponse)
// PUT /values → 200 (UserPresetResponse)
// DELETE → 204 No Content

// Erros:
// 400 — validacao falhou ou limite atingido
// 403 — preset nao pertence ao usuario
// 404 — preset nao encontrado
// 409 — nome duplicado
```

### 5.4 Logica de `isDefault` (toggle unico)

Ao criar/editar um preset com `isDefault: true`:
1. `UPDATE user_presets SET is_default = false WHERE user_id = :userId AND is_default = true`
2. Aplica `isDefault = true` no preset alvo
3. Executado em transacao Prisma (`$transaction`)

### 5.5 `lastUsedAt` e `usageCount`

- `lastUsedAt`: atualizado via request background quando o frontend notifica que o usuario selecionou o preset. Pode ser um side-effect do `POST /api/conversions` que verifica se o preset ativo eh do usuario.
- `usageCount`: incrementado atomicamente quando uma conversao eh criada com um user preset ativo.

Ambos sao atualizados de forma nao-bloqueante (fire-and-forget). Falha na atualizacao nao afeta o fluxo principal.

## 6. Frontend

### 6.1 Carregamento paralelo

```ts
// No wizard step 4:
const { data: options } = useConversionOptions()  // catalogo + presets do sistema
const { presets: userPresets, ...presetActions } = useUserPresets()  // presets do usuario

// Ambas as queries rodam em paralelo, sem dependencia
```

O `GET /api/conversions/options` **nao eh alterado** por esta change. O campo continua se chamando `presets` (nao `systemPresets`).

### 6.2 `PresetSelector` (Novo componente)

Substitui o `<Select>` simples. Renderiza dropdown com secoes:

```
┌─────────────────────────────────┐
│ ▾ Meu Kindle                    │
├─────────────────────────────────┤
│  Presets do sistema             │
│  ○ Mangá                        │
│  ○ Webtoon                      │
│  ○ HQ Ocidental                 │
│  ○ Alta Qualidade               │
│  ○ Sem Processamento            │
│─────────────────────────────────│
│  Meus presets                   │
│  ● Meu Kindle  ✏️ 🗑️ ⭐         │
│  ○ Manga HQ    ✏️ 🗑️            │
│─────────────────────────────────│
│  + Salvar como preset           │
└─────────────────────────────────┘
```

**Deteccao de preset ativo (user > system):**

```ts
const { activePresetId, activePresetSource } = useMemo(() => {
  if (!options) return { activePresetId: null, activePresetSource: null }
  const effective = buildEffectiveState(options.fields, data.fieldOptions)

  // Checar presets do usuario primeiro (prioridade)
  for (const preset of userPresets) {
    if (isPresetMatch(effective, preset)) {
      return { activePresetId: preset.id, activePresetSource: 'user' as const }
    }
  }
  // Checar presets do sistema
  for (const preset of options.presets) {
    if (isPresetMatch(effective, preset)) {
      return { activePresetId: preset.id, activePresetSource: 'system' as const }
    }
  }
  return { activePresetId: null, activePresetSource: null }
}, [data.fieldOptions, options, userPresets])
```

### 6.3 `SavePresetDialog` (Novo componente)

Dialog com 3 modos:
1. **Criar novo**: nome + descricao + checkbox isDefault
2. **Editar metadados**: nome + descricao pre-preenchidos
3. **Atualizar valores**: confirmar atualizacao dos valores de um preset existente

```
┌─────────────────────────────────────┐
│  Salvar como Preset            ✕    │
│─────────────────────────────────────│
│                                     │
│  Nome *                             │
│  ┌─────────────────────────────┐    │
│  │ Meu Kindle                  │    │
│  └─────────────────────────────┘    │
│  ⚠ Nome ja existe (se duplicado)    │
│                                     │
│  Descricao                          │
│  ┌─────────────────────────────┐    │
│  │ Config otimizada pro Kindle │    │
│  └─────────────────────────────┘    │
│                                     │
│  ☐ Definir como preset padrao       │
│                                     │
│  Configuracoes:                     │
│  mangaMode: true, gamma: 2.0       │
│  jpegQuality: 85                    │
│                                     │
│  [Cancelar]           [Salvar]      │
└─────────────────────────────────────┘
```

### 6.4 Fluxo "Atualizar" vs "Salvar como novo"

Quando o usuario modifica campos com um user preset ativo:

1. O dropdown muda para "Personalizado"
2. Aparece um botao contextual (split button ou toolbar):
   - **"Atualizar [nome do preset]"** → `PUT /api/conversions/presets/:id/values` com os novos valores
   - **"Salvar como novo preset"** → abre `SavePresetDialog` no modo criacao

Este fluxo so aparece quando `activePresetSource === 'user'` e houve divergencia. Para presets do sistema, apenas "Salvar como novo" eh oferecido.

### 6.5 `useUserPresets` (Novo hook)

```ts
function useUserPresets() {
  return {
    presets: UserPresetResponse[]
    isLoading: boolean
    error: Error | null
    create: (data: CreateInput) => Promise<UserPresetResponse>
    updateMeta: (id: string, data: UpdateMetaInput) => Promise<void>
    updateValues: (id: string, values: Record<...>) => Promise<void>
    remove: (id: string) => Promise<void>
    toggleDefault: (id: string) => Promise<void>
    isAtLimit: boolean
  }
}
```

Cada mutacao invalida a query de presets do usuario. Nao invalida `conversionOptions` (sao independentes).

### 6.6 Comportamento ao excluir preset ativo

Ao excluir o preset atualmente selecionado:
- `fieldOptions` **mantem os valores atuais** (nao reseta para `{}`)
- `activePresetId` passa a ser `null` ("Personalizado")
- O usuario pode continuar usando os mesmos valores ou selecionar outro preset

Isso evita perda acidental de configuracao ao excluir um preset.

## 7. Decisoes

### D1. Endpoint dedicado vs embarcado no options
**Decisao:** `GET /api/conversions/presets` separado de `GET /api/conversions/options`.
**Rationale:** `/options` eh um catalogo estatico. Misturar dados do usuario cria acoplamento desnecessario. Invalidacao de cache e autenticacao ficam mais claras com endpoints separados.

### D2. PATCH (metadados) vs PUT (valores)
**Decisao:** `PATCH /presets/:id` edita nome/descricao/isDefault. `PUT /presets/:id/values` atualiza valores.
**Rationale:** Sao operacoes com semanticas diferentes. Renomear um preset nao deve exigir reenviar todos os valores. Atualizar valores eh uma operacao mais significativa que merece rota propria.

### D3. Prioridade user preset > system preset
**Decisao:** Na deteccao de `activePresetId`, presets do usuario sao verificados primeiro.
**Rationale:** Se o usuario criou um preset com os mesmos valores de um preset do sistema, a intencao do usuario deve prevalecer.

### D4. Presets de usuario nunca sao `exclusive`
**Decisao:** O campo `exclusive` eh reservado para presets do sistema.
**Rationale:** `exclusive` corresponde ao comportamento especifico do KCC (`-n`/noProcessing). Combinacoes arbitrarias do usuario nao devem desabilitar todos os campos.

### D5. Limite configuravel
**Decisao:** O backend impoe um limite via variavel de ambiente/config (`MAX_USER_PRESETS`).
**Rationale:** Permite ajustar sem alterar spec ou codigo. O frontend consulta o backend para saber se atingiu o limite (contagem na resposta do GET ou campo `maxPresets` no response).

### D6. Exclusao de preset ativo mantem valores
**Decisao:** Ao excluir preset selecionado, `fieldOptions` mantem valores atuais e preset volta para "Personalizado".
**Rationale:** Evita perda acidental. O usuario pode ja ter ajustado os valores alem do que o preset continha.

## 8. Riscos e Trade-offs

| Risco | Mitigacao |
|-------|-----------|
| Muitos presets poluindo dropdown | Limite configuravel + secao separada com scroll |
| Nome duplicado entre sistema e usuario | Sao secoes separadas, nao ha conflito |
| Race condition ao criar em multiplas abas | `@@unique([userId, name])` no banco + 409 no frontend |
| Preset desatualizado (backend adicionou campos novos) | Preset salva apenas overrides — campos novos usam defaults |
| Exclusao acidental | Dialog de confirmacao antes de DELETE |
| `lastUsedAt`/`usageCount` imprecisos | Atualizado fire-and-forget, falha nao afeta fluxo. Dados sao "best effort" |
