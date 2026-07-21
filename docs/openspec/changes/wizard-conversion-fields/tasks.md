# Wizard Conversion Fields — Tasks

> **Status:** COMPLETED
> **Data:** 2026-07-20 (rev. 2026-07-21)

---

## 1. Tipos e Constantes (Pre-requisito)

- [x] 1.1 Adicionar `FieldGroupId` type, `FieldGroupLabelMap`, e `IMAGE_SUBCATEGORIES` constante em `src/types/conversion.ts`
- [x] 1.2 Adicionar tipo `ConversionFieldGroup` no arquivo de tipos (se necessario alem do agrupamento inline)

---

## 2. Componente `ConversionFieldRenderer` (Novo)

**Arquivo:** `apps/frontend/src/components/wizard/ConversionFieldRenderer.tsx`

- [x] 2.1 Criar componente `ConversionFieldRenderer` com props: `{ field, value, onChange, disabled }`
- [x] 2.2 Renderizar switch (`type=boolean, component=switch`) usando `<Switch>` + `<Label>` do shadcn
- [x] 2.3 Renderizar select (`type=enum, component=select`) usando `<Select>` do shadcn, mapeando `field.options`
- [x] 2.4 Renderizar slider (`type=number, component=slider`) usando `<Slider>` do shadcn, com `min`, `max`, `step` e valor numerico visivel em badge
- [x] 2.5 Renderizar input (`type=number, component=input`) usando `<Input type="number">` do shadcn, com validacao:
  - Rejeitar NaN: reverter ao valor anterior (ou `field.default`) se `isNaN(parsed)`
  - Clamp ao range `[min, max]` no evento `blur`
  - `step` nativo do HTML (`<input step={field.step}>`)
- [x] 2.6 Renderizar fallback para tipo/componente desconhecido: exibir "Tipo nao suportado: {type}/{component}" em card com borda dashed — nao quebrar a pagina
- [x] 2.7 Exibir `field.description` abaixo do label e `field.help` como texto secundario (`text-xs opacity-50 italic`)
- [x] 2.8 Aplicar estilo `disabled` (opacity-50, cursor-not-allowed, pointer-events-none) quando `disabled=true`
- [x] 2.9 Adicionar `React.memo` com comparador customizado: re-renderiza apenas se `field.id`, `value` ou `disabled` mudaram
- [x] 2.10 Adicionar acessibilidade: `aria-label={field.label}`, `aria-describedby={field.id + '-help'}`, label clicavel foca o controle
- [x] 2.11 Adicionar `data-testid="conversion-field-{field.id}"` para facilitar testes

---

## 3. Componente `ConversionFieldGroup` (Novo)

**Arquivo:** `apps/frontend/src/components/wizard/ConversionFieldGroup.tsx`

- [x] 3.1 Criar componente `ConversionFieldGroup` com props: `{ groupId, groupLabel, fields, values, onChange, disabled, defaultExpanded }`
- [x] 3.2 Renderizar `<Accordion type="multiple">` com `<AccordionItem>` por grupo
- [x] 3.3 Usar `defaultValue` no Accordion baseado em `defaultExpanded`
- [x] 3.4 Renderizar `AccordionTrigger` com icone do grupo (lucide-react) + label + badge com contagem de campos
- [x] 3.5 Para grupos sem subcategorias: renderizar `AccordionContent` com `<ConversionFieldRenderer>` para cada campo
- [x] 3.6 Para o grupo `image`: renderizar subcategorias com `<Separator>` + label em negrito, campos agrupados por `IMAGE_SUBCATEGORIES`
- [x] 3.7 Mapear icones por grupo: `reading` → `BookOpen`, `processing` → `Cog`, `image` → `Image`, `output` → `FileOutput`, `format` → `FileType`
- [x] 3.8 Aplicar estilo comic-pop-art consistente (bordas `border-ink`, sombras `shadow-comic-sm`, fonte `font-display` nos titulos)
- [x] 3.9 Acessibilidade do accordion: foco move-se para o primeiro campo ao expandir grupo (usar `onValueChange` + `ref.focus()`)
- [x] 3.10 Adicionar `data-testid="conversion-group-{groupId}"` para facilitar testes

---

## 4. Integracao no `StepConvert` (`wizard.tsx`)

**Arquivo:** `apps/frontend/src/routes/wizard.tsx`

- [x] 4.1 Importar `ConversionFieldGroup`, `ConversionFieldRenderer`, `IMAGE_SUBCATEGORIES`
- [x] 4.2 Agrupar `options.fields` por `group` usando `useMemo` — criar mapa `Record<string, ConversionField[]>`
- [x] 4.3 Implementar `buildEffectiveState(fields, fieldOptions)` — retorna defaults + overrides
- [x] 4.4 Implementar `isPresetMatch(effectiveState, preset)` — verifica se TODAS as chaves do preset batem no estado efetivo
- [x] 4.5 Implementar `activePresetId` via `useMemo` — `null` quando nenhum preset bate (="Personalizado")
- [x] 4.6 Implementar `handlePresetChange(presetId)`:
  - Se `preset.exclusive`: substituicao completa `fieldOptions = { ...preset.values }`
  - Senao: merge `fieldOptions = { ...prev, ...preset.values }`
  - `presetId === ""` (Personalizado): nao faz nada (mantem valores)
- [x] 4.7 Implementar `handleFieldChange(id, value)` com `useCallback` — atualiza `data.fieldOptions`
- [x] 4.8 Modificar preset `<Select>`: mostrar "Personalizado" como display value quando `value=""`, sem injetar opcao fake
- [x] 4.9 Implementar botao "Restaurar padroes":
  - Reseta `fieldOptions = {}` e `preset` para o primeiro da lista
  - So habilitado quando `Object.keys(fieldOptions).length > 0`
- [x] 4.10 Calcular `isNoProcessing = data.fieldOptions.noProcessing === true`
- [x] 4.11 Passar `disabled={isNoProcessing}` para todos os `ConversionFieldGroup`
- [x] 4.12 Renderizar 5 `ConversionFieldGroup` apos os controles existentes (dispositivo, formato, preset, reset) — antes do preview mock
- [x] 4.13 Configurar `defaultExpanded`: `reading=true`, `processing=true`, demais `false`
- [x] 4.14 Garantir que `finish()` envia `options: data.fieldOptions` (ja funciona — apenas verificar)

---

## 5. Testes

- [x] 5.1 Teste unitario de `ConversionFieldRenderer`:
  - Renderiza switch para campo boolean com label e descricao
  - Renderiza select com opcoes para campo enum
  - Renderiza slider com limites para campo number/slider
  - Renderiza input numerico para campo number/input
  - Chama `onChange` com valor correto ao interagir
  - Exibe estado disabled com classes corretas
  - Exibe fallback para type/component desconhecido
  - Rejeita NaN no input numerico (reverte ao valor anterior)
  - Clampa valor no blur para [min, max]
  - Nao re-renderiza quando props nao mudaram (`React.memo`)
- [x] 5.2 Teste unitario de `ConversionFieldGroup`:
  - Renderiza accordion com label e badge de contagem
  - Expande/colapsa ao clicar no trigger
  - Expande grupos com `defaultExpanded=true` por padrao
  - Renderiza `ConversionFieldRenderer` para cada campo
  - Grupo `image` renderiza subcategorias com separadores
  - Foco move-se para primeiro campo ao expandir
- [x] 5.3 Teste de integracao: logica de preset no `StepConvert`:
  - `fieldOptions = {}`, preset Manga selecionado → `fieldOptions = { mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'upscale' }`
  - `fieldOptions = { mangaMode: true, gamma: 2.0 }` com preset Manga → `activePresetId === "manga"` (gamma extra nao quebra match)
  - Modifica `stretchMode` → `activePresetId === null` (Personalizado)
  - Restaura `stretchMode` ao valor do preset → `activePresetId === "manga"` novamente
  - Preset exclusivo: `noProcessing` → `fieldOptions = { noProcessing: true }` (substituicao completa), outros campos disabled
  - Troca de Manga → Webtoon → Manga: cada transicao mantem integridade dos valores
  - Sequencia rapida: preset → campo → preset → campo (sem race conditions)
  - Reset: `fieldOptions` com varios valores → botao Reset → `fieldOptions = {}`
- [x] 5.4 Testes de borda:
  - Backend retorna `presets: []` → wizard funciona, campos individuais disponiveis
  - Backend adiciona novo grupo (`field.group = "advanced"`) → renderiza com fallback (label = groupId, icone generico)
  - Backend envia campo com `type: "color"` (desconhecido) → renderiza fallback, nao quebra
  - Campo sem `default` → switch off, select sem selecao, slider no min, input vazio
- [x] 5.5 Atualizar teste de `useConversionOptions.test.tsx` para incluir `fields` e `presets` no mock

---

## 6. Validacao e Polish

- [x] 6.1 Rodar `pnpm lint` e `pnpm typecheck` no frontend — zero erros
- [x] 6.2 Verificar responsividade: campos devem se reorganizar em telas menores (stack vertical)
- [x] 6.3 Verificar consistencia visual com o resto do wizard (cores, fontes, sombras)
- [x] 6.4 Testar navegacao por teclado: Tab entre campos, Arrow keys no accordion, Enter/Space para interagir
- [x] 6.5 Teste manual E2E: fluxo completo wizard → selecionar preset → modificar campos → reset → novo preset → enviar → verificar no backend se `options` chegou correto
- [x] 6.6 Teste manual: abrir wizard, nao mexer em nada, enviar → `options: {}` (sem erros no backend)

---

## Ordem de Implementacao

```
1. Tipos e Constantes (1.1–1.2)
       │
2. ConversionFieldRenderer (2.1–2.11)
       │
3. ConversionFieldGroup (3.1–3.10)
       │
4. Integracao no StepConvert (4.1–4.14)
       │
5. Testes (5.1–5.5)
       │
6. Validacao e Polish (6.1–6.6)
```
