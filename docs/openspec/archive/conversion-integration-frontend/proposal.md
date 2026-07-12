# Conversion Integration Frontend — Proposta

> **Status:** DONE
> **Data:** 2026-07-11
> **Módulo:** `frontend` (wizard + progresso)

---

## 1. Problema

O backend já possui todos os endpoints necessários para o fluxo completo de conversão:

- **Scraping:** `POST /api/conversions/source/inspect`, `GET /inspect/:sourceId`, `GET /inspect/:sourceId/events` (SSE), `GET /providers`
- **Conversão:** `GET /api/conversions/options`, `POST /api/conversions`, `GET /:conversionId`, `GET /:conversionId/events` (SSE fan-in), `DELETE /:conversionId`

Porém, o frontend do wizard (`/wizard`) está **inteiramente mockado**:

- `mockFetchSeries()` gera 24 capítulos fictícios em vez de chamar a API de scraping real.
- `useConversion` simula progresso com `setTimeout` em vez de consumir o SSE real.
- `kindle-presets.ts` hardcoda devices/formats/presets que a API já retorna dinamicamente.
- A tela de progresso (`/biblioteca/converter/$jobId`) lê do hook mockado, não da API real.
- Não existe cliente API para scraping ou conversão em `lib/api.ts` — apenas `authApi` e `userApi`.

Precisamos substituir todos os mocks por chamadas reais, conectando o wizard aos 9 endpoints já implementados no backend.

---

## 2. Solução Proposta

### 2.1. Cliente API de Scraping e Conversão

Adicionar `scrapingApi` e `conversionsApi` ao módulo `lib/api.ts`, reutilizando o `request()` existente (com JWT automático) e adicionando suporte a SSE via `EventSource` ou `fetch` streaming.

### 2.2. Hook `useScraping`

Novo hook que encapsula o fluxo de inspeção:
1. `POST /source/inspect` → retorna `{ sourceId, status }`
2. Se `status === "processing"`: conecta ao SSE e acompanha progresso
3. Ao receber `completed`: busca metadados completos via `GET /inspect/:sourceId`
4. Se `status === "ready"` (cache hit 200): busca metadados imediatamente

### 2.3. Hook `useConversionOptions`

Novo hook com TanStack Query para buscar e cachear `GET /api/conversions/options` (endpoint público, não requer auth).

### 2.4. Hook `useConversionProgress`

Novo hook que gerencia o estado de uma conversão em andamento:
1. Busca estado inicial via `GET /:conversionId`
2. Conecta ao SSE `GET /:conversionId/events` para atualizações em tempo real
3. Mapeia eventos SSE para o estado de progresso da UI
4. Permite cancelamento via `DELETE /:conversionId`

### 2.5. Integração por Step

| Step | Atual (mock) | Proposto (real) |
|------|-------------|-----------------|
| 1 — Origem | `mockFetchSeries()` | `useScraping` → `POST /inspect` + SSE + `GET /inspect/:id` |
| 2 — Capítulos | Dados mockados | Capítulos reais do scraping (`id`, `number`, `title`, `pages`, `volume`) |
| 3 — Capas | 3 modos (single/per-volume/per-chapter) + upload | Apenas "uma só capa" (original) — `cover: { kind: "original" }` |
| 4 — Configurações | `kindle-presets.ts` hardcodado | `GET /api/conversions/options` → devices, formats, fields, presets dinâmicos; tempo estimado e preview **mocados** |
| 5 — Envio | Simulação com `setTimeout` | `POST /api/conversions` → redirect para tela de progresso real com SSE |

### 2.6. Tela de Progresso Real

A rota `/biblioteca/converter/$jobId` passa a receber um `conversionId` real e usar `useConversionProgress`:
- Estado agregado: `status`, `progress`, `totalJobs`, `completedJobs`, `failedJobs`, `runningJobs`, `pendingJobs`
- Jobs individuais com progresso próprio
- SSE fan-in atualiza em tempo real
- Cancelamento funcional via `DELETE`
- Botão "Ver na biblioteca" ao concluir (link para `/biblioteca` — sem necessidade de listar o mangá)

---

## 3. Escopo

### Incluído

- [x] `scrapingApi` em `lib/api.ts` — `inspect()`, `getSource()`, `listProviders()`, SSE `inspectEvents()`
- [x] `conversionsApi` em `lib/api.ts` — `getOptions()`, `create()`, `get()`, `cancel()`, SSE `events()`
- [x] Tipos TypeScript espelhando os contratos do backend (`SourceInspectResponse`, `ConversionOptions`, `ConversionState`, `SSEEvent`, etc.)
- [x] Hook `useScraping` — inspeção assíncrona com SSE
- [x] Hook `useConversionOptions` — catálogo de opções (TanStack Query)
- [x] Hook `useConversionProgress` — progresso em tempo real via SSE
- [x] **Step 1**: Substituir `mockFetchSeries` por `useScraping`; exibir apenas total de capítulos (sem contagem de volumes)
- [x] **Step 2**: Usar capítulos reais do scraping; manter agrupamento por volume (fixed/custom)
- [x] **Step 3**: Reduzir para modo "uma só capa" (original); remover per-volume, per-chapter e upload
- [x] **Step 4**: Renderizar fields dinamicamente a partir de `GET /options`; aplicar presets; tempo estimado e preview **mocados**
- [x] **Step 5**: Remover lógica de créditos; "Baixar arquivo" apenas marca opção; "Enviar pro Kindle" **mocado**; tamanho estimado **mocado**
- [x] **Step 5 (Converter)**: Construir `POST /api/conversions` com `books[]` a partir dos capítulos selecionados + agrupamento; redirect para tela de progresso
- [x] **Tela de progresso**: Consumir `GET /:conversionId` + SSE fan-in; mapear eventos para stages; cancelamento real; "Ver na biblioteca" ao final

### Fora de Escopo (futuro)

- [ ] Upload de capas customizadas (rota de upload não existe no backend)
- [ ] Download efetivo do EPUB ao finalizar conversão
- [ ] Envio para Kindle via email (mocado)
- [ ] Preview de página real (endpoint `/conversions/preview` não existe)
- [ ] Tempo estimado real (mocado)
- [ ] Listagem do mangá convertido na biblioteca (apenas o botão "Ver na biblioteca" leva a `/biblioteca`)
- [ ] Reconversão de volumes existentes
- [ ] Persistência de histórico de conversões entre reloads

---

## 4. Critérios de Aceitação

1. **Step 1:** Ao colar uma URL e clicar em "Buscar", o frontend chama `POST /api/conversions/source/inspect`, acompanha via SSE se necessário, e exibe o título da obra + **total de capítulos** (sem menção a volumes).
2. **Step 1:** O `sourceId` retornado pela API é armazenado em estado e usado nos steps subsequentes.
3. **Step 2:** A lista de capítulos exibida contém os dados reais (`id`, `number`, `title`, `pages`) vindos do scraping.
4. **Step 3:** Apenas o modo "uma só capa" está disponível e ativo por padrão, usando `cover: { kind: "original" }`.
5. **Step 4:** Devices, formats, fields e presets são carregados de `GET /api/conversions/options` e renderizados dinamicamente (switch para boolean, select para enum, slider/input para number).
6. **Step 4:** Ao selecionar um preset, seus valores são aplicados aos fields correspondentes.
7. **Step 4:** O tempo estimado e o preview de página permanecem mocados (não chamam a API).
8. **Step 5:** A lógica de créditos (`cost`, `credits`, "Converter (X créditos)") é removida; o botão exibe apenas "Converter".
9. **Step 5:** "Enviar pro Kindle" permanece mocado (não envia email real).
10. **Step 5:** "Baixar arquivo" apenas marca a opção — não inicia download ao finalizar.
11. **Step 5:** O componente de tamanho estimado (`SizeBudget`) permanece mocado.
12. **Step 5:** Ao clicar em "Converter", o frontend constrói o body de `POST /api/conversions` com `books[]` (1 book por volume ou 1 book único), envia à API e redireciona para `/biblioteca/converter/$jobId` com o `conversionId` real.
13. **Tela de progresso:** Conecta ao SSE `GET /:conversionId/events` e atualiza progresso em tempo real (download, conversão, packaging).
14. **Tela de progresso:** Exibe estado agregado (`status`, `progress`, contadores) e estado individual de cada Job.
15. **Tela de progresso:** O botão "Cancelar" chama `DELETE /api/conversions/:conversionId` e atualiza a UI.
16. **Tela de progresso:** Ao concluir (`status: completed`), exibe o botão "Ver na biblioteca" que leva a `/biblioteca`.
17. **Verificação:** O usuário consegue verificar o resultado inspecionando o diretório `storage/conversions/{conversionId}/jobs/` com os EPUBs gerados.

---

## 5. Dependências

- **Backend `scraping`** (já implementado) — fornece `sourceId`, metadados, capítulos e capas.
- **Backend `conversion`** (já implementado) — fornece catálogo de opções, criação de Conversion, status agregado, SSE fan-in e cancelamento.
- **`lib/api.ts`** (já existe) — `request()` com JWT automático; será estendido.
- **TanStack Query** (já configurado) — cache de `GET /options`.
- **Redis + BullMQ** (já no backend) — filas e Pub/Sub para SSE.
