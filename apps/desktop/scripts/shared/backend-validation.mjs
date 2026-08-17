#!/usr/bin/env node
// backend-validation.mjs
// Validação do bundle backend "self-contained" (layout hoisted) — compartilhada
// entre prepare-tauri-resources.mjs e build-distributions.mjs para evitar
// drift silencioso: a lista de deps críticas, o limite mínimo de entradas e o
// contador de junctions precisam ser idênticos nos dois pontos do pipeline.
//
// Por que a validação existe (bug MEC-24): o `prisma migrate deploy` do runtime
// empacotado requer deps transitivas (effect, c12, deepmerge-ts, empathic…) que
// só existem materializadas na raiz do node_modules quando o bundle usa o
// layout hoisted self-contained (node-linker=hoisted). Um bundle isolado
// (store .pnpm + junctions) quebra o boot das migrações com MODULE_NOT_FOUND.

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Deps críticas que o `prisma migrate deploy` precisa no runtime do app
// empacotado (require de @prisma/config → effect; cli bundled exige
// @prisma/engines, c12, deepmerge-ts, empathic etc). A ausência de qualquer
// uma delas quebra o boot das migrações com MODULE_NOT_FOUND. A checagem é
// feita no node_modules de TOPO (layout hoisted self-contained: TODOS os
// pacotes materializados na raiz, `.pnpm` só com lock.yaml).
export const CRITICAL_DEPS = [
  'effect',
  'c12',
  'deepmerge-ts',
  'empathic',
  'zod',
  'prisma',
  'sharp',
  'fastify',
  'ioredis',
  'pg',
  'axios',
  'bcryptjs',
  'bullmq',
  'cheerio',
  'dotenv',
]

// Limite mínimo de entradas top-level do node_modules (excl. `.pnpm`). O
// bundle hoisted self-contained de referência tem ~290 entradas; um bundle
// isolado/incompleto (store `.pnpm` + junctions) tem ~20 — abaixo do limite.
export const MIN_NODE_MODULES_ENTRIES = 200

/** Conta junctions/symlinks recursivamente (entradas isSymbolicLink). */
export function countJunctions(root) {
  let count = 0
  const walk = (dir) => {
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isSymbolicLink()) {
        count += 1
      } else if (e.isDirectory()) {
        walk(full)
      }
    }
  }
  walk(root)
  return count
}

/**
 * Valida um node_modules de backend como self-contained (hoisted).
 * Retorna a contagem de entradas top-level. Com `{ requireNoJunctions: true }`
 * também falha se houver junction(s) (layout isolado/store .pnpm).
 */
export function validateBackendNodeModules(
  nodeModulesDir,
  label,
  { requireNoJunctions = false } = {},
) {
  if (!existsSync(nodeModulesDir)) {
    throw new Error(`${label}: node_modules ausente (${nodeModulesDir})`)
  }
  const entries = readdirSync(nodeModulesDir).filter((e) => e !== '.pnpm')
  const count = entries.length
  if (count < MIN_NODE_MODULES_ENTRIES) {
    throw new Error(
      `${label}: node_modules incompleto — apenas ${count} entradas top-level ` +
        `(mínimo ${MIN_NODE_MODULES_ENTRIES}). Bundle não é self-contained ` +
        `(layout isolado/store .pnpm com junctions?). Regenere com ` +
        `prepare-backend.mjs (node-linker=hoisted) antes de buildar.`,
    )
  }
  const missing = CRITICAL_DEPS.filter((dep) => !existsSync(join(nodeModulesDir, dep)))
  if (missing.length > 0) {
    throw new Error(
      `${label}: deps críticas AUSENTES no node_modules de topo: ${missing.join(', ')}. ` +
        `prisma migrate deploy quebraria com MODULE_NOT_FOUND no app empacotado.`,
    )
  }
  if (requireNoJunctions) {
    const junctions = countJunctions(nodeModulesDir)
    if (junctions > 0) {
      throw new Error(
        `${label}: ${junctions} junction(s)/symlink(s) — bundle não é self-contained ` +
          `(layout isolado). Regenere com prepare-backend.mjs (node-linker=hoisted).`,
      )
    }
  }
  return count
}