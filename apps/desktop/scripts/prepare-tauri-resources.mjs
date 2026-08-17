#!/usr/bin/env node
// prepare-tauri-resources.mjs (MEC-14 · Task 10)
// Estagia os resources do app para o bundle do Tauri, resolvendo junctions
// (D4) e usando um staging curto quando o path do workspace for longo demais
// para o makensis (limite MAX_PATH de 260 chars).
//
// Fonte: apps/desktop/resources/{backend,frontend,runtime,node}
//   (materializados por prepare-backend/prepare-frontend/prepare-runtime +
//    node.exe baixado por este script se ausente)
// Destino: <staging>/{backend,frontend,runtime,node}
//   - default: apps/desktop/src-tauri/resources  (portável)
//   - se o path absoluto do node_modules mais profundo exceder 240 chars,
//     usa automaticamente um staging curto em %TEMP% (mangaink-tauri-res) e
//     gera `src-tauri/tauri.resources.longpath.json` para o `tauri build --config`.
//     MI_TAURI_RESOURCES_DIR continua como override explícito.
//
// Também verifica (D4) que não restam junctions/symlinks no staging e escreve
// o manifesto `src-tauri/resources-manifest.json` com o resultado.

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CRITICAL_DEPS,
  MIN_NODE_MODULES_ENTRIES,
  countJunctions,
  validateBackendNodeModules,
} from './shared/backend-validation.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const DESKTOP_DIR = join(SCRIPTS_DIR, '..')
const SRC_TAURI = join(DESKTOP_DIR, 'src-tauri')
const SOURCES_DIR = join(DESKTOP_DIR, 'resources')
const MANIFEST_PATH = join(SCRIPTS_DIR, 'runtime-manifest.json')

const SOURCES = ['backend', 'frontend', 'runtime', 'node']

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function maxPathLen(root) {
  let max = 0
  const walk = (dir) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (full.length > max) {
        max = full.length
      }
    }
  }
  walk(root)
  return max
}

function copyDereferenced(src, dst) {
  rmSync(dst, { recursive: true, force: true })
  mkdirSync(dirname(dst), { recursive: true })
  // Copia recursivamente materializando junctions/symlinks (D4).
  // O `.pnpm` do backend é o store interno do pnpm (layout hoisted expõe tudo
  // em node_modules/ raiz) e contém junctions auto-referenciadas que o Node
  // não consegue dereferenciar — excluímos do bundle (não é usado em runtime).
  const filter = (srcPath) => {
    const rel = relative(src, srcPath)
    const parts = rel.split(sep)
    if (parts.includes('.pnpm')) return false
    return true
  }
  cpSync(src, dst, { recursive: true, dereference: true, filter })
}

// Artefato `node` do runtime-manifest.json: fonte única da URL + SHA256 do
// node.exe empacotado (sem versão/hash hardcoded no script — ponto #7).
function nodeArtifact() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const artifact = manifest.artifacts?.find((a) => a.id === 'node')
  if (!artifact?.url || !artifact?.sha256) {
    throw new Error(
      `artefato "node" ausente ou incompleto em ${MANIFEST_PATH} ` +
        `(precisa de url + sha256). Adicione antes de buildar o desktop.`,
    )
  }
  return artifact
}

function sha256Of(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function ensureNodeExe(dstNode) {
  if (existsSync(join(dstNode, 'node.exe'))) return
  const artifact = nodeArtifact()
  const zipBase = basenameUrl(artifact.url).replace(/\.zip$/i, '')
  log(`  ⚠ node.exe ausente em ${relative(DESKTOP_DIR, dstNode)} — baixando ${zipBase}...`)
  const zip = join(tmpdir(), `${zipBase}.zip`)
  if (!existsSync(zip)) {
    execSync(`curl -sL -o "${zip}" "${artifact.url}"`, { stdio: 'ignore' })
  }
  const actual = sha256Of(zip)
  if (actual !== artifact.sha256.toLowerCase()) {
    throw new Error(
      `SHA256 divergente para ${zip} (esperado ${artifact.sha256}, obtido ${actual}). ` +
        `Remova o zip e deixe baixar de novo.`,
    )
  }
  const out = join(tmpdir(), zipBase)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  execSync(`powershell -NoProfile -Command "Expand-Archive -Force '${zip}' '${out}'"`, {
    stdio: 'ignore',
  })
  const exe = join(out, zipBase, 'node.exe')
  if (!existsSync(exe)) {
    // tenta path direto do zip (Expand-Archive pode criar subpasta diferente)
    const flat = join(out, 'node.exe')
    if (!existsSync(flat)) throw new Error('falha ao extrair node.exe')
    mkdirSync(dstNode, { recursive: true })
    cpSync(flat, join(dstNode, 'node.exe'))
    log(`  ✓ node.exe (SHA256 ok) → ${relative(DESKTOP_DIR, join(dstNode, 'node.exe'))}`)
    return
  }
  mkdirSync(dstNode, { recursive: true })
  cpSync(exe, join(dstNode, 'node.exe'))
  log(`  ✓ node.exe (SHA256 ok) → ${relative(DESKTOP_DIR, join(dstNode, 'node.exe'))}`)
}

function basenameUrl(url) {
  return url.split(/[/\\]/).pop()
}

// ── 1. garante fontes materializadas ──
for (const name of ['backend', 'frontend', 'runtime']) {
  if (!existsSync(join(SOURCES_DIR, name))) {
    throw new Error(
      `${relative(DESKTOP_DIR, join(SOURCES_DIR, name))} não existe. Rode prepare-backend/prepare-frontend/prepare-runtime antes.`,
    )
  }
}

// ── 2. decide staging ──
const defaultStaging = join(SRC_TAURI, 'resources')
const shortStaging = join(tmpdir(), 'mangaink-tauri-res')

// long-path é decidido pelo path do arquivo mais profundo do backend: se o
// workspace for profundo, o makensis estoura MAX_PATH no path relativo.
const deepestProbe = (stagingDir) =>
  join(
    stagingDir,
    'backend',
    'node_modules',
    '@prisma',
    'instrumentation',
    'node_modules',
    '@opentelemetry',
    'instrumentation',
    'build',
    'esnext',
    'platform',
    'node',
    'RequireInTheMiddleSingleton.d.ts',
  )
const longPath = deepestProbe(defaultStaging).length > 240

// Fallback automático para staging curto em %TEMP% quando o default estoura
// MAX_PATH (evita exigir env manual). MI_TAURI_RESOURCES_DIR é override.
let staging
let fallback = false
if (process.env.MI_TAURI_RESOURCES_DIR) {
  staging = resolve(process.env.MI_TAURI_RESOURCES_DIR)
} else if (longPath) {
  const probeShort = deepestProbe(shortStaging).length
  if (probeShort > 240) {
    throw new Error(
      `O staging curto (${shortStaging}) ainda gera paths >240 chars (${probeShort}). ` +
        `Defina MI_TAURI_RESOURCES_DIR para um dir mais curto.`,
    )
  }
  staging = shortStaging
  fallback = true
} else {
  staging = defaultStaging
}

log(
  `Staging resources → ${relative(DESKTOP_DIR, staging)}${longPath ? ` (curto${fallback ? ' automático' : ''}, long-path override)` : ''}`,
)

// ── 2.1 valida FONTE self-contained (contagem + integridade) ──
// Antes de copiar, garante que o bundle backend NÃO é o layout isolado
// (store .pnpm + junctions) — o bug MEC-24: o copy com dereference:true
// materializa as junctions mas DERRUBA o contexto do store, sumindo com
// deps transitivas (effect, c12, deepmerge-ts, empathic…). O bundle FONTE
// precisa ser hoisted self-contained (todas as deps na raiz).
const srcBackendNm = join(SOURCES_DIR, 'backend', 'node_modules')
const srcCount = validateBackendNodeModules(srcBackendNm, 'fonte backend/node_modules')
const srcJunctions = countJunctions(srcBackendNm)
if (srcJunctions > 0) {
  throw new Error(`fonte backend/node_modules: ${srcJunctions} junction(s) encontrados — bundle não é self-contained (layout isolado). Regenere com prepare-backend.mjs (node-linker=hoisted).`)
}
log(`  ✓ fonte backend/node_modules: 0 junctions (${srcCount} entradas)`)

// ── 3. copia materializando (dereference junctions) ──
for (const name of SOURCES) {
  const src = join(SOURCES_DIR, name)
  if (!existsSync(src)) continue
  copyDereferenced(src, join(staging, name))
  log(`  ✓ ${name} → ${relative(DESKTOP_DIR, join(staging, name))}`)
}
ensureNodeExe(join(staging, 'node'))

// ── 4. verificação D4: sem junctions/symlinks ──
let totalJunctions = 0
for (const name of SOURCES) {
  const dst = join(staging, name)
  if (existsSync(dst)) totalJunctions += countJunctions(dst)
}
if (totalJunctions > 0) {
  throw new Error(`D4: ${totalJunctions} junction(s)/symlink(s) encontrados no staging — materialize antes de buildar.`)
}
log('  ✓ D4: 0 junctions/symlinks no staging (verificado)')

// ── 4.1 verificação pós-cópia: contagem + integridade no staging ──
// Depois do dereference:true (e exclusão da store .pnpm), confere que o
// node_modules do staging ainda é completo/self-contained — é isso que vai
// para dentro do instalador.
const stagedBackendNm = join(staging, 'backend', 'node_modules')
const stagedCount = validateBackendNodeModules(stagedBackendNm, 'staging backend/node_modules')
log(`  ✓ staging backend/node_modules: 0 junctions (${stagedCount} entradas)`)

// ── 5. gera manifesto ──
const maxPath = maxPathLen(staging)
const manifest = {
  staging,
  relativePath: relative(DESKTOP_DIR, staging),
  junctions: totalJunctions,
  maxPathLen: maxPath,
  longPathOverride: longPath,
  backendNodeModules: {
    sourceEntries: srcCount,
    sourceJunctions: srcJunctions,
    stagedEntries: stagedCount,
    criticalDeps: CRITICAL_DEPS.length,
    minEntries: MIN_NODE_MODULES_ENTRIES,
  },
  timestamp: new Date().toISOString(),
}
const manifestPath = join(SRC_TAURI, 'resources-manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
log(`  ✓ manifesto → ${relative(DESKTOP_DIR, manifestPath)} (maxPathLen=${maxPath})`)

if (longPath) {
  const override = {
    bundle: {
      resources: {
        [`${staging.replace(/\\/g, '/')}/backend`]: 'backend',
        [`${staging.replace(/\\/g, '/')}/frontend`]: 'frontend',
        [`${staging.replace(/\\/g, '/')}/runtime`]: 'runtime',
        [`${staging.replace(/\\/g, '/')}/node`]: 'node',
      },
    },
  }
  const overridePath = join(SRC_TAURI, 'tauri.resources.longpath.json')
  writeFileSync(overridePath, JSON.stringify(override, null, 2))
  log(`  ⚠ long-path: config override → ${relative(DESKTOP_DIR, overridePath)} (use --config)`)
}
