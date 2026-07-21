# Wizard Conversion Fields — Proposta

> **Status:** DRAFT v2
> **Data:** 2026-07-20 (rev. 2026-07-21)
> **Modulo:** frontend/wizard

---

## 1. Problema / Why

O backend expoe **35 campos de configuracao** via `GET /api/conversions/options` (agrupados em `reading`, `processing`, `image`, `output`, `format`), **5 presets** que preenchem valores padrao, e **5 formatos de saida**. Porem, o step 4 do wizard (`StepConvert`) atualmente renderiza apenas:

- Dropdown de dispositivo (funcionando)
- Dropdown de formato (funcionando)
- Dropdown de preset (selecionavel mas **sem efeito nos campos**)
- Inputs de metadados (titulo, autor)
- Estrategia de tratamento de erros
- Preview mock

O array `options.fields` do catalogo do backend **nao eh renderizado**. O `fieldOptions` no `WizardData` eh sempre enviado como `{}`. O usuario nao consegue ajustar nenhuma opcao de processamento de imagem, leitura, saida, etc. — fica completamente dependente do preset (que tambem nao preenche nada).

## 2. Solucao Proposta / What Changes

Renderizar os **35 campos de conversao** no step 4 do wizard, organizados em secoes colapsaveis (accordion) por grupo, com sincronizacao bidirecional entre preset e campos individuais.

### Mudancas principais:

- **Novo componente `ConversionFieldGroup`**: accordion por grupo (`reading`, `processing`, `image`, `output`, `format`) usando `Accordion` do Radix UI. O grupo `image` (15 campos) possui subcategorias visuais internas para melhor organizacao.
- **Novo componente `ConversionFieldRenderer`**: renderiza cada campo conforme `type`/`component` (switch, select, slider, input), usando componentes shadcn/ui ja existentes (`Switch`, `Select`, `Slider`, `Input`). Campos com tipo/componente desconhecidos exibem fallback sem quebrar.
- **Logica de sincronizacao preset ↔ campos**: ao selecionar preset, aplica `preset.values` sobre `fieldOptions`. A deteccao de divergencia usa `deepEqual` entre o estado efetivo normalizado (defaults + overrides) e os valores do preset — evita falsos positivos quando o usuario tem campos extras configurados.
- **Comportamento do preset exclusivo `noProcessing`**: `exclusive: true` significa substituicao completa — limpa todos os campos de `fieldOptions`, mantendo apenas os valores do preset. Todos os outros controles ficam disabled.
- **Reset para defaults**: botao "Restaurar padroes" no topo do accordion que redefine `fieldOptions` para `{}` e volta o preset ao default.
- **Envio de apenas overrides**: `fieldOptions` inicia como `{}` e contem apenas campos que o usuario modificou. O POST envia apenas os overrides; o backend aplica seus proprios defaults para campos ausentes.

### Arquivos afetados:

| Arquivo | Acao |
|---------|------|
| `src/components/wizard/ConversionFieldRenderer.tsx` | **Novo** — renderizador de campo individual com fallback para tipos desconhecidos |
| `src/components/wizard/ConversionFieldGroup.tsx` | **Novo** — accordion de grupo com subcategorias para `image` |
| `src/routes/wizard.tsx` | **Modificar** — integrar accordion no `StepConvert`, logica preset↔fields (deepEqual), botao reset, envio |
| `src/types/conversion.ts` | **Modificar** — adicionar tipos auxiliares (`FieldGroupId`, `FieldGroupLabelMap`) |

## 3. Fluxo Completo

```
Usuario abre Step 4
  → GET /api/conversions/options → catalogo com 35 fields, 5 presets
  → Renderiza: dispositivo, formato, preset + botao "Restaurar padroes" + Accordion com 5 grupos
  → fieldOptions = {} (vazio — overrides apenas)
  → Campos mostram field.default como valor visual quando fieldOptions nao tem a chave

Usuario seleciona preset "Manga"
  → fieldOptions = { mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'upscale' }
  → Campos do accordion refletem os valores do preset
  → Preset dropdown mostra "Manga"

Usuario altera campo "stretchMode" para "stretch"
  → fieldOptions = { mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'stretch' }
  → deepEqual(normalizedState, manga.values) → false (stretchMode diverge)
  → Preset dropdown mostra "Personalizado"

Usuario configura gamma: 2.0 e mantem stretchMode: stretch
  → fieldOptions = { mangaMode: true, cropping: 'marginsAndPageNumbers', stretchMode: 'stretch', gamma: 2.0 }
  → deepEqual(normalizedState, manga.values) → false (gamma extra + stretchMode diverge)
  → Permanece "Personalizado" — sem falso positivo

Usuario clica "Restaurar padroes"
  → fieldOptions = {}
  → Preset volta ao default
  → Todos os campos voltam aos valores default do backend

Usuario seleciona preset "Sem Processamento"
  → fieldOptions = { noProcessing: true } (substituicao completa)
  → Todos os campos dos outros grupos ficam disabled
  → Accordion continua interativo (abrir/fechar), mas controles inativos

Usuario clica "Proximo" → StepDelivery → "Converter"
  → POST /api/conversions { ..., options: fieldOptions }
  → Apenas overrides enviados (ex: { noProcessing: true } ou { mangaMode: true, gamma: 2.0 })
  → Backend aplica defaults para campos ausentes
```

## 4. Escopo / Capabilities

### Incluido:
- [x] Renderizar 35 campos em accordion por grupo (reading, processing, image, output, format)
- [x] Subcategorias visuais no grupo `image` (Cor e Contraste, Qualidade e Formato, Bordas e Recorte)
- [x] `ConversionFieldRenderer` com suporte a switch, select, slider, input + fallback para tipos desconhecidos
- [x] Sincronizacao preset ↔ campos com `deepEqual` sobre estado normalizado (sem falsos positivos)
- [x] Deteccao de preset customizado ("Personalizado") como estado derivado, sem injetar preset fake no dropdown
- [x] Preset `noProcessing`: `exclusive: true` = substituicao completa de `fieldOptions` + disabled nos controles
- [x] Botao "Restaurar padroes" para resetar `fieldOptions` para `{}`
- [x] Validacao de input numerico: rejeita NaN, clamp ao range [min, max] no blur, step respeitado no slider
- [x] Acessibilidade: `aria-label`, `aria-describedby`, navegacao por teclado, foco automatico ao expandir grupo
- [x] Labels, descricoes e help text dos campos exibidos
- [x] Envio de apenas overrides no POST (campos nao modificados sao omitidos)

### Fora de Escopo (futuro):
- [ ] Preview real do backend (manter MockPage atual)
- [ ] Persistencia de fieldOptions entre sessoes do wizard
- [ ] Criacao/edicao de presets customizados pelo usuario → ver change `user-conversion-presets`
- [ ] Override de campos por livro/capitulo
- [ ] Visualizacao de impacto das opcoes no preview mock
- [ ] Metadados de grupo (label, icon, order) virem do backend em vez de hardcoded no frontend

## 5. Criterios de Aceitacao

1. O step 4 exibe accordion com 5 grupos, cada um listando seus campos.
2. Campos switch renderizam como toggle on/off com label e descricao.
3. Campos select renderizam como dropdown com as opcoes do backend.
4. Campos slider renderizam com range, valor numerico e limites min/max.
5. Campos input numerico validam entrada (rejeitam NaN, clamp no blur).
6. Ao selecionar um preset, os campos correspondentes sao preenchidos automaticamente.
7. Ao modificar um campo apos selecionar preset, o dropdown muda para "Personalizado" — sem falso positivo com campos extras.
8. Ao selecionar "Sem Processamento", `fieldOptions` eh completamente substituido e todos os outros campos ficam disabled.
9. Ao clicar "Converter", `options` no body contem apenas os overrides.
10. O accordion pode ser recolhido/expandido sem perder os valores ja configurados.
11. Botao "Restaurar padroes" redefine tudo para o estado inicial.
12. Campos com tipo/componente desconhecido exibem fallback sem quebrar a pagina.
13. Navegacao por teclado funciona em todos os controles do accordion.

## 6. Dependencias

- Backend: `GET /api/conversions/options` ja implementado e estavel.
- Frontend: `useConversionOptions` hook ja implementado.
- Componentes shadcn/ui: `Accordion`, `Switch`, `Select`, `Slider`, `Input`, `Label`, `Separator` ja existentes.
- Nao requer novas dependencias de pacotes.
