# User Conversion Presets — Proposta

> **Status:** DRAFT
> **Data:** 2026-07-21
> **Modulo:** backend/conversion + frontend/wizard
> **Depende de:** `wizard-conversion-fields` (change anterior)

---

## 1. Problema / Why

Os presets de conversao disponiveis no wizard sao fixos (5 presets do sistema: Manga, Webtoon, HQ Ocidental, Alta Qualidade, Sem Processamento). Quando o usuario encontra uma combinacao ideal de campos — por exemplo, modo manga + gamma 2.0 + JPEG quality 85 — ele **nao consegue salvar** essa configuracao para reutilizar em futuras conversoes. Toda vez precisa reconfigurar manualmente os mesmos campos.

Essa limitacao eh especialmente frustrante para usuarios que convertem regularmente com as mesmas configuracoes ajustadas.

## 2. Solucao Proposta / What Changes

O usuario pode **criar, editar, atualizar valores e excluir** seus proprios presets de configuracao. Presets do usuario sao salvos no banco via API dedicada e aparecem no dropdown do wizard junto com (mas separados de) os presets do sistema.

### Mudancas principais:

- **Novo modelo `UserPreset`** no Prisma: armazena `userId`, `name`, `description`, `values` (JSON), flag `isDefault`, `lastUsedAt` e `usageCount` para ordenacao futura.
- **Novo endpoint dedicado** `GET/POST/PATCH/PUT/DELETE /api/conversions/presets` — separado do catalogo de opcoes (`/api/conversions/options`).
- **`GET /api/conversions/options` inalterado**: continua retornando `presets` (do sistema). Presets do usuario vem de endpoint proprio.
- **Frontend carrega em paralelo**: `Promise.all([getConversionOptions(), getUserPresets()])`.
- **UI: dropdown com secoes separadas** ("Presets do sistema" e "Meus presets") com acoes inline.
- **UI: botao "Salvar como preset"** quando o usuario tem configuracao personalizada.
- **Fluxo de atualizacao de valores**: ao modificar campos com um preset do usuario selecionado, o sistema oferece "Atualizar preset existente" ou "Salvar como novo".
- **Preset padrao do usuario**: pode marcar um preset como favorito para pre-selecao ao abrir wizard. Cada usuario pode possuir no maximo um preset marcado como padrao; ao marcar um novo, o anterior perde a flag.
- **Limite configuravel** de presets por usuario (nao hardcoded na spec).

### Arquivos afetados:

| Arquivo | Acao |
|---------|------|
| `apps/backend/prisma/schema.prisma` | **Modificar** — adicionar modelo `UserPreset` |
| `apps/backend/src/modules/conversion/types/conversion.types.ts` | **Modificar** — adicionar tipos `UserPreset`, `UserPresetResponse` |
| `apps/backend/src/modules/conversion/dtos/user-preset.dto.ts` | **Novo** — schemas Zod |
| `apps/backend/src/modules/conversion/repositories/user-preset.repository.ts` | **Novo** — repositorio Prisma |
| `apps/backend/src/modules/conversion/use-cases/user-presets.use-case.ts` | **Novo** — use-cases CRUD |
| `apps/backend/src/modules/conversion/controllers/user-presets.controller.ts` | **Novo** — controller |
| `apps/backend/src/modules/conversion/conversion.routes.ts` | **Modificar** — registrar rotas |
| `apps/frontend/src/hooks/useUserPresets.ts` | **Novo** — hook para CRUD via API |
| `apps/frontend/src/components/wizard/PresetSelector.tsx` | **Novo** — dropdown com secoes |
| `apps/frontend/src/components/wizard/SavePresetDialog.tsx` | **Novo** — dialog criar/editar/atualizar |
| `apps/frontend/src/routes/wizard.tsx` | **Modificar** — integrar presets do usuario |
| `apps/frontend/src/types/conversion.ts` | **Modificar** — tipos do user preset |

## 3. Fluxo Completo

```
Usuario abre Step 4 (change anterior ja renderiza 35 campos)
  → Promise.all([
      GET /api/conversions/options  → catalogo (fields, presets do sistema),
      GET /api/conversions/presets  → presets do usuario
    ])
  → Dropdown mostra: 5 presets do sistema + N presets do usuario
  → Se usuario tem preset com isDefault: true → pre-seleciona e aplica valores

Usuario configura campos manualmente (estado "Personalizado")
  → Botao "Salvar como preset" aparece
  → Clica → Dialog abre com nome (obrigatorio) e descricao (opcional)
  → POST /api/conversions/presets { name: "Meu Kindle", values: {...} }
  → Preset aparece no dropdown em "Meus presets"

Usuario seleciona seu preset "Meu Kindle"
  → fieldOptions = { ...preset.values }
  → Campos refletem a configuracao salva
  → lastUsedAt atualizado no backend (background, nao bloqueia UI)

Usuario modifica gamma enquanto preset "Meu Kindle" esta selecionado
  → Dropdown muda para "Personalizado"
  → Botao split aparece: "Atualizar Meu Kindle" | "Salvar como novo"
  → Se "Atualizar": PUT /api/conversions/presets/:id { values: {...} }
  → Se "Salvar como novo": abre dialog para criar novo preset

Usuario exclui preset "Meu Kindle"
  → Dialog de confirmacao
  → DELETE /api/conversions/presets/:id
  → Se era o preset ativo: volta para "Personalizado" (fieldOptions mantem valores atuais)
  → Preset some do dropdown
```

## 4. Escopo / Capabilities

### Incluido:
- [x] Modelo `UserPreset` no banco com persistencia PostgreSQL
- [x] CRUD completo via API REST (criar, listar, atualizar metadados, atualizar valores, excluir)
- [x] Endpoint dedicado `GET /api/conversions/presets` — separado do catalogo
- [x] Dropdown com secoes separadas (sistema vs usuario) e acoes inline (editar, excluir, favoritar)
- [x] Botao "Salvar como preset" quando estado = "Personalizado"
- [x] Dialog de criacao com nome (obrigatorio, unico por usuario) e descricao (opcional)
- [x] Fluxo "Atualizar preset existente" vs "Salvar como novo" ao modificar campos com user preset ativo
- [x] Preset padrao: pre-selecao ao abrir wizard, unicidade por usuario
- [x] Limite configuravel de presets por usuario (imposto pelo backend)
- [x] Campos `lastUsedAt` e `usageCount` para ordenacao futura
- [x] Validacao de nome unico por usuario (backend + feedback inline)
- [x] Comportamento ao excluir preset ativo: volta para "Personalizado"
- [x] Presets do usuario nunca sao `exclusive` (reservado para sistema)

### Fora de Escopo (futuro):
- [ ] Exportar/importar presets (JSON)
- [ ] Compartilhar presets entre usuarios
- [ ] Ordenacao por "Mais usados" ou "Recentes" (campos ja existem, UI futura)
- [ ] Presets vinculados a dispositivo especifico

## 5. Criterios de Aceitacao

### CRUD
1. O usuario pode criar um preset a partir da configuracao atual.
2. O dialog de criacao exige nome (obrigatorio, unico por usuario) e aceita descricao opcional.
3. O usuario pode editar nome e descricao de seus presets.
4. O usuario pode atualizar os valores de um preset existente (fluxo "Atualizar preset").
5. O usuario pode excluir seus presets com confirmacao.
6. Nomes duplicados sao rejeitados com feedback inline no dialog.
7. O limite configuravel de presets por usuario eh respeitado — botao "Salvar" fica disabled com mensagem ao atingir o limite.

### Dropdown e UX
8. Presets do usuario aparecem em secao separada ("Meus presets" vs "Presets do sistema").
9. Presets do sistema NAO possuem acoes de editar/excluir.
10. Selecionar um preset do usuario preenche os campos da mesma forma que um preset do sistema.
11. Se o usuario modifica campos apos selecionar seu preset, o dropdown muda para "Personalizado".
12. Ao modificar campos com user preset ativo, o sistema oferece "Atualizar" ou "Salvar como novo".

### Preset padrao
13. O usuario pode marcar um preset como padrao para pre-selecao ao abrir wizard.
14. Cada usuario pode possuir no maximo um preset marcado como padrao. Ao marcar um novo, o anterior perde a flag.
15. Se nenhum preset eh padrao, wizard abre com `fieldOptions = {}`.

### Exclusao
16. Ao excluir o preset atualmente selecionado, o estado volta para "Personalizado" (fieldOptions mantem os valores atuais, nao reseta).
17. Ao excluir um preset que NAO esta selecionado, nenhum campo eh alterado.

### Deteccao de preset ativo
18. Na deteccao de `activePresetId`, presets do usuario sao verificados primeiro (prioridade do usuario sobre sistema).
19. Presets do usuario NAO podem ter `exclusive: true`.

## 6. Dependencias

- **Change anterior**: `wizard-conversion-fields` deve estar implementada (renderizacao dos 35 campos + logica de `fieldOptions` + deteccao de "Personalizado").
- Backend: Prisma + PostgreSQL ja configurados.
- Backend: middleware de autenticacao ja existente.
- Frontend: componentes shadcn/ui `Dialog`, `DropdownMenu`, `Separator` ja existentes.
- Nao requer novas dependencias de pacotes.
