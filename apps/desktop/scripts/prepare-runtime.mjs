#!/usr/bin/env node
// prepare-runtime.mjs
// Prepara o runtime embutido do app desktop em apps/desktop/resources/runtime.
// Materializa, a partir de apps/desktop/scripts/runtime-manifest.json (URL +
// SHA256 + licença por artefato), o Postgres portable, o Python embutido com
// wheels, o source do KCC v10.3.0 (patcheado + wrapper kcc-c2e.py), o
// kindlegen.exe e o extract_mobi.py.
//
// Uso (a partir de apps/desktop):
//   node scripts/prepare-runtime.mjs            # --only-missing (default)
//   node scripts/prepare-runtime.mjs --force    # rebaixa e re-materializa tudo
//
// Idempotente: com --only-missing, artefatos já preparados são pulados.
// Aborta com exit != 0 se um SHA256 divergir (rede corrompida / URL trocada).
//
// Extração usa o bsdtar do Windows (System32/tar.exe — o GNU tar do Git Bash
// não lê zips). --strip-components=1 aplica o stripRoot (raiz única dos
// arquivos: pgsql/, python/, kcc-10.3.0/).
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  cpSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { finished } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(SCRIPTS_DIR, '..', '..', '..')
export const RUNTIME_ROOT = join(ROOT, 'apps', 'desktop', 'resources', 'runtime')
export const MANIFEST_PATH = join(SCRIPTS_DIR, 'runtime-manifest.json')

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

// ── Lógica pura (exportada p/ testes) ───────────────────────────────────

/** Mapeia o artefato para o dir final dentro do runtime (ou null p/ wheels). */
export function resolveDest(runtimeRoot, artifact) {
  return artifact.dest ? join(runtimeRoot, artifact.dest) : null
}

/** stripRoot: arquivo tem raiz única — extrai com --strip-components=1. */
export function stripComponentsFor(stripRoot) {
  return stripRoot ? ['--strip-components=1'] : []
}

/** Valida o SHA256 de um arquivo. Retorna true se bater com `expectedHex`. */
export async function verifySha256(filePath, expectedHex) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  for await (const chunk of stream) hash.update(chunk)
  const actual = hash.digest('hex')
  return actual === String(expectedHex).toLowerCase()
}

/** Checa se um artefato já está preparado (idempotência do --only-missing). */
export function isPrepared(runtimeRoot, artifact) {
  if (artifact.id === 'wheels') {
    return existsSync(join(runtimeRoot, '.wheels-ok'))
  }
  const dest = resolveDest(runtimeRoot, artifact)
  if (!dest || !existsSync(dest)) return false
  switch (artifact.id) {
    case 'postgres':
      return existsSync(join(dest, 'bin', 'pg_ctl.exe'))
    case 'python':
      return existsSync(join(dest, 'python.exe'))
    case 'kcc-source':
      return (
        existsSync(join(dest, 'kindlecomicconverter', 'comic2ebook.py')) &&
        existsSync(join(dest, 'kcc-c2e.py'))
      )
    case 'kindlegen':
      return existsSync(join(dest, 'kindlegen.exe'))
    default:
      return existsSync(dest)
  }
}

// ── Helpers de infra ────────────────────────────────────────────────────

/** Caminho do bsdtar (lê zip e tar.gz). No Windows, o tar do Git Bash (GNU)
 *  não lê zips — usa o System32/tar.exe. */
export function systemTar() {
  if (process.platform === 'win32') {
    const sysRoot = process.env.SystemRoot ?? 'C:\\Windows'
    return join(sysRoot, 'System32', 'tar.exe')
  }
  return 'tar'
}

function run(args, { cwd } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stderr = ''
    let stdout = ''
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolvePromise({ code, stdout, stderr })
      else reject(new Error(`${args[0]} saiu com ${code}:\n${stderr.slice(0, 1500)}`))
    })
  })
}

const RETRY_DELAYS = [2000, 4000, 8000]

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

/** Download com retry (3 tentativas, backoff 2s/4s/8s) em falha de rede/5xx.
 *  Não retry em 4xx (exceto 429). Usa `finished(out)` para garantir que todos
 *  os bytes foram flushed antes de retornar. */
async function downloadFile(url, destPath, label, attempt = 1) {
  try {
    log(`${c.dim}    ↓ ${url}${c.reset}`)
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      const err = new Error(`download falhou (HTTP ${res.status}) para ${url}`)
      err.statusCode = res.status
      throw err
    }
    const total = Number(res.headers.get('content-length') ?? 0)
    const out = createWriteStream(destPath)
    let received = 0
    let lastPct = -1
    for await (const chunk of res.body) {
      received += chunk.length
      if (total > 0) {
        const pct = Math.floor((received / total) * 100)
        if (pct !== lastPct && pct % 20 === 0) {
          lastPct = pct
          log(`${c.dim}      ${pct}% (${fmtMB(received)})${c.reset}`)
        }
      }
      out.write(chunk)
    }
    out.end()
    await finished(out)
  } catch (err) {
    const status = err.statusCode
    const retryable = !(status >= 400 && status < 500 && status !== 429)
    if (retryable && attempt <= RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt - 1]
      log(`${c.yellow}    ! tentativa ${attempt} falhou (${err?.message ?? err}) — retry em ${delay}ms${c.reset}`)
      await sleep(delay)
      return downloadFile(url, destPath, label, attempt + 1)
    }
    throw err
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function dirSizeBytes(dir) {
  let total = 0
  for (const f of walk(dir)) total += statSync(f).size
  return total
}

function fmtMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function systemTarAvailable() {
  const tar = systemTar()
  return existsSync(tar)
}

// ── Steps de preparo ────────────────────────────────────────────────────

/**
 * Cache offline opcional: `MI_RUNTIME_DOWNLOAD_DIR` → diretório com o arquivo
 * pré-baixado nomeado pelo basename da URL do artefato (ex.:
 * `kindlegen_win32_v2_9.zip`). Se presente, o download de rede é pulado e o
 * arquivo é revalidado por SHA256 (paridade com o pin do manifesto) —
 * útil para ambientes offline ou quando o upstream está indisponível (503).
 */
export function resolveCachedArchive(artifact) {
  const dir = process.env.MI_RUNTIME_DOWNLOAD_DIR
  if (!dir) return null
  const base = basename(new URL(artifact.url).pathname)
  const candidate = join(dir, base)
  return existsSync(candidate) ? candidate : null
}

async function downloadAndVerify(artifact, stagingDir) {
  const filePath = join(stagingDir, `${artifact.id}.dl`)
  const cached = resolveCachedArchive(artifact)
  if (cached) {
    cpSync(cached, filePath)
    log(`${c.dim}    ↻ cache local: ${cached}${c.reset}`)
    const ok = await verifySha256(filePath, artifact.sha256)
    if (!ok) {
      throw new Error(
        `SHA256 divergente no cache local para '${artifact.id}' (esperado ${artifact.sha256}): ` +
          `remova ${cached} e deixe baixar da rede.`,
      )
    }
    log(`${c.green}    ✓ sha256 ok (cache)${c.reset}`)
    return filePath
  }

  // Tenta URL primária + mirrors em ordem até uma validar o SHA256 (a
  // downloadFile já faz retry interno por URL). O 1º que validar vence.
  const urls = [...new Set([artifact.url, ...(artifact.mirrors ?? [])])]
  const errors = []
  for (const url of urls) {
    try {
      await downloadFile(url, filePath, artifact.id)
      const ok = await verifySha256(filePath, artifact.sha256)
      if (ok) {
        log(`${c.green}    ✓ sha256 ok${c.reset}`)
        return filePath
      }
      errors.push(`${url}: sha256 divergente (esperado ${artifact.sha256})`)
    } catch (err) {
      errors.push(`${url}: ${err?.message ?? err}`)
    }
  }
  throw new Error(
    `falha ao baixar '${artifact.id}' de ${urls.length} URL(s):\n` +
      errors.map((e) => `    - ${e}`).join('\n'),
  )
}

async function extractArchive(artifact, archivePath, runtimeRoot) {
  const dest = resolveDest(runtimeRoot, artifact)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  const tar = systemTar()
  const args = [
    tar,
    '-xf',
    archivePath,
    '-C',
    dest,
    ...stripComponentsFor(artifact.stripRoot),
  ]
  await run(args)
  return dest
}

function stripDirs(dest, rels) {
  for (const rel of rels) {
    rmSync(join(dest, rel), { recursive: true, force: true })
  }
}

function stripPythonDebug(dest) {
  for (const f of walk(dest)) {
    if (f.endsWith('.pdb')) rmSync(f, { force: true })
  }
  const removePycache = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__pycache__') rmSync(full, { recursive: true, force: true })
        else removePycache(full)
      }
    }
  }
  removePycache(dest)
}

async function prepareArchive(artifact, runtimeRoot, opts) {
  if (opts.onlyMissing && isPrepared(runtimeRoot, artifact)) {
    log(`${c.dim}  › ${artifact.id}: já preparado — pulando${c.reset}`)
    return { status: 'skipped' }
  }
  log(`${c.cyan}  ${artifact.id}: baixando + validando + extraindo → ${resolveDest(runtimeRoot, artifact)}${c.reset}`)
  const stagingDir = join(tmpdir(), `mangaink-runtime-${artifact.id}-${Date.now()}`)
  mkdirSync(stagingDir, { recursive: true })
  try {
    const archivePath = await downloadAndVerify(artifact, stagingDir)
    await extractArchive(artifact, archivePath, runtimeRoot)
    if (artifact.strip) stripDirs(resolveDest(runtimeRoot, artifact), artifact.strip)
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }
  return { status: 'prepared' }
}

const KCC_WRAPPER = `# Wrapper do CLI do KCC para o runtime embutido (PYTHONPATH=<runtime>/kcc).
# O guard de __main__ é OBRIGATÓRIO no Windows: o multiprocessing spawn do KCC
# re-executa o script principal nos filhos (__mp_main__); sem o guard, cada
# filho re-executaria startC2E() recursivamente (RuntimeError de bootstrap).
# Equivalente à invocação \`-c\` usada pelo kcc-runner-embedded, mas legível nos logs.
from multiprocessing import freeze_support, set_start_method
from kindlecomicconverter.startup import startC2E
import sys

if __name__ == "__main__":
    set_start_method('spawn')
    freeze_support()
    sys.exit(startC2E())
`

async function prepareKccPost(runtimeRoot) {
  const kccDir = resolveDest(runtimeRoot, manifest.artifacts.find((a) => a.id === 'kcc-source'))
  const patchScript = join(SCRIPTS_DIR, 'patch_mobi_cover_runtime.py')
  const pythonBin = join(runtimeRoot, 'python', 'python.exe')
  await run([pythonBin, patchScript, kccDir])
  writeFileSync(join(kccDir, 'kcc-c2e.py'), KCC_WRAPPER, 'utf-8')
  log(`${c.green}    ✓ wrapper kcc-c2e.py criado em ${join(kccDir, 'kcc-c2e.py')}${c.reset}`)
}

async function prepareWheels(runtimeRoot, opts) {
  const wheelsArtifact = manifest.artifacts.find((a) => a.id === 'wheels')
  const marker = join(runtimeRoot, '.wheels-ok')
  if (opts.onlyMissing && isPrepared(runtimeRoot, wheelsArtifact)) {
    log(`${c.dim}  › wheels: já instalados — pulando${c.reset}`)
    return 'skipped'
  }
  const pythonBin = join(runtimeRoot, 'python', 'python.exe')
  if (!existsSync(pythonBin)) {
    fail('Python embutido ausente — rode a etapa "python" antes das wheels.')
  }
  log(`${c.cyan}  wheels: baixando ${wheelsArtifact.urls.length} wheels + instalando no python embutido${c.reset}`)
  const stagingDir = join(tmpdir(), `mangaink-runtime-wheels-${Date.now()}`)
  mkdirSync(stagingDir, { recursive: true })
  try {
    const paths = []
    for (const url of wheelsArtifact.urls) {
      const fileName = basename(new URL(url).pathname)
      const destPath = join(stagingDir, fileName)
      const expected = wheelsArtifact.sha256[fileName]
      if (!expected) throw new Error(`hash ausente no manifest para ${fileName}`)
      await downloadFile(url, destPath, fileName)
      const ok = await verifySha256(destPath, expected)
      if (!ok) throw new Error(`SHA256 divergente para a wheel ${fileName}`)
      paths.push(destPath)
    }
    log(`${c.dim}    pip install --no-deps (${paths.length} wheels)…${c.reset}`)
    await run([pythonBin, '-m', 'pip', 'install', '--no-deps', '--no-input', '--disable-pip-version-check', '--no-warn-script-location', ...paths])
    writeFileSync(marker, new Date().toISOString(), 'utf-8')
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }
  log(`${c.green}    ✓ wheels instaladas + marker .wheels-ok${c.reset}`)
  return 'prepared'
}

/** Remove .pdb (símbolos) e __pycache__ do python — nunca necessários em
 *  runtime; economia de ~80MB. Roda após a instalação das wheels. */
export function cleanPythonRuntime(pythonDir) {
  if (!pythonDir || !existsSync(pythonDir)) return 0
  const before = dirSizeBytes(pythonDir)
  stripPythonDebug(pythonDir)
  return before - dirSizeBytes(pythonDir)
}

/** Remove tkinter/tcl (GUI — o KCC é CLI), testes do stdlib e headers de
 *  desenvolvimento do python embutido. O KCC usa apenas módulos de CLI:
 *  PIL/numpy/pymupdf/psutil/requests/slugify/etc. Tcl/tk é peso morto (~7MB). */
export function prunePython(pythonDir) {
  if (!pythonDir || !existsSync(pythonDir)) return 0
  const before = dirSizeBytes(pythonDir)
  const removals = [
    'tcl',
    'Lib/tkinter',
    'Lib/idlelib',
    'Lib/lib2to3',
    'Lib/turtledemo',
    'Lib/msilib',
    'Lib/ensurepip',
    'Lib/venv',
    'Lib/pydoc_data',
    'Lib/test',
    'DLLs/_tkinter.pyd',
    'DLLs/tk86t.dll',
    'DLLs/tcl86t.dll',
    'libs/_tkinter.lib',
    'include',
    'libs',
  ]
  for (const rel of removals) {
    rmSync(join(pythonDir, rel), { recursive: true, force: true })
  }
  stripPythonDebug(pythonDir)
  return before - dirSizeBytes(pythonDir)
}

/** Remove binários PostgreSQL que o app não usa. O PostgresManager só chama
 *  initdb/pg_ctl/psql/createdb. pg_upgrade/pg_rewind/pgbench/wxWidgets (GUI
 *  do StackBuilder/pgAdmin) e outras ferramentas de admin não são usadas em
 *  runtime — peso morto no pacote. ICU e as libs do servidor são mantidas. */
export function prunePostgres(postgresDir) {
  if (!postgresDir || !existsSync(postgresDir)) return 0
  const before = dirSizeBytes(postgresDir)
  const bin = join(postgresDir, 'bin')
  const keep = new Set([
    'postgres.exe',
    'pg_ctl.exe',
    'initdb.exe',
    'psql.exe',
    'createdb.exe',
    'pg_dump.exe',
    'pg_restore.exe',
    'libpq.dll',
    'libssl-3-x64.dll',
    'libcrypto-3-x64.dll',
    'libiconv-2.dll',
    'libintl-9.dll',
    'zlib1.dll',
    'libwinpthread-1.dll',
    'libxml2.dll',
    'libxslt.dll',
    'libzstd.dll',
    'liblz4.dll',
    'libcurl.dll',
    'icudt67.dll',
    'icuin67.dll',
    'icuuc67.dll',
    'icutu67.dll',
    'icuio67.dll',
  ])
  if (existsSync(bin)) {
    for (const entry of readdirSync(bin, { withFileTypes: true })) {
      const full = join(bin, entry.name)
      if (entry.isFile() && !keep.has(entry.name)) {
        rmSync(full, { force: true })
      }
    }
  }
  return before - dirSizeBytes(postgresDir)
}

function copyExtractMobi(runtimeRoot) {
  const src = join(ROOT, 'docker', 'extract_mobi.py')
  const dest = join(runtimeRoot, 'extract_mobi.py')
  if (!existsSync(src)) fail(`docker/extract_mobi.py não encontrado em ${src}`)
  cpSync(src, dest)
  log(`${c.green}  extract_mobi.py copiado para ${dest}${c.reset}`)
}

function verifyArtifacts(runtimeRoot) {
  log(`${c.cyan}\n── Verificação de artefatos do runtime ──${c.reset}`)
  const checks = [
    ['postgres/bin/pg_ctl.exe', existsSync(join(runtimeRoot, 'postgres', 'bin', 'pg_ctl.exe'))],
    ['postgres/bin/initdb.exe', existsSync(join(runtimeRoot, 'postgres', 'bin', 'initdb.exe'))],
    ['python/python.exe', existsSync(join(runtimeRoot, 'python', 'python.exe'))],
    ['kcc/kindlecomicconverter/__init__.py', existsSync(join(runtimeRoot, 'kcc', 'kindlecomicconverter', '__init__.py'))],
    ['kcc/kcc-c2e.py (wrapper)', existsSync(join(runtimeRoot, 'kcc', 'kcc-c2e.py'))],
    ['kindlegen/kindlegen.exe', existsSync(join(runtimeRoot, 'kindlegen', 'kindlegen.exe'))],
    ['extract_mobi.py', existsSync(join(runtimeRoot, 'extract_mobi.py'))],
    ['.wheels-ok (wheels instaladas)', existsSync(join(runtimeRoot, '.wheels-ok'))],
  ]
  const failed = checks.filter(([, ok]) => !ok)
  for (const [label, ok] of checks) {
    log(`${ok ? c.green : c.red}  ${ok ? '✓' : '✗'} ${label}${c.reset}`)
  }
  if (failed.length > 0) {
    fail(`Runtime incompleto (${failed.length} artefato(s) ausente(s)).`)
  }
}

// ── Orquestração ────────────────────────────────────────────────────────

let manifest
function loadManifest() {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
  if (manifest.version !== 1) fail(`runtime-manifest.json com versão não suportada: ${manifest.version}`)
}

export async function main({ runtimeRoot = RUNTIME_ROOT, onlyMissing = true } = {}) {
  loadManifest()
  log(`${c.cyan}── Preparando runtime embutido em ${runtimeRoot} (${onlyMissing ? 'only-missing' : 'force'}) ──${c.reset}`)
  if (!systemTarAvailable()) {
    fail('bsdtar (System32/tar.exe) não encontrado — necessário para extrair zip/tar.gz no Windows.')
  }
  mkdirSync(runtimeRoot, { recursive: true })

  const opts = { onlyMissing }
  const byId = Object.fromEntries(manifest.artifacts.map((a) => [a.id, a]))
  const order = ['postgres', 'python', 'kcc-source', 'kindlegen', 'wheels']

  for (const id of order) {
    const artifact = byId[id]
    if (id === 'kcc-source') {
      const r = await prepareArchive(artifact, runtimeRoot, opts)
      if (r.status === 'prepared') await prepareKccPost(runtimeRoot)
      else if (opts.onlyMissing) {
        // já preparado — garante wrapper/patch presentes mesmo se o skip veio
        // de um estado antigo sem o wrapper
        const kccDir = resolveDest(runtimeRoot, artifact)
        if (!existsSync(join(kccDir, 'kcc-c2e.py'))) await prepareKccPost(runtimeRoot)
      }
    } else if (id !== 'wheels') {
      await prepareArchive(artifact, runtimeRoot, opts)
    }
  }

  await prepareWheels(runtimeRoot, opts)

  // Limpeza final do python (pdb + __pycache__), mesmo se as wheels foram
  // puladas por marker existente.
  const pythonArtifact = byId.python
  if (existsSync(join(resolveDest(runtimeRoot, pythonArtifact), 'python.exe'))) {
    const saved = cleanPythonRuntime(resolveDest(runtimeRoot, pythonArtifact))
    if (saved > 0) log(`${c.dim}  › python: ${fmtMB(saved)} removidos (.pdb/__pycache__)${c.reset}`)
    const pruned = prunePython(resolveDest(runtimeRoot, pythonArtifact))
    if (pruned > 0) log(`${c.dim}  › python: ${fmtMB(pruned)} removidos (tcl/tkinter/testes/headers)${c.reset}`)
  }

  // Poda do PostgreSQL: remove binários não usados em runtime (upgrade,
  // rewinding, pgbench, wxWidgets GUI do StackBuilder, ferramentas de admin).
  const postgresArtifact = byId.postgres
  if (existsSync(join(resolveDest(runtimeRoot, postgresArtifact), 'bin', 'pg_ctl.exe'))) {
    const prunedPg = prunePostgres(resolveDest(runtimeRoot, postgresArtifact))
    if (prunedPg > 0) log(`${c.dim}  › postgres: ${fmtMB(prunedPg)} removidos (ferramentas/utilitários não usados)${c.reset}`)
  }

  copyExtractMobi(runtimeRoot)
  verifyArtifacts(runtimeRoot)

  const totalBytes = dirSizeBytes(runtimeRoot)
  log(`${c.green}\n✓ Runtime pronto. Tamanho total: ${fmtMB(totalBytes)} (${totalBytes.toLocaleString('pt-BR')} bytes)${c.reset}`)
  return { runtimeRoot, totalBytes }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  const force = process.argv.includes('--force')
  main({ onlyMissing: !force }).catch((err) => {
    fail(err?.message ?? String(err))
  })
}
