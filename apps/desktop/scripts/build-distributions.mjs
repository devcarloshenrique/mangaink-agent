#!/usr/bin/env node
// build-distributions.mjs (MEC-14 · Task 14 — MEC-30)
// Produz as distribuições do desktop Tauri que restaram após o usuário
// descartar a versão Portable (revisão 2026-08-12):
//
//   1. Setup NSIS      — gerado pelo `tauri build` (target `nsis`), já existente.
//   2. win-unpacked    — pasta com `MangaInk Agent.exe` + resources
//                        (backend/frontend/runtime/node) lado a lado. O
//                        `resource_dir()` do Tauri no Windows resolve para o
//                        diretório do exe, então esse layout boota em modo
//                        empacotado automaticamente (paridade win-unpacked).
//
// O Portable (SFX NSIS) foi removido por decisão do usuário — não é mais gerado.
//
// Uso:
//   node build-distributions.mjs [unpacked]
//
// Fluxo: lê `src-tauri/resources-manifest.json` (staging validado do
// prepare-tauri-resources), valida o node_modules do backend (contagem +
// integridade de deps críticas + 0 junctions) e monta a pasta win-unpacked
// a partir do staging curto (C:\tauri-res) para não estourar o MAX_PATH.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CRITICAL_DEPS,
  MIN_NODE_MODULES_ENTRIES,
  validateBackendNodeModules,
} from './shared/backend-validation.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const DESKTOP_DIR = join(SCRIPTS_DIR, '..')
const SRC_TAURI = join(DESKTOP_DIR, 'src-tauri')
const MANIFEST_PATH = join(SRC_TAURI, 'resources-manifest.json')
const RELEASE_EXE = join(SRC_TAURI, 'target', 'release', 'mangaink-desktop.exe')
const DIST_DIR = process.env.MI_DIST_DIR
  ? resolve(process.env.MI_DIST_DIR)
  : join(DESKTOP_DIR, 'dist')
const UNPACKED_DIR = join(DIST_DIR, 'win-unpacked')
const APP_EXE_NAME = 'MangaInk Agent.exe'

// Validação de integridade mínima dos artefatos: um instalador/executável
// truncado (download corrompido, copy parcial) não deve passar despercebido.
const MIN_SETUP_BYTES = 50 * 1024 * 1024 // ~127MB no build real
const MIN_EXE_BYTES = 10 * 1024 * 1024 // ~14MB no build real

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

/**
 * rmSync com retry para Windows — o sistema de arquivos pode bloquear
 * temporariamente arquivos (antivírus, OneDrive, Windows Search) causando
 * ENOTEMPTY mesmo com { recursive: true, force: true }.
 * Tenta até `maxAttempts` vezes com backoff linear de `delayMs`.
 */
function rmSyncRetry(path, maxAttempts = 5, delayMs = 600) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      rmSync(path, { recursive: true, force: true })
      return
    } catch (err) {
      if (attempt === maxAttempts) throw err
      const wait = delayMs * attempt
      log(`  ⚠ rmSync falhou (${err.code ?? err.message}) — tentativa ${attempt}/${maxAttempts}, aguardando ${wait}ms…`)
      // sleep síncrono via Atomics (sem dep extra)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait)
    }
  }
}

function resolveStaging() {
  if (existsSync(MANIFEST_PATH)) {
    const m = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    if (m.staging && existsSync(m.staging)) {
      return m.staging
    }
  }
  const defaultStaging = join(SRC_TAURI, 'resources')
  if (existsSync(join(defaultStaging, 'backend'))) {
    return defaultStaging
  }
  throw new Error(
    'staging dos resources não encontrado (resources-manifest.json ou src-tauri/resources). Rode prepare-tauri-resources antes.',
  )
}

function copyDir(src, dst) {
  rmSyncRetry(dst)
  mkdirSync(dirname(dst), { recursive: true })
  cpSync(src, dst, { recursive: true, dereference: true })
}

function buildUnpacked(staging) {
  log('\n── win-unpacked ──')
  if (!existsSync(RELEASE_EXE)) {
    throw new Error(`exe release ausente: ${RELEASE_EXE} — rode tauri build antes.`)
  }

  rmSyncRetry(UNPACKED_DIR)
  mkdirSync(UNPACKED_DIR, { recursive: true })

  // 1. exe do app (nome de produto, paridade com o Electron)
  cpSync(RELEASE_EXE, join(UNPACKED_DIR, APP_EXE_NAME))
  const exeSize = statSync(join(UNPACKED_DIR, APP_EXE_NAME)).size
  if (exeSize < MIN_EXE_BYTES) {
    throw new Error(
      `${APP_EXE_NAME} com ${(exeSize / 1024 / 1024).toFixed(1)} MB (< mínimo ` +
        `${MIN_EXE_BYTES / 1024 / 1024} MB) — exe truncado/corrompido?`,
    )
  }
  log(`  ✓ ${APP_EXE_NAME} ← ${relative(DESKTOP_DIR, RELEASE_EXE)} (${(exeSize / 1024 / 1024).toFixed(1)} MB)`)

  // 2. resources lado a lado (backend/frontend/runtime/node)
  for (const name of ['backend', 'frontend', 'runtime', 'node']) {
    const src = join(staging, name)
    if (!existsSync(src)) {
      throw new Error(`resource ${name} ausente no staging: ${src}`)
    }
    copyDir(src, join(UNPACKED_DIR, name))
    log(`  ✓ ${name} → win-unpacked/${name}`)
  }

  // 3. revalida o bundle backend materializado no win-unpacked
  const unpackedCount = validateBackendNodeModules(
    join(UNPACKED_DIR, 'backend', 'node_modules'),
    'win-unpacked/backend/node_modules',
    { requireNoJunctions: true },
  )
  log(`  ✓ win-unpacked/backend/node_modules: ${unpackedCount} entradas, deps críticas ok, 0 junctions`)

  log(`  ✓ win-unpacked completo: ${UNPACKED_DIR}`)
  return UNPACKED_DIR
}

// ── main ──
const mode = process.argv[2] || 'unpacked'
const staging = resolveStaging()
log(`Staging resources: ${staging}`)

// valida a FONTE (staging já validado pelo prepare, reforça aqui)
const stagingCount = validateBackendNodeModules(
  join(staging, 'backend', 'node_modules'),
  'staging backend/node_modules',
  { requireNoJunctions: true },
)
log(`  ✓ staging backend/node_modules: ${stagingCount} entradas, deps críticas ok, 0 junctions`)

const results = {}
if (mode === 'unpacked') {
  results.unpacked = buildUnpacked(staging)
} else {
  throw new Error(`modo desconhecido: ${mode} (use: unpacked)`)
}

// Consolidação: copia o Setup NSIS para o mesmo DIST_DIR do win-unpacked,
// fazendo de `dist/` o coletor único dos artefatos de distribuição
// (instalador + pasta portátil). O `target/release/bundle/nsis/` permanece
// como área interna do cargo.
const nsisDir = join(SRC_TAURI, 'target', 'release', 'bundle', 'nsis')
let setupCopied = null
if (existsSync(nsisDir)) {
  const setups = readdirSync(nsisDir).filter((f) => f.toLowerCase().endsWith('.exe'))
  if (setups.length > 0) {
    mkdirSync(DIST_DIR, { recursive: true })
    for (const setup of setups) {
      const dst = join(DIST_DIR, setup)
      cpSync(join(nsisDir, setup), dst)
      const size = statSync(dst).size
      if (size < MIN_SETUP_BYTES) {
        throw new Error(
          `${setup} com ${(size / 1024 / 1024).toFixed(1)} MB (< mínimo ` +
            `${MIN_SETUP_BYTES / 1024 / 1024} MB) — instalador truncado/corrompido?`,
        )
      }
    }
    setupCopied = setups.map((s) => join(DIST_DIR, s))
    log(`  ✓ Setup NSIS → ${relative(DESKTOP_DIR, DIST_DIR)} (${setups.length})`)
  }
}

log('\n── resumo ──')
log(`1. Setup NSIS : ${setupCopied ? setupCopied.join(', ') : (existsSync(nsisDir) ? nsisDir : '(rode tauri build para gerar)')}`)
if (results.unpacked) log(`2. win-unpacked: ${results.unpacked}`)
