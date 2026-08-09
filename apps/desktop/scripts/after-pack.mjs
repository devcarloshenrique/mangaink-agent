#!/usr/bin/env node
// after-pack.mjs — hook electron-builder `afterPack` (roda após o pack do app,
// antes da geração dos installers NSIS/portable).
//
// O electron-builder exclui HARD-CODED o diretório `node_modules` da raiz de
// qualquer `from` copiado via extraResources (filter.js: "filter the root
// node_modules, but not a subnode_modules"). O bundle do backend depende do
// node_modules, então este hook o copia manualmente para o app empacotado.
//
// `dereference: true` materializa os junctions do pnpm como arquivos reais,
// deixando o app instalado auto-contido (sem dependência de junctions).
import { cpSync, existsSync, lstatSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const DESKTOP_DIR = join(SCRIPTS_DIR, '..')

function removeBrokenJunctions(root) {
  if (!existsSync(root)) return 0
  let removed = 0
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      let st
      try {
        st = lstatSync(full)
      } catch {
        continue
      }
      if (st.isSymbolicLink()) {
        let resolves = true
        try {
          statSync(full)
        } catch {
          resolves = false
        }
        if (!resolves) {
          removed++
          try {
            rmSync(full, { force: true })
          } catch {
            /* best effort */
          }
        }
      } else if (st.isDirectory()) {
        walk(full)
      }
    }
  }
  walk(root)
  return removed
}

export default async function afterPack(context) {
  const src = join(DESKTOP_DIR, 'resources', 'backend', 'node_modules')
  const dest = join(context.appOutDir, 'resources', 'backend', 'node_modules')

  if (!existsSync(src)) {
    throw new Error(`[after-pack] fonte ausente: ${src}`)
  }

  cpSync(src, dest, { recursive: true, dereference: true })
  const removed = removeBrokenJunctions(dest)
  if (removed > 0) {
    process.stdout.write(`[after-pack] ${removed} junction(s) quebrado(s) removidos do app empacotado\n`)
  }
  process.stdout.write(`[after-pack] node_modules copiado → ${relative(DESKTOP_DIR, dest)}\n`)
}
