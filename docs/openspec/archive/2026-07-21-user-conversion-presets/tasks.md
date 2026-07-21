# User Conversion Presets — Tasks

> **Status:** IMPLEMENTED
> **Data:** 2026-07-21

---

## 1. Backend: Modelo e Migracao

- [x] 1.1 Adicionar modelo `UserPreset` no `schema.prisma` (ver design secao 4.1)
- [x] 1.2 Adicionar relacao `userPresets UserPreset[]` no modelo `User`
- [x] 1.3 Gerar e executar migracao Prisma (`npx prisma migrate dev --name add_user_presets`)
- [x] 1.4 Adicionar tipos `UserPreset` e `UserPresetResponse` em `conversion.types.ts`

---

## 2. Backend: DTOs e Validacao

- [x] 2.1 Criar `user-preset.dto.ts` com schemas Zod:
  - `createUserPresetSchema`: name (1-100), description (0-500), values (Record), isDefault (bool)
  - `updateUserPresetSchema`: name, description, isDefault (todos opcionais)
  - `updateUserPresetValuesSchema`: values (Record, obrigatorio)
- [x] 2.2 Validar que `values` nao excede total de campos do catalogo

---

## 3. Backend: Repository

**Arquivo:** `apps/backend/src/modules/conversion/repositories/user-preset.repository.ts`

- [x] 3.1 `findAllByUserId(userId): Promise<UserPreset[]>`
- [x] 3.2 `findById(presetId, userId): Promise<UserPreset | null>` (com filtro de ownership)
- [x] 3.3 `create(data): Promise<UserPreset>` — verificar limite configuravel
- [x] 3.4 `updateMeta(presetId, userId, data): Promise<UserPreset>` — nome, descricao, isDefault
- [x] 3.5 `updateValues(presetId, userId, values): Promise<UserPreset>` — atualizar valores
- [x] 3.6 `delete(presetId, userId): Promise<void>`
- [x] 3.7 `toggleDefault(presetId, userId): Promise<void>` — transacao para desmarcar anterior
- [x] 3.8 `incrementUsage(presetId): Promise<void>` — fire-and-forget
- [x] 3.9 `touchLastUsed(presetId): Promise<void>` — fire-and-forget

---

## 4. Backend: Use-Cases

**Arquivo:** `apps/backend/src/modules/conversion/use-cases/user-presets.use-case.ts`

- [x] 4.1 `ListUserPresets`: retorna lista de presets do usuario
- [x] 4.2 `CreateUserPreset`: valida limite (configuravel), nome unico, cria preset
- [x] 4.3 `UpdateUserPresetMeta`: valida ownership, atualiza nome/descricao/isDefault
- [x] 4.4 `UpdateUserPresetValues`: valida ownership, atualiza valores
- [x] 4.5 `DeleteUserPreset`: valida ownership, exclui preset

---

## 5. Backend: Controller e Rotas

- [x] 5.1 Criar `user-presets.controller.ts` com handlers para GET/POST/PATCH/PUT/DELETE
- [x] 5.2 Registrar rotas em `conversion.routes.ts` sob `/api/conversions/presets` (com auth middleware)
- [x] 5.3 HTTP responses: 201 (create), 200 (update), 204 (delete), 400 (validacao/limite), 403 (ownership), 404 (not found), 409 (duplicado)

---

## 6. Backend: Testes

- [x] 6.1 Testes unitarios dos use-cases:
  - Cria preset com sucesso
  - Rejeita criacao quando limite atingido
  - Rejeita nome duplicado por usuario
  - Atualiza nome/descricao
  - Atualiza valores de preset existente
  - Toggle isDefault desmarca anterior em transacao
  - Exclui preset
  - Rejeita operacao em preset de outro usuario (ownership)
- [x] 6.2 Testes E2E das rotas:
  - POST cria preset, GET retorna na lista
  - PATCH atualiza nome
  - PUT /values atualiza valores
  - DELETE remove preset
  - POST com nome duplicado retorna 409
  - POST acima do limite retorna 400
  - PATCH/PUT/DELETE em preset de outro usuario retorna 403

---

## 7. Frontend: Tipos e Hook

- [x] 7.1 Criar tipo `UserPresetResponse` no frontend (em `types/conversion.ts`)
- [x] 7.2 Criar hook `useUserPresets` com:
  - Query: `GET /api/conversions/presets`
  - `create()` — POST + invalidar cache
  - `updateMeta()` — PATCH + invalidar cache
  - `updateValues()` — PUT + invalidar cache
  - `remove()` — DELETE + invalidar cache
  - `toggleDefault()` — PATCH + invalidar cache
  - `isAtLimit` — derivado de `presets.length >= limit`

---

## 8. Frontend: `SavePresetDialog` (Novo)

**Arquivo:** `apps/frontend/src/components/wizard/SavePresetDialog.tsx`

- [x] 8.1 Dialog com campos: nome (obrigatorio), descricao (opcional), checkbox isDefault
- [x] 8.2 Exibir resumo das configuracoes incluidas (`fieldOptions` keys/values)
- [x] 8.3 Validacao inline: nome vazio, nome duplicado (checado contra lista existente)
- [x] 8.4 Loading state no botao "Salvar" durante request
- [x] 8.5 Modo "editar": pre-preenche nome e descricao do preset existente
- [x] 8.6 Fechar dialog e limpar form ao salvar com sucesso
- [x] 8.7 Estilo comic-pop-art consistente

---

## 9. Frontend: `PresetSelector` (Novo)

**Arquivo:** `apps/frontend/src/components/wizard/PresetSelector.tsx`

- [x] 9.1 Dropdown com 2 secoes separadas por `<Separator>`: "Presets do sistema" e "Meus presets"
- [x] 9.2 Icones de acao inline nos user presets: editar (pencil), excluir (trash), favorito (star)
- [x] 9.3 Botao "+ Salvar como preset" no footer do dropdown
- [x] 9.4 Mensagem "Limite atingido" quando `isAtLimit`
- [x] 9.5 Exibir "Personalizado" quando `activePresetId === null`
- [x] 9.6 "Nenhum preset salvo" quando `userPresets.length === 0`
- [x] 9.7 Confirmacao de exclusao via dialog

---

## 10. Frontend: Integracao no `StepConvert`

- [x] 10.1 Substituir `<Select>` de preset pelo novo `<PresetSelector>`
- [x] 10.2 Carregar `useUserPresets()` em paralelo com `useConversionOptions()`
- [x] 10.3 Atualizar deteccao de `activePresetId` para checar user presets primeiro, sistema depois
- [x] 10.4 Adicionar `activePresetSource: 'system' | 'user' | null` ao estado derivado
- [x] 10.5 Pre-selecionar preset com `isDefault: true` ao abrir step 4
- [x] 10.6 Implementar fluxo "Atualizar preset" vs "Salvar como novo" (split button quando activePresetSource === 'user' e houve divergencia)
- [x] 10.7 Comportamento ao excluir preset ativo: manter fieldOptions, voltar para "Personalizado"

---

## 11. Frontend: Testes

- [ ] 11.1 Teste unitario de `SavePresetDialog`:
  - Valida nome obrigatorio
  - Rejeita nome duplicado com feedback inline
  - Exibe resumo de fieldOptions
  - Chama onSave com dados corretos
  - Modo editar pre-preenche campos
- [ ] 11.2 Teste unitario de `PresetSelector`:
  - Renderiza secoes separadas (sistema vs usuario)
  - Mostra icones de acao apenas em user presets
  - Mostra "Personalizado" quando activePresetId === null
  - Mostra "+ Salvar como preset" quando canSaveAsPreset
  - Esconde botao quando isAtLimit
  - Mostra "Nenhum preset salvo" quando vazio
- [ ] 11.3 Teste de integracao:
  - Criar preset → aparece no dropdown
  - Selecionar user preset → preenche fieldOptions
  - Modificar campo com user preset ativo → mostra "Atualizar" ou "Salvar como novo"
  - "Atualizar" → PUT /values → preset atualizado
  - Excluir preset ativo → "Personalizado" mas fieldOptions mantem valores
  - Marcar como default → pre-selecionado ao recarregar

---

## 12. Validacao e Polish

- [x] 12.1 `pnpm lint` e `pnpm typecheck` em frontend e backend — zero erros
- [ ] 12.2 Teste manual E2E: criar preset → usar → modificar → atualizar → excluir → converter
- [ ] 12.3 Verificar que presets persistem entre sessoes (recarregar pagina)
- [ ] 12.4 Verificar que exclusao de usuario cascateia para presets
- [ ] 12.5 Verificar responsividade do dropdown e dialog em telas menores

---

## Ordem de Implementacao

```
1.  Modelo e Migracao (1.1–1.4)
        │
2.  DTOs e Validacao (2.1–2.2)
        │
3.  Repository (3.1–3.9)
        │
4.  Use-Cases (4.1–4.5)
        │
5.  Controller e Rotas (5.1–5.3)
        │
6.  Testes Backend (6.1–6.2)
        │
7.  Tipos e Hook Frontend (7.1–7.2)
        │
8.  SavePresetDialog (8.1–8.7)
        │
9.  PresetSelector (9.1–9.7)
        │
10. Integracao StepConvert (10.1–10.7)
        │
11. Testes Frontend (11.1–11.3)
        │
12. Validacao e Polish (12.1–12.5)
```
