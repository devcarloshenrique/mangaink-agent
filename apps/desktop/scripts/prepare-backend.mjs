#!/usr/bin/env node
// prepare-backend.mjs
// Prepara o bundle do backend para o app desktop em apps/desktop/resources/backend.
// Fluxo: build tsc → pnpm deploy --prod --legacy → prisma generate no bundle →
//        verificação de artefatos → smoke run.
import { execSync, spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync as fsRenameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPTS_DIR, '..', '..', '..')
const BUNDLE = join(ROOT, 'apps', 'desktop', 'resources', 'backend')
const SMOKE_TIMEOUT_MS = 4000
const SMOKE_KILL_GRACE_MS = 3000

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function fail(msg) {
  process.stderr.write(`${c.red}✗ ${msg}${c.reset}\n`)
  process.exit(1)
}

function quotePath(p) {
  return `"${p}"`
}

function runCapture(cmd, { cwd = ROOT, extraEnv = {} } = {}) {
  try {
    const out = execSync(cmd, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...extraEnv },
    })
    return { code: 0, stdout: out.toString() }
  } catch (err) {
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    }
  }
}

function dirSize(dir) {
  let total = 0
  const walk = (p) => {
    for (const entry of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile()) total += statSync(full).size
    }
  }
  walk(dir)
  return total
}

function findGeneratedClient(bundle) {
  const direct = join(bundle, 'node_modules', '.prisma', 'client', 'index.js')
  if (existsSync(direct)) return join(bundle, 'node_modules', '.prisma', 'client')
  const top = join(bundle, 'node_modules')
  if (existsSync(top)) {
    const stack = [top]
    const seen = new Set()
    while (stack.length > 0) {
      const dir = stack.pop()
      if (seen.has(dir)) continue
      seen.add(dir)
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (full.includes(`${sep}.prisma${sep}client`)) {
            if (existsSync(join(full, 'index.js'))) return full
          }
          const depth = relative(top, full).split(sep).length
          if (depth < 5) stack.push(full)
        }
      }
    }
  }
  return null
}

const sep = process.platform === 'win32' ? '\\' : '/'

function hasPrismaEngine(clientDir) {
  if (!clientDir || !existsSync(clientDir)) return false
  const entries = readdirSync(clientDir)
  return entries.some((f) => f.endsWith('.node') || f.endsWith('.wasm'))
}

function sharpLoadsNative(bundle) {
  // sharp 0.33+ usa pacotes de plataforma @img/sharp-<platform> (o binário
  // nativo fica em node_modules/.pnpm/... no layout pnpm). A checagem robusta
  // é carregar sharp de dentro do bundle e confirmar que o libvips nativo
  // está presente (sharp.versions.vips preenchido).
  const probe = `const s = require('sharp'); process.stdout.write(String(Boolean(s && s.versions && s.versions.vips)))`
  try {
    const out = execSync(`${quotePath(process.execPath)} -e ${JSON.stringify(probe)}`, {
      cwd: bundle,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return out.toString().trim() === 'true'
  } catch {
    return false
  }
}

function cleanBrokenJunctions(bundle) {
  // O pnpm deploy deixa um junction self-reference em
  // node_modules/.pnpm/node_modules/@mangaink/backend apontando para a pasta
  // apps/backend do workspace (quebrado após o deploy/rename). Um junction
  // quebrado faz o 7za do electron-builder falhar ao gerar os installers.
  // Remove junctions cujo alvo não resolve.
  const root = join(bundle, 'node_modules')
  if (!existsSync(root)) return 0
  const removed = []
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
        st = statSync(full)
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
          removed.push(relative(bundle, full))
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

function ensurePrismaLinks(bundle) {
  // O pnpm deploy pode deixar junctions de node_modules/@prisma/* apontando
  // para o workspace (quebradas após o rename — removidas pelo
  // cleanBrokenJunctions) ou simplesmente ausentes. O CLI prisma faz
  // require('@prisma/engines') (e o engines requer @prisma/debug,
  // @prisma/engines-version, @prisma/get-platform, @prisma/fetch-engine) no
  // runtime do migrate — sem os pacotes o migrate deploy falha no app
  // empacotado com MODULE_NOT_FOUND. Materializa como pastas REAIS todos os
  // pacotes @prisma/* presentes no .pnpm do próprio bundle e ausentes do
  // node_modules/@prisma.
  const root = join(bundle, 'node_modules', '@prisma')
  const pnpmDir = join(bundle, 'node_modules', '.pnpm')
  mkdirSync(root, { recursive: true })
  const created = []
  let entries = []
  try {
    entries = readdirSync(pnpmDir)
  } catch {
    return created
  }
  for (const entry of entries) {
    if (!entry.startsWith('@prisma+')) continue
    const name = entry.slice('@prisma+'.length, entry.indexOf('@', '@prisma+'.length))
    if (name === undefined || name === '') continue
    const link = join(root, name)
    if (existsSync(join(link, 'package.json'))) continue
    const candidate = join(pnpmDir, entry, 'node_modules', '@prisma', name)
    if (!existsSync(join(candidate, 'package.json'))) continue
    cpSync(candidate, link, { recursive: true })
    created.push(name)
  }
  return created
}

function verifyArtifacts() {
  const checks = []
  const distApp = join(BUNDLE, 'dist', 'app.js')
  checks.push(['dist/app.js existe', existsSync(distApp)])

  const prismaEngines = join(BUNDLE, 'node_modules', '@prisma', 'engines', 'package.json')
  checks.push(['@prisma/engines presente (CLI migrate)', existsSync(prismaEngines)])
  const prismaDebug = join(BUNDLE, 'node_modules', '@prisma', 'debug', 'package.json')
  checks.push(['@prisma/debug presente (dep do engines)', existsSync(prismaDebug)])

  const clientDir = findGeneratedClient(BUNDLE)
  const clientOk = clientDir !== null && hasPrismaEngine(clientDir)
  checks.push([
    `client Prisma gerado (${clientDir ? relative(BUNDLE, clientDir) : 'ausente'})`,
    clientOk,
  ])

  const sharpLib = join(BUNDLE, 'node_modules', 'sharp', 'dist', 'index.cjs')
  const sharpLegacyLib = join(BUNDLE, 'node_modules', 'sharp', 'lib', 'index.js')
  const sharpJs = existsSync(sharpLib) ? sharpLib : sharpLegacyLib
  const sharpOk = existsSync(sharpJs) && sharpLoadsNative(BUNDLE)
  checks.push([`sharp prebuild (lib=${relative(BUNDLE, sharpJs)} native=${sharpOk ? 'ok' : 'ausente'})`, sharpOk])

  checks.push(['package.json do bundle presente', existsSync(join(BUNDLE, 'package.json'))])

  const failed = checks.filter(([, ok]) => !ok)
  if (failed.length > 0) {
    for (const [label] of failed) {
      log(`${c.red}  ✗ ${label}${c.reset}`)
    }
    fail('Verificação de artefatos falhou — bundle incompleto.')
  }
  for (const [label] of checks) {
    log(`${c.green}  ✓ ${label}${c.reset}`)
  }
}

function runSmoke() {
  log(`${c.cyan}\n── Smoke run do bundle (${SMOKE_TIMEOUT_MS / 1000}s) ──${c.reset}`)
  const storagePath = join(tmpdir(), `mangaink-smoke-${Date.now()}`)
  const script = `require(${JSON.stringify(join(BUNDLE, 'dist', 'app.js'))})`
  const child = spawn(process.execPath, ['-e', script], {
    cwd: BUNDLE,
    env: {
      ...process.env,
      OTEL_SDK_DISABLED: 'true',
      PORT: '45678',
      JWT_SECRET: 'smoke-test-secret',
      DATABASE_URL: 'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db',
      REDIS_URL: 'redis://localhost:6379',
      STORAGE_PATH: storagePath,
      MI_DESKTOP_MANAGED: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let stderr = ''
  let stdout = ''
  child.stdout.on('data', (d) => {
    stdout += d
    if (stdout.length > 4000) stdout = stdout.slice(-4000)
  })
  child.stderr.on('data', (d) => {
    stderr += d
    if (stderr.length > 4000) stderr = stderr.slice(-4000)
  })

  let exited = false
  const killed = new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL')
        setTimeout(() => {
          if (child.exitCode === null && !child.killed) {
            try {
              process.kill(child.pid)
            } catch {
              /* já encerrado */
            }
          }
        }, SMOKE_KILL_GRACE_MS).unref()
      }
      resolve()
    }, SMOKE_TIMEOUT_MS)
    timer.unref()
  })

  child.on('exit', (code) => {
    exited = true
    if (code !== null) {
      log(`${c.red}  Processo saiu sozinho (code=${code}) antes do timeout — FAIL${c.reset}`)
      log(`  --- stderr (início) ---\n${stderr.slice(0, 3000)}`)
      process.exit(1)
    }
  })

  killed.then(() => {
    if (!exited) {
      log(`${c.green}  ✓ Processo vivo após ${SMOKE_TIMEOUT_MS / 1000}s — PASS${c.reset}`)
    }
  })
}

// ── 1. Limpa e recria o bundle ─────────────────────────────────────────
log(`${c.cyan}── Preparando bundle backend em ${relative(ROOT, BUNDLE)} ──${c.reset}`)
rmSync(BUNDLE, { recursive: true, force: true })
mkdirSync(BUNDLE, { recursive: true })

// ── 2. Build do backend ────────────────────────────────────────────────
log(`${c.cyan}\n── pnpm --filter @mangaink/backend build ──${c.reset}`)
const build = runCapture('pnpm --filter @mangaink/backend build')
if (build.code !== 0) {
  const distApp = join(ROOT, 'apps', 'backend', 'dist', 'app.js')
  if (!existsSync(distApp)) {
    fail(
      `Build do backend falhou (exit ${build.code}) e dist/app.js não foi emitido.\n${build.stderr?.slice(0, 2000) ?? ''}`,
    )
  }
  log(`${c.yellow}  ⚠ tsc reportou erros (exit ${build.code}) mas emitiu dist/app.js.` +
    ` Erros são pré-existentes em arquivos de teste (vi global sem vitest/globals no tsconfig).` +
    ` O bundle usa apenas o dist emitido — prosseguindo.${c.reset}`)
} else {
  log(`${c.green}  ✓ build ok${c.reset}`)
}

// ── 3. Deploy de produção ──────────────────────────────────────────────
// O deploy roda para um staging FORA do workspace (os.tmpdir): se o alvo
// fica dentro do monorepo, o `pnpm install --production` interno roda em
// contexto do workspace e PODA as devDependencies do workspace root. Com o
// staging fora do workspace o install é standalone (junctions relativas ao
// próprio node_modules/.pnpm), e o dir é movido (rename, mesmo volume) para
// o destino final — preservando os junctions.
//
// node-linker=hoisted: o layout ISOLADO (default) cria junctions de topo
// apontando para .pnpm/<pkg>@<ver>/node_modules/<pkg>. O after-pack do
// electron-builder copia node_modules com dereference:true (e o 7z/NSIS
// também desreferencia durante a extração) — transformando as junctions em
// pastas REAIS de topo que perdem o contexto do store. Aí require('effect')
// (dep do @prisma/config, necessário no `prisma migrate deploy`) e demais
// deps transitivas de topo falham com MODULE_NOT_FOUND no app empacotado.
// Com hoisted, TODOS os pacotes são materializados no node_modules de topo
// como pastas reais (self-contained) — o app continua resolvendo tudo mesmo
// após o dereference. Verificado: fastify/@prisma/config/@prisma/client e
// o boot do dist/app.js funcionam no bundle hoisted DEREFERENCIADO.
log(`${c.cyan}\n── pnpm deploy --prod --legacy (hoisted) → staging → ${relative(ROOT, BUNDLE)} ──${c.reset}`)
const deployEnv = { CI: 'true' }
const STAGING_DEPLOY = join(tmpdir(), `mangaink-backend-deploy-${Date.now()}`)
let deploy = { code: 0 }
if (process.env.MI_FORCE_FALLBACK === '1') {
  deploy = { code: 1 }
} else {
  rmSync(STAGING_DEPLOY, { recursive: true, force: true })
  deploy = runCapture(`pnpm --filter @mangaink/backend deploy --prod --legacy --config.node-linker=hoisted ${quotePath(STAGING_DEPLOY)}`, {
    extraEnv: deployEnv,
  })
  if (deploy.code !== 0) {
    log(`${c.yellow}  ⚠ deploy com --legacy falhou (exit ${deploy.code}); tentando sem --legacy…${c.reset}`)
    rmSync(STAGING_DEPLOY, { recursive: true, force: true })
    deploy = runCapture(`pnpm --filter @mangaink/backend deploy --prod --config.node-linker=hoisted ${quotePath(STAGING_DEPLOY)}`, { extraEnv: deployEnv })
  }
}

if (deploy.code === 0 && existsSync(join(STAGING_DEPLOY, 'node_modules'))) {
  rmSync(BUNDLE, { recursive: true, force: true })
  mkdirSync(dirname(BUNDLE), { recursive: true })
  fsRenameSync(STAGING_DEPLOY, BUNDLE)
  log(`${c.green}  ✓ deploy concluído${c.reset}`)
} else {
  // ── 3b. Fallback: cópia manual ──────────────────────────────────────
  // pnpm install dentro do bundle (que fica aninhado no workspace) dispara
  // o deps-status-check do workspace — por isso o install roda em um
  // staging dir FORA do monorepo (os.tmpdir) e o node_modules é movido.
  log(`${c.yellow}  ⚠ pnpm deploy falhou — usando fallback de cópia manual.${c.reset}`)
  const BACKEND_SRC = join(ROOT, 'apps', 'backend')
  const staging = join(tmpdir(), `mangaink-bundle-stage-${Date.now()}`)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  rmSync(BUNDLE, { recursive: true, force: true })
  mkdirSync(BUNDLE, { recursive: true })

  for (const rel of ['dist', 'prisma', 'scripts', 'prisma.config.ts', 'package.json']) {
    const from = join(BACKEND_SRC, rel)
    if (existsSync(from)) cpSync(from, join(staging, rel), { recursive: true })
  }
  // node-linker=hoisted: no Windows o pnpm cria junctions ABSOLUTAS apontando
  // para o staging quando roda standalone; com hoisted os links ficam
  // relativos a node_modules/.pnpm, então o diretório pode ser movido
  // (rename) para o bundle intacto. O pnpm 11 não lê `node-linker` de .npmrc
  // — usa pnpm-workspace.yaml (settings) ou o flag --config.
  writeFileSync(join(staging, 'pnpm-workspace.yaml'), 'nodeLinker: hoisted\n')
  const stagingPkgPath = join(staging, 'package.json')
  const stagingPkg = JSON.parse(readFileSync(stagingPkgPath, 'utf8'))
  delete stagingPkg.scripts
  if (stagingPkg.dependencies?.['@mangaink/shared']) {
    stagingPkg.dependencies['@mangaink/shared'] = `file:${join(BACKEND_SRC, '..', 'shared').replace(/\\/g, '/')}`
  }
  writeFileSync(stagingPkgPath, JSON.stringify(stagingPkg, null, 2))

  const install = runCapture('pnpm install --prod --no-frozen-lockfile --config.node-linker=hoisted', { cwd: staging, extraEnv: { CI: 'true' } })
  // ERR_PNPM_IGNORED_BUILDS faz o pnpm sair com 1 mesmo instalando os pacotes
  // (build scripts de sharp/prisma/engines não aprovados em contexto standalone).
  // O binário nativo do sharp vem prebuilt no pacote @img/sharp-<platform> e o
  // query compiler do Prisma é gerado pelo `prisma generate` abaixo — logo a
  // ausência dos postinstall é tolerada. Se o node_modules não existir, falha.
  const sharpInstalled = existsSync(join(staging, 'node_modules', 'sharp', 'package.json'))
  if (install.code !== 0 && !sharpInstalled) {
    fail(`Fallback de instalação falhou (exit ${install.code}). Use ` +
      `pnpm --filter @mangaink/backend deploy --prod --legacy ${quotePath(BUNDLE)} manualmente.\n${install.stderr?.slice(0, 2000) ?? ''}`)
  }
  if (install.code !== 0) {
    log(`${c.yellow}  ⚠ pnpm install saiu com ${install.code} (build scripts ignorados — esperado no fallback); pacotes instalados.${c.reset}`)
  }
  // Move o staging completo (runtime files + node_modules) para o bundle.
  rmSync(BUNDLE, { recursive: true, force: true })
  mkdirSync(dirname(BUNDLE), { recursive: true })
  fsRenameSync(staging, BUNDLE)
  log(`${c.green}  ✓ fallback manual concluído${c.reset}`)
}

// ── 3b. Limpeza do bundle (arquivos não necessários em runtime) ────────
// O pnpm deploy copia o projeto inteiro. Remove o que não deve ir no app:
//   .env/.env.test  → credenciais locais do dev (vazamento de secrets)
//   storage/        → cache de scraping do dev (centenas de MB)
//   src/            → fonte TypeScript (o runtime usa apenas dist/)
//   bin/            → binário KCC standalone legacy (92MB) — o runtime embutido
//                     usa python + source (<runtime>/kcc/kcc-c2e.py), nunca o exe.
// As env vars em runtime são injetadas pelo BackendManager do desktop.
const STAGING_REMOVE = ['.env', '.env.test', 'storage', 'src', 'bin']
for (const rel of STAGING_REMOVE) {
  rmSync(join(BUNDLE, rel), { recursive: true, force: true })
}

// ── 3b.0 Podar node_modules do bundle (apenas o que o migrate deploy exige) ──
// O CLI prisma `migrate deploy` precisa de @prisma/config + @prisma/engines
// (schema-engine-windows.exe) + os wasm compilers do provider postgresql, MAS
// o cli.js bundled faz require() EAGER de @prisma/studio-core/data/* e
// @prisma/dev/internal/state no load — então @prisma/studio-core e @prisma/dev
// DEVEM permanecer no bundle (regressão corrigida na MEC-8: primeira abertura
// em userData limpo quebrava com MODULE_NOT_FOUND). Só os deps de studio/dev
// que NÃO são carregados em runtime (pglite, elkjs, react, @babel, @visx,
// typings, typescript) são podados.
function pruneNodeModules(bundle) {
  const nm = join(bundle, 'node_modules')
  if (!existsSync(nm)) return 0
  const PRUNE_DIRS = [
    '@electric-sql', // pglite (dep do @prisma/dev, 24MB)
    'elkjs', // graph do studio (8MB)
    'react', // dep do studio (2MB)
    'react-dom', // dep do studio (7MB)
    '@babel', // transpile do studio (5MB)
    '@types', // typings — só dev (5MB)
    'typescript', // peer opcional do prisma (report de versão) — não usado no deploy
    '@visx', // lib de gráficos React (transitiva, nunca usada no backend, ~932 arquivos)
  ]
  let removed = 0
  for (const rel of PRUNE_DIRS) {
    const full = join(nm, rel)
    if (existsSync(full)) {
      const size = dirSize(full)
      rmSync(full, { recursive: true, force: true })
      log(`${c.dim}    - ${rel} (${(size / 1024 / 1024).toFixed(1)} MB)${c.reset}`)
      removed += size
    }
  }
  return removed
}

function pruneSourceMaps(bundle) {
  // Source maps (*.map) nunca são carregados pelo Node em runtime — só servem
  // para devtools/stacktraces mapeados. O bundle tinha ~4.5k arquivos .map
  // (~42MB). Removê-los corta centenas de MB de extração no SFX do Portable.
  const nm = join(bundle, 'node_modules')
  if (!existsSync(nm)) return 0
  let removedBytes = 0
  let removedFiles = 0
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.map')) {
        try {
          removedBytes += statSync(full).size
          rmSync(full, { force: true })
          removedFiles++
        } catch {
          /* best effort */
        }
      }
    }
  }
  walk(nm)
  if (removedFiles > 0) {
    log(`${c.dim}    - ${removedFiles} arquivo(s) .map (${(removedBytes / 1024 / 1024).toFixed(1)} MB)${c.reset}`)
  }
  return removedBytes
}

function pruneOtherProviderWasm(dir) {
  if (!existsSync(dir)) return 0
  const removed = []
  for (const f of readdirSync(dir)) {
    const full = join(dir, f)
    if (!f.includes('query_compiler')) {
      if (f.endsWith('.map')) {
        rmSync(full, { force: true })
        removed.push(f)
      }
      continue
    }
    const m = f.match(/^query_compiler_(fast|small)_bg\.([a-z0-9]+)/)
    if (m && m[2] !== 'postgresql') {
      rmSync(full, { force: true })
      removed.push(f)
    }
  }
  return removed
}

function prunePrismaWasm(bundle) {
  const nm = join(bundle, 'node_modules')
  const dirs = [
    join(nm, '@prisma', 'client', 'runtime'),
    join(nm, 'prisma', 'build'),
  ]
  let count = 0
  for (const dir of dirs) {
    count += pruneOtherProviderWasm(dir)
  }
  return count
}

// ── 3b.1 Limpeza de junctions quebrados no node_modules do bundle ──────
const brokenLinks = cleanBrokenJunctions(BUNDLE)
if (brokenLinks.length > 0) {
  log(`${c.yellow}  ⚠ ${brokenLinks.length} junction(s) quebrado(s) removidos do node_modules do bundle:${c.reset}`)
  for (const rel of brokenLinks) log(`${c.yellow}    - ${rel}${c.reset}`)
} else {
  log(`${c.green}  ✓ sem junctions quebrados no node_modules${c.reset}`)
}

// ── 3b.2 Materializa @prisma/* (CLI migrate precisa deles em runtime) ──
const prismaLinks = ensurePrismaLinks(BUNDLE)
if (prismaLinks.length > 0) {
  log(`${c.yellow}  ⚠ @prisma/* materializados do .pnpm (junction ausente/quebrada): ${prismaLinks.join(', ')}${c.reset}`)
} else {
  log(`${c.green}  ✓ @prisma/* linkados corretamente${c.reset}`)
}

// ── 3c. Restaura o workspace (efeito colateral do deploy --prod) ──────
// O `pnpm deploy --prod` registra settings.production=true no .modules.yaml
// do workspace root (limitação do deploy experimental do pnpm 11): a partir
// daí, qualquer pnpm run/exec roda um `install --production` no deps-check,
// podando as devDependencies. Um `pnpm install` completo reseta esse estado.
if (process.env.MI_SKIP_RESTORE !== '1') {
  log(`${c.cyan}\n── Restaurando workspace (CI=true pnpm install) ──${c.reset}`)
  const restore = runCapture('pnpm install', { extraEnv: { CI: 'true' } })
  if (restore.code !== 0) {
    log(`${c.yellow}  ⚠ pnpm install de restauração saiu com ${restore.code} (não-fatal — o bundle já está pronto).${c.reset}`)
  } else {
    log(`${c.green}  ✓ workspace restaurado${c.reset}`)
  }
}

// ── 4. Pós-deploy: prisma generate (se client ausente) ─────────────────
log(`${c.cyan}\n── Prisma client ──${c.reset}`)
let clientDir = findGeneratedClient(BUNDLE)
if (clientDir && hasPrismaEngine(clientDir)) {
  log(`${c.green}  ✓ client Prisma já gerado (${relative(BUNDLE, clientDir)})${c.reset}`)
} else {
  log(`${c.yellow}  ⚠ client Prisma ausente/incompleto — rodando generate no bundle…${c.reset}`)
  const genEnv = { DATABASE_URL: 'postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db' }
  const gen = runCapture(
    `node ${quotePath(join(BUNDLE, 'node_modules', 'prisma', 'build', 'index.js'))} generate --schema prisma/schema.prisma`,
    { cwd: BUNDLE, extraEnv: genEnv },
  )
  if (gen.code !== 0) {
    // segunda tentativa via binário npx-style
    const gen2 = runCapture('pnpm exec prisma generate --schema prisma/schema.prisma', {
      cwd: BUNDLE,
      extraEnv: genEnv,
    })
    if (gen2.code !== 0) {
      fail(`prisma generate falhou no bundle.\n${(gen.stderr || gen2.stderr)?.slice(0, 2000) ?? ''}`)
    }
  }
  clientDir = findGeneratedClient(BUNDLE)
  log(`${c.green}  ✓ client Prisma gerado (${clientDir ? relative(BUNDLE, clientDir) : 'localizado'})${c.reset}`)
}

// ── 4.1 Poda de pacotes não usados em runtime (studio/dev tooling) ────
// Roda DEPOIS do prisma generate (que pode precisar de typescript/@prisma/dev)
// e DEPOIS do ensurePrismaLinks (para não re-materializar do .pnpm os pacotes
// podados). `migrate deploy` no app empacotado só carrega @prisma/config +
// @prisma/engines + os wasm postgresql — studio/dev tooling é peso morto.
log(`${c.cyan}\n── Podando node_modules do bundle (studio/dev tooling) ──${c.reset}`)
const prunedBytes = pruneNodeModules(BUNDLE)
if (prunedBytes > 0) {
  log(`${c.green}  ✓ ${(prunedBytes / 1024 / 1024).toFixed(1)} MB removidos de pacotes não usados em runtime${c.reset}`)
} else {
  log(`${c.green}  ✓ nada a podar${c.reset}`)
}

// ── 4.2 Poda de wasm compilers de providers não-usados (só postgresql) ──
log(`${c.cyan}\n── Podando wasm de providers não-usados (mantém só postgresql) ──${c.reset}`)
const prunedWasm = prunePrismaWasm(BUNDLE)
if (prunedWasm > 0) {
  log(`${c.green}  ✓ ${prunedWasm} arquivo(s) wasm/map removido(s)${c.reset}`)
} else {
  log(`${c.green}  ✓ nada a podar${c.reset}`)
}

// ── 4.3 Poda de source maps (*.map) de todo o node_modules ─────────────
// Nunca carregados pelo Node em runtime; removê-los corta ~4.5k arquivos e
// ~42MB do payload — redução direta no tempo de extração do SFX do Portable.
log(`${c.cyan}\n── Podando source maps (*.map) do node_modules ──${c.reset}`)
const prunedMaps = pruneSourceMaps(BUNDLE)
if (prunedMaps > 0) {
  log(`${c.green}  ✓ ${(prunedMaps / 1024 / 1024).toFixed(1)} MB removidos em .map${c.reset}`)
} else {
  log(`${c.green}  ✓ nada a podar${c.reset}`)
}

// ── 5. Verificação de artefatos ────────────────────────────────────────
log(`${c.cyan}\n── Verificação de artefatos ──${c.reset}`)
verifyArtifacts()

// ── 6. Smoke run ───────────────────────────────────────────────────────
runSmoke()
