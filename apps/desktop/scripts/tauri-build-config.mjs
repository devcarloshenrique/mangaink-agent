#!/usr/bin/env node
// tauri-build-config.mjs (MEC-14 · Task 10)
// Executa `tauri build` passando `--config` quando o prepare-tauri-resources
// detectou path longo (workspace profundo / makensis MAX_PATH) e gerou
// `src-tauri/tauri.resources.longpath.json`. Em ambientes com path curto,
// roda `tauri build` puro (config padrão relativa).
//
// Antes de buildar, valida o `build.frontendDist` do tauri.conf.json
// (resolve relativo a src-tauri e exige index.html) para não empacotar um
// frontend vazio, e envolve o execSync com erro amigável (exit code + dicas
// de toolchain) em vez do stack cru do child_process.

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const SRC_TAURI = join(SCRIPTS_DIR, '..', 'src-tauri')
const MANIFEST = join(SRC_TAURI, 'resources-manifest.json')
const OVERRIDE = join(SRC_TAURI, 'tauri.resources.longpath.json')
const CONF = join(SRC_TAURI, 'tauri.conf.json')

function err(msg) {
  process.stderr.write(`✗ ${msg}\n`)
}

// ── validação do frontendDist (não empacotar frontend vazio) ──
function validateFrontendDist() {
  const conf = JSON.parse(readFileSync(CONF, 'utf8'))
  const frontendDist = conf?.build?.frontendDist
  if (!frontendDist) {
    throw new Error(`${CONF} sem build.frontendDist`)
  }
  const resolved = resolve(SRC_TAURI, frontendDist)
  const indexPath = join(resolved, 'index.html')
  if (!existsSync(indexPath)) {
    throw new Error(
      `frontendDist não contém index.html: ${resolved}\n` +
        `  Rode "pnpm build" (frontend) antes de buildar o desktop.`,
    )
  }
  process.stdout.write(`✓ frontendDist ok: ${resolved}\n`)
}

// ── decisão do --config ──
let args = ['build']
if (existsSync(MANIFEST)) {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  if (m.longPathOverride && existsSync(OVERRIDE)) {
    args.push('--config', OVERRIDE)
    process.stdout.write(`tauri build com long-path override: ${OVERRIDE}\n`)
  }
}

// tauri bin local
const bin = join(SCRIPTS_DIR, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri')
process.stdout.write(`> ${bin} ${args.join(' ')}\n`)

try {
  validateFrontendDist()
  execSync(`"${bin}" ${args.join(' ')}`, { stdio: 'inherit', shell: process.platform === 'win32' })
} catch (e) {
  if (e instanceof Error && e.message?.includes('frontendDist não contém index.html')) {
    err(e.message)
    process.exit(1)
  }
  const code = e?.status ?? 'desconhecido'
  err(`tauri build falhou (exit ${code}).`)
  err(`  Verifique o ambiente de build:`)
  err(`    • Rust toolchain  → "rustup show" (instale com https://rustup.rs)`)
  err(`    • VS Build Tools  → linker MSVC (vswhere / instalador VS 2022)`)
  err(`    • NSIS            → baixado automaticamente pelo tauri em %LOCALAPPDATA%\\tauri\\NSIS`)
  process.exit(code === 'desconhecido' ? 1 : Number(code))
}