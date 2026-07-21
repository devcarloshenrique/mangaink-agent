# Wizard Conversion Fields — Design

> **Status:** DRAFT v2
> **Data:** 2026-07-20 (rev. 2026-07-21)
> **Modulo:** frontend/wizard

---

## 1. Motivacao / Context

O backend oferece 35 campos de configuracao de conversao via `GET /api/conversions/options`. O frontend atualmente ignora completamente esses campos no wizard, enviando `options: {}` para o backend. O usuario precisa conseguir configurar opcoes como modo manga, qualidade JPEG, recorte, stretching, etc. antes de iniciar a conversao.

O catalogo do backend (`ConversionOptions`) ja contem toda a metadata necessaria para renderizar os campos (tipo, componente, opcoes, limites, grupos), bastando o frontend consumir e renderizar.

## 2. Conceitos de Dominio / Goals & Non-Goals

### Goals
- Renderizar todos os 35 campos de forma organizada e nao-intimidante
- Manter a estetica de quadrinhos (comic pop-art) consistente com o restante do wizard
- Sincronizar preset e campos individuais de forma intuitiva
- Nao quebrar o fluxo existente do wizard (dispositivo, formato, preview mock)
- Enviar `fieldOptions` corretamente populado no POST (apenas overrides)

### Non-Goals
- Nao implementar preview real do backend (requer MOBI ja convertido)
- Nao criar editor de presets (ver change `user-conversion-presets`)
- Nao persistir campo-a-campo entre sessoes
- Nao alterar o comportamento do backend

## 3. Principios de Design

1. **API de Intencao, Nao de Implementacao**: O frontend consome `ConversionField` com `type` e `component` — nao precisa saber nada sobre flags KCC. O backend ja abstrai isso.

2. **Data-driven rendering**: Nao ha switch-case por field ID. O `ConversionFieldRenderer` decide o que renderizar baseado em `field.type` e `field.component`. Tipos desconhecidos recebem fallback sem quebrar a pagina.

3. **Estado unico da verdade**: `WizardData.fieldOptions` eh o estado canonico — um `Record<string, string | number | boolean>` contendo apenas overrides (chaves que o usuario modificou). O renderizador usa `fieldOptions[id] ?? field.default` como fallback visual. Presets apenas escrevem em `fieldOptions`; campos individuais leem e escrevem nele.

4. **Comic-first UI**: Accordion usa `ComicPanel` com bordas `border-ink`, sombras `shadow-comic-sm`, fonte `font-display` nos titulos.

## 4. Arquitetura de Componentes

```
StepConvert (wizard.tsx)
├── Device Select (existente)
├── Format Select (existente)
├── Preset Select (modificado — + logica de sync com deepEqual)
├── Botao "Restaurar padroes" (NOVO)
├── Metadata Inputs (existente)
├── Error Handling Select (existente)
├── ConversionFieldGroup (NOVO) × 5
│   └── Accordion + AccordionItem (Radix)
│       └── ConversionFieldRenderer (NOVO) × N
│           ├── Switch (para type=boolean, component=switch)
│           ├── Select (para type=enum, component=select)
│           ├── Slider (para type=number, component=slider)
│           ├── Input (para type=number, component=input)
│           └── Fallback "Tipo nao suportado" (para tipos desconhecidos)
└── Mock Preview (existente — inalterado)
```

### Arvore de diretorios dos novos arquivos:

```
apps/frontend/src/components/wizard/
├── ComparisonSlider.tsx        (existente)
├── ConversionFieldRenderer.tsx  (NOVO)
└── ConversionFieldGroup.tsx     (NOVO)
```

## 5. Componentes — Especificacao Detalhada

### 5.1 `ConversionFieldRenderer`

**Props:**
```ts
interface ConversionFieldRendererProps {
  field: ConversionField;
  value: string | number | boolean;
  onChange: (id: string, value: string | number | boolean) => void;
  disabled?: boolean;
}
```

**Renderizacao por type/component:**

| type | component | Componente UI | Extra |
|------|-----------|---------------|-------|
| `boolean` | `switch` | `<Switch>` + `<Label>` | — |
| `enum` | `select` | `<Select>` com `<SelectItem>` por option | Extrai `field.options` |
| `number` | `slider` | `<Slider>` + valor numerico | Usa `field.min`, `field.max`, `field.step` |
| `number` | `input` | `<Input type="number">` | Validacao: rejeita NaN, clamp no blur |
| _qualquer outro_ | _qualquer outro_ | `<FallbackField>` | Exibe "Tipo nao suportado: {type}/{component}" sem quebrar |

**Validacao de input numerico:**
- Ao digitar valor nao-numerico (`NaN`): reverte ao valor anterior (ou `field.default`)
- No evento `blur`: clamp ao range `[field.min, field.max]`
- `step` respeitado no slider (Radix gerencia nativamente)
- Valores `0` para `customWidth`/`customHeight` sao validos (significa "usar resolucao do dispositivo")

**Layout de cada field:**
```
┌──────────────────────────────────────────────┐
│ Label                    [Switch / Select]   │
│ Description (text-sm opacity-70)             │
│ Help text (text-xs opacity-50, italic)       │
└──────────────────────────────────────────────┘
```

- Switch: alinhado a direita, label a esquerda
- Select: mesma linha que label, ou abaixo em telas estreitas
- Slider: range horizontal com valor atual em badge
- Input: campo numerico com validacao inline

**Acessibilidade por field:**
- `aria-label={field.label}` no controle interativo
- `aria-describedby={field.id + '-help'}` apontando para o help text
- Label clicavel foca o controle (Switch ja tem esse comportamento nativo; Select/Input usam `<Label htmlFor>`)
- Slider: anuncio de valor atual via `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### 5.2 `ConversionFieldGroup`

**Props:**
```ts
interface ConversionFieldGroupProps {
  groupId: ConversionField['group'];
  groupLabel: string;
  fields: ConversionField[];
  values: Record<string, string | number | boolean>;
  onChange: (id: string, value: string | number | boolean) => void;
  disabled?: boolean;
  defaultExpanded?: boolean;
}
```

**Grupos e labels:**

| groupId | groupLabel | Campos | Default expandido? |
|---------|------------|--------|-------------------|
| `reading` | Leitura | 6 | Sim |
| `processing` | Processamento | 8 | Sim |
| `image` | Imagem | 15 | Nao |
| `output` | Saida | 12 | Nao |
| `format` | Formato | 1 | Nao |

**Subcategorias no grupo `image` (15 campos):**

O grupo `image` eh o maior (15 campos). Para evitar um bloco unico intimidante, os campos sao divididos em 3 subcategorias visuais — sem collapse aninhado, apenas separadores com `<Separator>` e labels em negrito:

| Subcategoria | Campos |
|-------------|--------|
| **Cor e Contraste** | `gamma`, `forceColor`, `autolevel`, `colorAutocontrast`, `noAutocontrast`, `eraseRainbow` |
| **Qualidade e Formato** | `jpegQuality`, `forcePng`, `webp`, `mozjpeg`, `noQuantize` |
| **Bordas e Recorte** | `blackBorders`, `whiteBorders`, `croppingPower`, `croppingMinimum` |

```
┌─ Imagem (15 opcoes) ─────────────────────────┐
│                                               │
│  ── Cor e Contraste ──                        │
│  [gamma slider]  [forceColor switch]          │
│  [autolevel switch] [colorAutocontrast switch]│
│  ...                                          │
│                                               │
│  ── Qualidade e Formato ──                    │
│  [jpegQuality slider] [forcePng switch]       │
│  ...                                          │
│                                               │
│  ── Bordas e Recorte ──                       │
│  [blackBorders switch] [croppingPower slider]  │
│  ...                                          │
└───────────────────────────────────────────────┘
```

**Visual do accordion:**
```tsx
<Accordion type="multiple" defaultValue={['reading', 'processing']}>
  {groups.map(group => (
    <AccordionItem value={group.groupId}>
      <AccordionTrigger>
        <GroupIcon /> {group.groupLabel}
        <Badge>{group.fields.length} opcoes</Badge>
      </AccordionTrigger>
      <AccordionContent>
        {/* Subcategorias apenas para image */}
        {group.groupId === 'image' ? (
          renderSubcategories(group.fields)
        ) : (
          group.fields.map(field => (
            <ConversionFieldRenderer
              key={field.id}
              field={field}
              value={values[field.id] ?? field.default}
              onChange={onChange}
              disabled={disabled}
            />
          ))
        )}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

**Acessibilidade do accordion:**
- Radix Accordion ja fornece navegacao por teclado (Arrow keys, Home, End)
- Ao expandir um grupo, foco move-se para o primeiro campo interativo dentro dele
- Trigger tem `aria-expanded` gerenciado pelo Radix

### 5.3 Icones por grupo

| groupId | Icone (lucide-react) |
|---------|---------------------|
| `reading` | `BookOpen` |
| `processing` | `Cog` |
| `image` | `Image` |
| `output` | `FileOutput` |
| `format` | `FileType` |

## 6. Logica de Sincronizacao Preset ↔ Campos

### 6.1 Estrategia de `fieldOptions`

```
Estado inicial:
  fieldOptions = {}  (vazio — nenhum override)

Valor visual de um campo:
  displayValue = fieldOptions[field.id] ?? field.default

Estado efetivo (usado APENAS para comparacao com presets):
  effectiveState = { ...allDefaults, ...fieldOptions }
  // Montado sob demanda via useMemo, nunca armazenado

POST:
  body.options = fieldOptions  (apenas overrides)
  // Backend aplica seus proprios defaults para chaves ausentes
```

### 6.2 Algoritmo de deteccao de preset (`deepEqual`)

```ts
function buildEffectiveState(
  fields: ConversionField[],
  fieldOptions: Record<string, string | number | boolean>
): Record<string, string | number | boolean> {
  const base: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    base[f.id] = fieldOptions[f.id] ?? f.default;
  }
  return base;
}

function isPresetMatch(
  effectiveState: Record<string, string | number | boolean>,
  preset: ConversionPreset
): boolean {
  const presetKeys = Object.keys(preset.values);
  if (presetKeys.length === 0) return false;

  // Verifica se TODAS as chaves do preset batem
  for (const key of presetKeys) {
    if (effectiveState[key] !== preset.values[key]) return false;
  }

  return true;
}
```

Este algoritmo evita o falso positivo do cenario:
- Preset Manga: `{ mangaMode: true }`
- fieldOptions: `{ mangaMode: true, gamma: 2.0 }`
- Estado efetivo: `{ mangaMode: true, gamma: 2.0, cropping: 'marginsAndPageNumbers', ... }`
- `isPresetMatch` verifica `mangaMode: true` → ok
- Mas o preset Manga real tem `{ mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'upscale' }`
- Verifica `cropping: 'marginsAndPageNumbers'` → ok
- Verifica `stretchMode: 'upscale'` → ok (vem do default)
- Nesse caso, **ainda eh Manga** porque o usuario so adicionou `gamma: 2.0` a mais — e `gamma` nao faz parte do preset Manga
- Se o usuario alterar `stretchMode` para `'stretch'`: `isPresetMatch` → false → "Personalizado"

Isso esta correto: o preset Manga define 3 chaves; enquanto essas 3 chaves baterem, ainda eh Manga, independentemente de outros campos configurados.

### 6.3 Estado derivado

```ts
const activePresetId = useMemo(() => {
  if (!options) return null;

  const effective = buildEffectiveState(options.fields, data.fieldOptions);

  for (const preset of options.presets) {
    if (isPresetMatch(effective, preset)) {
      return preset.id;
    }
  }

  return null; // null = "Personalizado"
}, [data.fieldOptions, options]);
```

### 6.4 Preset dropdown (sem preset fake)

O dropdown de preset contem apenas os 5 presets do backend. Quando `activePresetId === null`, o `<Select>` mostra "Personalizado" com `value=""` — uma opcao puramente visual:

```tsx
<Select value={activePresetId ?? ""} onValueChange={handlePresetChange}>
  <SelectTrigger>
    <SelectValue placeholder="Selecione um preset">
      {activePresetId
        ? options?.presets.find(p => p.id === activePresetId)?.name
        : "Personalizado"
      }
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {options?.presets.map(p => (
      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Nao ha injecao de preset fake no array de opcoes. "Personalizado" existe apenas como display value quando `value=""`.

### 6.5 Handlers

```ts
function handlePresetChange(presetId: string) {
  if (!presetId) return; // "Personalizado" (value="") — mantem valores atuais
  update("preset", presetId);

  const preset = options?.presets.find(p => p.id === presetId);
  if (!preset) return;

  if (preset.exclusive) {
    // Substituicao completa: fieldOptions = apenas os valores do preset
    setData(prev => ({ ...prev, fieldOptions: { ...preset.values } }));
  } else {
    // Merge: aplica valores do preset sobre fieldOptions existente
    setData(prev => ({
      ...prev,
      fieldOptions: { ...prev.fieldOptions, ...preset.values },
    }));
  }
}

function handleFieldChange(id: string, value: string | number | boolean) {
  setData(prev => ({
    ...prev,
    fieldOptions: { ...prev.fieldOptions, [id]: value },
    // preset NAO eh alterado aqui — activePresetId deriva de fieldOptions
  }));
}
```

### 6.6 Reset para defaults

Botao no topo do accordion:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    setData(prev => ({
      ...prev,
      fieldOptions: {},
      preset: options?.presets[0]?.id ?? prev.preset,
    }));
  }}
  disabled={Object.keys(data.fieldOptions).length === 0}
>
  <RotateCcw /> Restaurar padroes
</Button>
```

- So aparece habilitado quando ha overrides (`fieldOptions !== {}`)
- Reseta `fieldOptions` para `{}` e volta o preset ao primeiro da lista

## 7. Comportamento do Preset Exclusivo (`noProcessing`)

### Definicao de `exclusive: true`

`exclusive: true` significa **substituicao completa** de `fieldOptions`. Ao selecionar um preset com `exclusive: true`:

1. `fieldOptions` eh substituido integralmente por `{ ...preset.values }` (nao faz merge)
2. Todos os controles dos outros grupos recebem `disabled={true}`
3. O accordion continua funcional (expandir/recolher) — apenas os controles ficam desabilitados
4. Campos ficam com aparencia `opacity-50 cursor-not-allowed`

Se no futuro um preset exclusivo precisar manter alguns campos, seria necessario um novo campo `exclusiveKeep: string[]` — fora de escopo atual.

### Comportamento ao deselecionar

Ao trocar de `noProcessing` para qualquer outro preset (ou "Personalizado" manualmente):
- Campos voltam ao normal (`disabled={false}`)
- Os valores do novo preset sao aplicados

### O campo `noProcessing` em si

O switch `noProcessing` dentro do grupo `processing` permanece sempre interativo, mesmo quando o preset "Sem Processamento" esta ativo. Isso permite que o usuario desligue a flag manualmente, saindo do modo exclusivo.

## 8. Integracao no Envio (`finish()`)

O `finish()` envia `options: data.fieldOptions` — apenas overrides. Nenhuma alteracao necessaria no codigo de envio.

Exemplos de payload:
- Nenhum campo alterado: `options: {}`
- Preset Manga selecionado: `options: { mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'upscale' }`
- Preset Manga + gamma ajustado: `options: { mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'upscale', gamma: 2.0 }`
- noProcessing: `options: { noProcessing: true }`
- Personalizado com alguns ajustes: `options: { jpegQuality: 75, forceColor: true }`

## 9. Estrategia de Performance

Com 35 campos re-renderizando no wizard, a estrategia de memoizacao eh essencial:

### 9.1 Componentes memoizados

```tsx
const ConversionFieldRenderer = React.memo(function ConversionFieldRenderer(
  props: ConversionFieldRendererProps
) {
  // ...
}, (prev, next) => {
  return prev.field.id === next.field.id
    && prev.value === next.value
    && prev.disabled === next.disabled;
});
```

### 9.2 Callbacks estaveis

```tsx
// useCallback para evitar recriacao de funcoes a cada render
const handleFieldChange = useCallback((id: string, value: string | number | boolean) => {
  setData(prev => ({
    ...prev,
    fieldOptions: { ...prev.fieldOptions, [id]: value },
  }));
}, []);
```

### 9.3 Valores derivados memoizados

```tsx
// Agrupamento de fields — recalculado apenas quando options muda
const groupedFields = useMemo(() => {
  if (!options?.fields) return {} as Record<string, ConversionField[]>;
  const groups: Record<string, ConversionField[]> = {};
  for (const field of options.fields) {
    (groups[field.group] ??= []).push(field);
  }
  return groups;
}, [options?.fields]);

// Estado efetivo normalizado — recalculado quando fieldOptions muda
const effectiveState = useMemo(() => {
  if (!options?.fields) return {};
  return buildEffectiveState(options.fields, data.fieldOptions);
}, [data.fieldOptions, options?.fields]);

// Deteccao de preset ativo
const activePresetId = useMemo(() => {
  if (!options?.presets) return null;
  for (const preset of options.presets) {
    if (isPresetMatch(effectiveState, preset)) return preset.id;
  }
  return null;
}, [effectiveState, options?.presets]);

// Flag noProcessing
const isNoProcessing = data.fieldOptions.noProcessing === true;
```

### 9.4 Subcategorias do grupo `image`

As subcategorias sao definidas como constante estatica (nao derivada do backend):

```ts
const IMAGE_SUBCATEGORIES = [
  {
    label: 'Cor e Contraste',
    fieldIds: ['gamma', 'forceColor', 'autolevel', 'colorAutocontrast', 'noAutocontrast', 'eraseRainbow'],
  },
  {
    label: 'Qualidade e Formato',
    fieldIds: ['jpegQuality', 'forcePng', 'webp', 'mozjpeg', 'noQuantize'],
  },
  {
    label: 'Bordas e Recorte',
    fieldIds: ['blackBorders', 'whiteBorders', 'croppingPower', 'croppingMinimum'],
  },
] as const;
```

## 10. Decisoes

### D1. Accordion vs Tabs vs Grid unico
**Decisao:** Accordion (Radix `Accordion` com `type="multiple"`).
**Rationale:** Accordion permite ver multiplos grupos simultaneamente (expandindo os desejados), mantem a pagina com scroll gerenciável (grupos colapsados ocupam 1 linha), e ja existe componente shadcn/ui maduro. Tabs forcam ver 1 grupo por vez; grid unico sobrecarrega com 35 campos visiveis.

### D2. "Personalizado" como estado derivado, sem preset fake
**Decisao:** `activePresetId === null` → Select mostra "Personalizado" como display value. Nenhuma opcao fake injetada no dropdown.
**Rationale:** Manter o dropdown de presets puro (apenas os 5 do backend) simplifica a logica — "Personalizado" eh apenas um rotulo visual, nao uma opcao selecionavel. O usuario nao precisa "selecionar Personalizado"; ele simplesmente modifica um campo e o rotulo aparece.

### D3. Disabled vs hidden para campos com `noProcessing`
**Decisao:** Disabled (nao hidden).
**Rationale:** Mostrar os campos em disabled comunica ao usuario que existem opcoes disponiveis, mas estao inativas devido ao preset. Esconder os campos poderia fazer o usuario pensar que o wizard esta quebrado ou incompleto.

### D4. Valores default dos campos — fallback visual, nao armazenado
**Decisao:** `fieldOptions` armazena apenas overrides. Renderizador usa `fieldOptions[id] ?? field.default`.
**Rationale:** Mantem o payload enxuto (apenas overrides no POST). A comparacao com presets usa o estado efetivo normalizado (defaults + overrides), que eh montado sob demanda e nunca armazenado.

### D5. `exclusive` = substituicao completa
**Decisao:** Presets com `exclusive: true` substituem `fieldOptions` integralmente (nao fazem merge).
**Rationale:** Corresponde ao comportamento real do KCC: quando `-n` (noProcessing) eh passado, todas as outras flags sao ignoradas. Se no futuro um preset exclusivo precisar manter alguns campos, sera um novo campo `exclusiveKeep`.

### D6. Subcategorias estaticas para `image`
**Decisao:** Hardcodar as 3 subcategorias no frontend (Cor e Contraste, Qualidade e Formato, Bordas e Recorte).
**Rationale:** Sao agrupamentos semanticos estaveis. Se o backend adicionar novos campos no grupo `image`, eles apareceriam em uma secao "Outros" ao final. O ideal futuro seria o backend expor `field.subcategory`, mas isso requer mudanca na API.

## 11. Riscos e Trade-offs

| Risco | Mitigacao |
|-------|-----------|
| 35 campos podem intimidar usuarios novos | Accordion com grupos `reading`/`processing` expandidos e `image`/`output`/`format` colapsados por padrao; subcategorias em `image`; tooltips com `field.help` |
| Sliders sem feedback visual adequado | Exibir valor numerico ao lado do slider + badge com range |
| Sincronizacao preset↔campos pode ter bugs de loop | Estado unidirecional: preset → fieldOptions; campos → fieldOptions. `activePresetId` eh derivado, nao armazenado. Sem loops possiveis. |
| Performance com 35 campos re-renderizando | `React.memo` com comparador customizado, `useCallback` para handlers, `useMemo` para valores derivados |
| Backend adiciona novo `field.group` desconhecido | Grupo aparece com label = groupId (fallback) e icone generico. Nao quebra. |
| Backend retorna `presets: []` (vazio) | Dropdown de preset fica vazio, mas campos individuais continuam funcionais. `activePresetId` permanece `null`. |
| Backend envia campo com `type`/`component` desconhecido | `ConversionFieldRenderer` renderiza fallback "Tipo nao suportado" — nao quebra a pagina. |
| Campo sem `default` definido | Tratado como `undefined` — switch fica off, select sem selecao, slider no min, input vazio. |
| `customWidth`/`customHeight` com valor `0` | Exibir help text informando que `0` = usar resolucao do dispositivo |

## 12. Diagrama de Estado

```
┌──────────────┐    select preset    ┌──────────────────┐
│  Sem preset  │ ──────────────────► │  Preset ativo     │
│  (defaults)  │                     │  (ex: Manga)      │
└──────────────┘                     └─────────┬─────────┘
      │                                        │
      │                                modify field
      │  ┌─────────────────────────┐          │
      │  │  Reset (Restaurar)       │◄─────────┘
      │  │  fieldOptions = {}      │
      │  └─────────────────────────┘
      │                                        │
      │                                ┌───────▼─────────┐
      └───────────────────────────────►│  Personalizado   │
              activePresetId = null    │  (diverge)       │
                                       └──────────────────┘
                                                │
                                       select preset again
                                                │
                                       ┌────────▼─────────┐
                                       │  Preset ativo     │
                                       │  (ex: Webtoon)   │
                                       └──────────────────┘

┌──────────────────┐   select preset    ┌──────────────────┐
│  Qualquer estado │ ──────────────────►│  noProcessing    │
│  (com fields)    │                    │  (exclusive)     │
└──────────────────┘                    │  substitui tudo  │
                                        │  disabled all    │
                                        └──────────────────┘
```

## 13. Grupos de Campos — Resumo

| Grupo | # Campos | Default expandido? | Icone | Subcategorias? |
|-------|----------|-------------------|-------|---------------|
| `reading` | 6 | Sim | BookOpen | Nao |
| `processing` | 8 | Sim | Cog | Nao |
| `image` | 15 | Nao | Image | Sim (3) |
| `output` | 12 | Nao | FileOutput | Nao |
| `format` | 1 | Nao | FileType | Nao |

