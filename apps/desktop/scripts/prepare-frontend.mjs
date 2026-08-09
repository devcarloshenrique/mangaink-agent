#!/usr/bin/env node
// prepare-frontend.mjs
// Copia o dist do frontend (apps/frontend/dist) para apps/desktop/resources/frontend.
// Caminhos resolvidos via import.meta.url — funciona de qualquer cwd.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const DESKTOP_DIR = join(SCRIPTS_DIR, '..')
const ROOT = join(DESKTOP_DIR, '..', '..')
const FRONTEND_DIST = join(ROOT, 'apps', 'frontend', 'dist')
const DEST = join(DESKTOP_DIR, 'resources', 'frontend')

if (!existsSync(FRONTEND_DIST)) {
  process.stderr.write(
    `✗ ${relative(ROOT, FRONTEND_DIST)} nao existe. Rode antes: pnpm --filter @mangaink/frontend build\n`,
  )
  process.exit(1)
}

rmSync(DEST, { recursive: true, force: true })
mkdirSync(DEST, { recursive: true })
cpSync(FRONTEND_DIST, DEST, { recursive: true })

process.stdout.write(`✓ frontend copiado → ${relative(ROOT, DEST)}\n`)
