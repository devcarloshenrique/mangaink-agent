#!/usr/bin/env node
// guard-npm-lock.mjs
// Guard do lint: o projeto usa pnpm — se um package-lock.json (npm) existir
// no working tree, o lint falha com mensagem explicativa. Evita o cenário de
// "npm install" acidental criando um node_modules misto invisível ao git
// (o arquivo está no .gitignore, então o code review não o detectaria).

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lock = join(root, 'package-lock.json')

if (existsSync(lock)) {
  process.stderr.write(`✗ package-lock.json encontrado em ${lock}.\n`)
  process.stderr.write(`  O projeto usa pnpm — remova o lockfile e re-instale com pnpm:\n`)
  process.stderr.write(`    rm package-lock.json && pnpm install\n`)
  process.exit(1)
}

process.stdout.write('✓ sem package-lock.json (pnpm ok)\n')