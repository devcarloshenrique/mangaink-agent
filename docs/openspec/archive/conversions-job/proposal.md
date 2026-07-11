# Conversion — Proposta

> **Status:** IMPLEMENTED
> **Data:** 2026-07-09 (original) / 2026-07-11 (refatoração)
> **Módulo:** `conversion`

---

## 1. Problema

O MangaInk Agent já possui o módulo de **scraping** que inspeciona obras e retorna metadados (título, autor, capítulos, capas). Porém, ainda não existia o sistema que efetivamente **baixa as imagens** dos capítulos selecionados e **converte** para formatos compatíveis com e-readers (EPUB, MOBI, CBZ, PDF, KFX) utilizando o binário do **KCC** (Kindle Comic Converter).

O frontend possui o wizard de 5 passos e a tela de progresso, mas toda a lógica estava mockada. Precisamos de uma API real que:

1. Exponha todas as opções de conversão disponíveis (dispositivos, formatos, campos configuráveis, presets).
2. Aceite a **intenção do usuário** como entrada — quais livros finais ele deseja obter (`books: [...]`).
3. Execute download + conversão em background via BullMQ (um Job por Book).
4. Reporte progresso granular em tempo real via SSE (um stream por Conversion fazendo fan-in de todos os Jobs).

---

## 2. Solução Proposta

### 2.1. API de Intenção

A API descreve **quais livros o usuário deseja**, não como o KCC deve funcionar:

```
POST /api/conversions
```

O contrato inclui `books: [...]` — cada item representa exatamente um EPUB final. O backend decide automaticamente quantos Jobs criar, quais flags KCC usar e como organizar os diretórios.

Conceitos removidos da API pública: `batchSplit`, `fileFusion`, quantidade de jobs, organização de diretórios — agora responsabilidade exclusiva do **Conversion Planner**.

### 2.2. Catálogo de Opções

```
GET /api/conversions/options
```

Retorna **todas** as configurações disponíveis (exceto `batchSplit`/`fileFusion`) para o frontend montar o formulário dinamicamente: dispositivos, formatos, campos ricos e presets.

### 2.3. Status Agregado

```
GET /api/conversions/:conversionId
```

Status da Conversion computado em tempo real: progresso médio, contadores (`completedJobs`, `runningJobs`, `pendingJobs`, `failedJobs`), lista de Jobs com estado individual.

### 2.4. SSE com Fan-in

```
GET /api/conversions/:conversionId/events
```

Stream SSE que encaminha eventos de **todos os Jobs** da Conversion, com `jobId` em cada `data` para o frontend identificar a origem.

### 2.5. Cancelamento

```
DELETE /api/conversions/:conversionId
POST   /api/conversions/:conversionId/cancel
```

Cancela todos os Jobs ainda pendentes ou em andamento da Conversion.

---

## 3. Fluxo Completo

```
Frontend                              Backend
   │                                    │
   │  GET /api/conversions/options      │
   │───────────────────────────────────►│  Retorna devices, formats, fields, presets
   │◄───────────────────────────────────│
   │                                    │
   │  (Usuário configura wizard)        │
   │                                    │
   │  POST /api/conversions             │
   │  { books: [{title, chapters}...] } │
   │───────────────────────────────────►│  Planner: valida → cria Conversion + N Jobs
   │◄───────────────────────────────────│  { conversionId, totalJobs, status: "queued" }
   │                                    │
   │  GET /conversions/:id/events       │
   │═══════════════════════════════════►│  (SSE fan-in de todos os Jobs)
   │                                    │
   │  ◄── event: job.started ──────────│  { ...data, jobId }
   │  ◄── event: download.progress ────│  (N×, cada com seu jobId)
   │  ◄── event: conversion.progress ──│  (N×, cada com seu jobId)
   │  ◄── event: job.finished ─────────│  { ...data, jobId, downloadUrl }
   │                                    │
   │  GET /conversions/:id              │
   │───────────────────────────────────►│  Estado agregado + lista de Jobs
   │◄───────────────────────────────────│
```

---

## 4. Escopo

### Incluído

- [x] `GET /api/conversions/options` — catálogo (sem batchSplit/fileFusion)
- [x] `POST /api/conversions` — criação de Conversion via Planner (com `books: [...]`)
- [x] `GET /api/conversions/:conversionId` — status agregado auto-sincronizado
- [x] `GET /api/conversions/:conversionId/events` — SSE fan-in de todos os Jobs
- [x] `DELETE /api/conversions/:conversionId` — cancelamento da Conversion
- [x] Conversion Planner (validação, herança de capa, geração de Jobs, flags internas)
- [x] `syncStatus()` — recomputação automática do status.json da Conversion
- [x] Worker BullMQ com download + KCC (um Job por Book)
- [x] Mapeamento completo de flags KCC (sem batchSplit/fileFusion expostos)
- [x] Storage aninhado (`conversions/{convId}/jobs/{jobId}/`)

### Fora de Escopo (futuro)

- [ ] Envio para Kindle via email
- [ ] Preview de página (endpoint `/conversions/preview`)
- [ ] Upload de capas customizadas (referenciável via `cover.kind: "upload"`)
- [ ] Reconversão de volumes existentes
- [ ] Download de EPUB (endpoint `.../jobs/:jobId/download`)
- [ ] Biblioteca (persistência e CRUD de séries)

---

## 5. Critérios de Aceitação

1. `GET /api/conversions/options` retorna todos os perfis KCC, formatos, campos ricos e presets, **sem `batchSplit` e `fileFusion`**.
2. `POST /api/conversions` com `books: [...]` valida a request, gera 1 Job por Book, retorna `conversionId` + `totalJobs` em < 200ms.
3. Jobs com `book.chapters.length >= 2` não acionam `--filefusion` (a flag é sempre `false` — o KCC recebe diretório único).
4. O `status.json` da Conversion reflete corretamente o estado agregado dos Jobs (progresso, contadores, `finishedAt`).
5. O SSE de Conversion emite eventos de todos os Jobs, cada um com `jobId` em `data`.
6. O cancelamento (DELETE) para todos os Jobs pendentes/em andamento.
7. O worker baixa imagens, monta hard links e invoca o KCC com `batchSplit=none, fileFusion=false`.

---

## 6. Dependências

- Módulo `scraping` (já implementado) — fornece `sourceId`, metadados e URLs de capítulos.
- Redis + BullMQ (já configurados) — filas e Pub/Sub.
- Binário KCC (`kcc_c2e_10.3.0.exe`) — disponível em `apps/backend/bin/kcc/windows/` (configurável via env var `KCC_BIN_PATH`).
- HTTP Client (já implementado) — axios com retry para download de imagens.
