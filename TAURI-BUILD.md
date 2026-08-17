# Tauri Build — Correções e Implementação (Migração Electron → Tauri)

> Documentação da task de limpeza total do Electron e rebuild do shell desktop Tauri.
> Data: 2026-08-16 · Escopo: `apps/desktop` (shell desktop) + scripts de build.

## Contexto

O app desktop foi migrado de **Electron** para **Tauri v2** (`apps/desktop/src-tauri`),
porém a geração dos `.exe` falhava e o workspace ainda continha resíduos do Electron
(dependências, código-fonte, configs e artefatos de build) além de um estado misto
npm/pnpm que quebrava a instalação do CLI Tauri.

---

## Problemas encontrados e correções

### 1. CLI `tauri` inacessível (`'tauri' não é reconhecido...`)
- **Causa:** `apps/desktop/node_modules` havia sido criado por **npm** (layout achatado,
  sem `.modules.yaml`), e o bin do `@tauri-apps/cli@2.11.4` **não foi linkado** pelo pnpm —
  o pacote existia só no store (`node_modules/.pnpm`). Todo script que chama `tauri build`/
  `tauri dev` falhava imediatamente.
- **Correção:** remoção do `node_modules` do desktop e re-instalação via `pnpm install`,
  regenerando os bin shims (`apps/desktop/node_modules/.bin/tauri`).

### 2. Erro de long-path no staging dos resources
- **Causa:** `prepare-tauri-resources.mjs` calcula `probeDefault` no staging default
  (`apps/desktop/src-tauri/resources/backend/node_modules/...`) = **241 chars > 240** e
  aborta exigindo `MI_TAURI_RESOURCES_DIR`.
- **Correção:** o staging passa a ser definido por
  `MI_TAURI_RESOURCES_DIR=C:\Users\devca\AppData\Local\Temp\tauri-res` (maxPathLen=192).
  Quando setado, o script gera `src-tauri/tauri.resources.longpath.json` e o
  `tauri-build-config.mjs` roda `tauri build --config <override>`.

### 3. Bloqueio de arquivo em build anterior (`EBUSY`/`os error 32`)
- **Causa:** `apps/desktop/dist/win-unpacked` (resíduo Electron) tinha `resources/app.asar`
  **aberto por outro processo** (Orca.exe → depois explorer.exe/Code.exe), impedindo a
  remoção e a escrita do win-unpacked Tauri no local padrão. Em outra execução, o makensis
  falhou com "arquivo já está sendo usado" por scan transitório do Windows Defender.
- **Correção (permanente):** adicionado override `MI_DIST_DIR` em `build-distributions.mjs`
  para redirecionar a saída sem depender de processos externos; e, para o caso transitório,
  **basta re-executar** o build (o cargo reutiliza o cache compilado).

### 4. Download do kindlegen indisponível (HTTP 503 do web.archive.org)
- **Causa:** snapshot do Wayback Machine do `kindlegen_win32_v2_9.zip` (única fonte desde o
  403 do S3 em 2022) retornou `503 Service Unavailable`.
- **Correção (permanente):** adicionado hook de **cache offline** em `prepare-runtime.mjs` —
  env `MI_RUNTIME_DOWNLOAD_DIR` com o arquivo pré-baixado nomeado pelo basename da URL
  (ex.: `kindlegen_win32_v2_9.zip`). O arquivo é reutilizado e **revalidado por SHA256**
  contra o pin do `runtime-manifest.json`.

---

## Limpeza executada

### Dependências Electron (removidas)
- Do store pnpm: `electron@37`, `electron-builder@26`, `electron-vite@4`,
  `electron-winstaller@5`, `electron-publish`, etc. (`pnpm store prune` removeu 683 pacotes / 2 GB).
- `pnpm-workspace.yaml`: entradas `electron`, `electron-builder`, `electron-winstaller`
  removidas de `allowBuilds`.

### Código-fonte, configs e scripts Electron (removidos)
- `apps/desktop/src/main/`, `apps/desktop/src/preload/`, `apps/desktop/src/tests/`
- `apps/desktop/electron.vite.config.ts`, `electron-builder.yml`
- `apps/desktop/tsconfig.json`, `tsconfig.node.json`, `vitest.config.ts`
- `apps/desktop/scripts/after-pack.mjs`, `run-e2e.mjs`, `generate-icon.mjs`
- `apps/desktop/build/` (ícones Electron — o Tauri usa `src-tauri/icons/`)
- `apps/desktop/package.json` simplificado: removidos `main` (Electron), scripts
  `test`/`test:watch`/`test:e2e`/`icon` e devDeps obsoletas (`playwright`, `png-to-ico`,
  `sharp`, `vitest`, `typescript`, `@types/node`) — ficou apenas `@tauri-apps/cli`.

### Artefatos de build anteriores (removidos)
- `apps/desktop/dist/` (win-unpacked Electron, setups `1.0.0`, blockmaps, `builder-*.yaml`)
- `apps/desktop/out/` (electron-vite)
- `apps/desktop/resources/` (backend/runtime/frontend — regenerado do zero)
- `apps/desktop/src-tauri/target/` (força recompilação Rust)
- `apps/desktop/src-tauri/resources/`, `resources-manifest.json`, `tauri.resources.longpath.json`, `gen/schemas/`
- `package-lock.json` (lockfile **npm** — o projeto usa pnpm; era a causa do `node_modules` misto)

### Temporários (removidos)
- `C:\Users\devca\AppData\Local\Temp\tauri-res` (staging, regenerado)
- `C:\Users\devca\AppData\Local\Temp\mangaink-dist`
- `$TEMP/handle64*` (ferramenta de diagnóstico Sysinternals)

---

## Implementações novas

### `apps/desktop/scripts/build-distributions.mjs`
- **`MI_DIST_DIR`** (env): override do diretório base de saída (default `apps/desktop/dist`).
- **Consolidação em `dist/`:** o Setup NSIS gerado em
  `src-tauri/target/release/bundle/nsis/*.exe` agora é **copiado para `DIST_DIR`**,
  tornando `dist/` o coletor único dos artefatos de distribuição
  (instalador + `win-unpacked/`). O `target/release/` permanece como área interna do cargo.

### `apps/desktop/scripts/prepare-runtime.mjs`
- **Cache offline** (`MI_RUNTIME_DOWNLOAD_DIR`): se o arquivo pré-baixado (basename da URL
  do artefato) existe no diretório, o download de rede é pulado e o arquivo é revalidado
  por SHA256 — útil para ambientes offline ou upstream indisponível.

### `.gitignore`
- **`.gitignore` (raiz):** adicionado `package-lock.json` (evita recommit do lockfile npm).
- **`apps/desktop/src-tauri/.gitignore`:** adicionados `/resources/`, `resources-manifest.json`,
  `tauri.resources.longpath.json` (gerados pelo prepare).
- **`apps/desktop/.gitignore`:** removidas as exceções `!build/` (ícones Electron apagados).

---

## Resultado do rebuild

Artefatos gerados (coletor único em `apps/desktop/dist/`):

```
apps/desktop/dist/
├── MangaInk Agent_0.1.0_x64-setup.exe   ← instalador NSIS (127 MB)
└── win-unpacked/                          ← portátil (executa sem instalar)
    ├── MangaInk Agent.exe                 ← binário Tauri (ProductVersion 0.1.0)
    └── backend/ frontend/ runtime/ node/  ← layout exigido pelo boot.rs
```

- Runtime embutido: PostgreSQL 16.8 + Python 3.11 + KCC 10.3.0 + kindlegen + extract_mobi (261 MB)
- Backend bundle hoisted self-contained: 293 entradas, deps críticas ok, 0 junctions
- Compilação Rust: `release` em ~3 min (1ª vez) / ~1 min (incremental)

---

## Pré-requisitos do sistema

- **pnpm** ≥ 9 (gerencia o monorepo; o projeto **não** usa npm — `package-lock.json` é
  bloqueado no lint via `scripts/guard-npm-lock.mjs`).
- **Node.js** ≥ 22 no host (executa os scripts `.mjs` de build; o `node.exe` empacotado
  no app é baixado separadamente e validado por SHA256).
- **Rust toolchain** (stable/MSVC) via [rustup](https://rustup.rs) — `rustup show` deve
  listar um toolchain `x86_64-pc-windows-msvc`.
- **Visual Studio Build Tools** (linker MSVC + Windows SDK) — o `cargo build` exige o
  toolchain MSVC (o GNU não compila dependências nativas do Tauri).
- **WebView2 Runtime** — runtime do Tauri no Windows (pré-instalado no Win11/10
  atualizado).
- **NSIS** — baixado **automaticamente** pelo CLI do Tauri em
  `%LOCALAPPDATA%\tauri\NSIS` no primeiro build.
- **`System32/tar.exe` (bsdtar)** — necessário para extrair os zips do runtime no
  Windows (o `prepare-runtime.mjs` usa o tar do Windows, não o GNU do Git Bash).

> O staging dos resources é decidido automaticamente: se o path do workspace exceder
> 240 chars (makensis/MAX_PATH), o `prepare-tauri-resources.mjs` usa um staging curto
> em `%TEMP%\mangaink-tauri-res` **sem exigir env** (`MI_TAURI_RESOURCES_DIR` vira
> apenas um override opcional).

## Como gerar os artefatos manualmente

```bash
# 1. Dependências
pnpm install

# 2. Frontend
pnpm build

# 3. Runtime embutido (re-download ~260MB; idempotente — pula o que já existe)
pnpm desktop:prepare:runtime
#   offline / upstream 503: cacheie os zips e aponte MI_RUNTIME_DOWNLOAD_DIR
MI_RUNTIME_DOWNLOAD_DIR=dir/ pnpm desktop:prepare:runtime

# 4. Backend bundle (hoisted self-contained)
pnpm desktop:prepare:backend

# 5. Copiar frontend para os resources
pnpm desktop:prepare:frontend

# 6. Staging + build Tauri + distribuições (env é opcional, ver acima)
pnpm desktop:dist
```

Ou, **tudo em um comando** — `pnpm desktop:dist` (raiz) já encadeia os passos 2–6:
`pnpm build` (frontend) → `desktop:prepare:runtime` → `desktop:prepare:backend` →
`desktop:prepare:frontend` → `desktop dist` (que roda `prepare-tauri-resources.mjs` →
`tauri-build-config.mjs` → `build-distributions.mjs`). Sem necessidade de env var:

```bash
pnpm desktop:dist
```

### Notas
- O fallback automático de staging (`%TEMP%\mangaink-tauri-res`) torna o build
  portátil. Para apontar outro diretório: `MI_TAURI_RESOURCES_DIR=... pnpm desktop:dist`.
- Se o makensis acusar "arquivo em uso" (`os error 32`), é scan transitório do Windows
  Defender — basta **re-executar** (`pnpm desktop:dist` reutiliza o cargo compilado).
- O `tauri-build-config.mjs` valida `build.frontendDist` (exige `index.html`) e envolve
  o `tauri build` com erro amigável (exit code + dicas de toolchain).
- A versão do instalador vem de `"version"` em `apps/desktop/src-tauri/tauri.conf.json`
  (hoje `0.1.0`).
- Nenhum artefato gerado vai para o git (`dist/`, `target/`, `resources/`, staging e
  manifests estão no `.gitignore`).

## Melhorias da revisão (2026-08-16)

Correções aplicadas após análise cruzada dos scripts com o documento:

1. **Staging com fallback automático** — `prepare-tauri-resources.mjs` usa
   `%TEMP%\mangaink-tauri-res` quando o default estoura MAX_PATH (antes: `throw`).
2. **Validação deduplicada** — `CRITICAL_DEPS`, `MIN_NODE_MODULES_ENTRIES`,
   `countJunctions()` e `validateBackendNodeModules()` movidos para
   `apps/desktop/scripts/shared/backend-validation.mjs` (sem drift entre prepare/build).
3. **Mirror do kindlegen** — `runtime-manifest.json` ganhou `mirrors` por artefato;
   `prepare-runtime.mjs` tenta URL → mirrors em ordem até validar SHA256. O kindlegen
   aponta para a GitHub Release `runtime-assets` deste repositório.
4. **Erro amigável no `tauri build`** — `tauri-build-config.mjs` com try/catch (exit
   code + dicas: `rustup show`, VS Build Tools, NSIS).
5. **NSIS hook com retry** — o `.ps1` encerra processos sob `$INSTDIR` e polla até
   ~10s (antes: `Sleep 1500` fixo); sleep residual de 500ms.
6. **`frontendDist` validado** — `tauri-build-config.mjs` exige `index.html` antes de
   buildar (não empacota frontend vazio).
7. **Node.js pinado** — artefato `node` no `runtime-manifest.json` (URL + SHA256);
   `prepare-tauri-resources.mjs` valida o hash do zip antes de extrair.
8. **Retry com backoff** — `downloadFile()`: 3 tentativas (2s/4s/8s) em falha de
   rede/5xx (antes: falha imediata nos ~260MB).
9. **Flush garantido** — `downloadFile()` usa `finished()` de `node:stream/promises`.
10. **CSP** — `tauri.conf.json` com política restritiva (loopback + imagens remotas);
    dev continua com `csp: null` via `tauri.conf.dev.json` (`tauri dev --config`).
11. **Guarda do npm lock** — `scripts/guard-npm-lock.mjs` no `pnpm lint`: falha se
    `package-lock.json` existir.
12. **Validação de tamanho** — `build-distributions.mjs` exige Setup ≥ 50MB e exe ≥
    10MB (detecta instalador/executável truncado).

---

## Estado do git (mudanças pendentes da task)

- **Removidos:** `package-lock.json`, `apps/desktop/build/*`, `electron-builder.yml`,
  `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `src/main/*`,
  `src/preload/*`, `src/tests/*`, `scripts/after-pack.mjs`, `run-e2e.mjs`, `generate-icon.mjs`
- **Modificados:** `.gitignore`, `apps/desktop/.gitignore`, `apps/desktop/package.json`,
  `apps/desktop/scripts/prepare-runtime.mjs`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- **Novos (Tauri):** `apps/desktop/scripts/build-distributions.mjs`,
  `prepare-tauri-resources.mjs`, `tauri-build-config.mjs`, `apps/desktop/src-tauri/`