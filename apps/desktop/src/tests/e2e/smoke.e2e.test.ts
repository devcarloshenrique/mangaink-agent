import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { _electron as electron, type ElectronApplication } from 'playwright'
import { describe, expect, test } from 'vitest'

const EXE_PATH = resolve(process.cwd(), 'dist', 'win-unpacked', 'MangaInk Agent.exe')
const HAS_EXE = existsSync(EXE_PATH)

const TERMINAL_STATUSES = [
  'starting',
  'prereq_failed',
  'postgres_failed',
  'migration_failed',
  'backend_failed',
  'ready',
]

const statusScreenBody = /Pré-requisitos|Iniciando|MangaInk/

const RUN_E2E = process.env.MI_RUN_E2E === '1'
const RUN_EMBEDDED = process.env.MI_SMOKE_EMBEDDED === '1'

if (RUN_E2E && !HAS_EXE) {
  console.warn(
    `[smoke-e2e] SKIP: EXE ausente em ${EXE_PATH} — rode \`pnpm desktop:dist\` para gerar o bundle empacotado`,
  )
}

interface DesktopStatusResult {
  state?: { status?: string; message?: string; stderr?: string }
  logs?: { stdout?: string; stderr?: string }
}

async function readStatus(
  page: Awaited<ReturnType<ElectronApplication['firstWindow']>>,
): Promise<DesktopStatusResult> {
  return page.evaluate(async () => {
    const api = (globalThis as unknown as { desktop?: { getStatus?: () => Promise<unknown> } }).desktop
    if (api?.getStatus === undefined) return {}
    return (await api.getStatus()) as DesktopStatusResult
  })
}

interface LaunchOptions {
  args?: string[]
  env?: Record<string, string>
}

/**
 * Sobe o app empacotado. `MI_SMOKE_E2E=1` marca o run como smoke (o app não usa
 * esse flag hoje, apenas documenta o contexto). `MI_EMBEDDED_MODE` pode ser
 * passado em `env` para forçar o caminho Docker/host (`'0'`).
 *
 * `args` aceita `--user-data-dir=<dir>`: o Electron respeita esse switch do
 * Chromium e `app.getPath('userData')` passa a apontar para o diretório dado —
 * isolando settings.json, storage/ e pgdata/ do userData real do app
 * (`%APPDATA%/MangaInk Agent`). O runtime embutido (resources/runtime) não é
 * afetado. Documentado para os testes embedded/full não poluírem o userData real.
 */
async function launchApp(options: LaunchOptions = {}): Promise<ElectronApplication> {
  return electron.launch({
    executablePath: EXE_PATH,
    args: options.args ?? [],
    env: { ...process.env, MI_SMOKE_E2E: '1', ...(options.env ?? {}) },
    timeout: 60_000,
  })
}

async function closeApp(app: ElectronApplication): Promise<void> {
  try {
    await Promise.race([
      app.close(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('electronApp.close() timeout')), 15_000)
      }),
    ])
  } catch {
    console.warn('[smoke-e2e] electronApp.close() não encerrou em 15s — aplicando force kill')
    app.process()?.kill()
  }
}

interface OrphanProcess {
  name: string
  pid: string
  commandLine: string
}

/**
 * Best effort: procura processos que deveriam ter sido encerrados com o app.
 * Filtra por linha de comando para não pegar python.exe/postgres.exe de outros
 * apps do host:
 *  - postgres.exe cujo CommandLine contenha `<userDataDir>\pgdata`
 *  - python.exe cujo CommandLine contenha `resources\runtime\python` (runtime embutido)
 *  - `MangaInk Agent.exe` cujo CommandLine contenha o `--user-data-dir` do teste
 */
function probeOrphanProcesses(userDataDir: string): OrphanProcess[] {
  const script = [
    `$dir = '${userDataDir.replace(/'/g, "''")}'`,
    "$rows = Get-CimInstance Win32_Process | Where-Object {",
    "($_.Name -eq 'postgres.exe' -and $_.CommandLine -like \"*$dir*pgdata*\") -or",
    "($_.Name -eq 'python.exe' -and $_.CommandLine -like '*resources\\runtime\\python*') -or",
    "($_.Name -eq 'MangaInk Agent.exe' -and $_.CommandLine -like \"*$dir*\")",
    '}',
    "foreach ($r in $rows) { \"$($r.Name)|$($r.ProcessId)|$($r.CommandLine)\" }",
  ].join('\n')
  const stdout = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf-8',
    timeout: 20_000,
    windowsHide: true,
  })
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, pid, ...rest] = line.split('|')
      return { name, pid, commandLine: rest.join('|') }
    })
}

async function makeTempUserData(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

describe.skipIf(!RUN_E2E || !HAS_EXE)(
  'smoke E2E (Playwright Electron) — app empacotado',
  () => {
    test(
      'janela abre, expõe window.desktop e mostra a status screen (backend indisponível — MI_EMBEDDED_MODE=0 força Docker/host)',
      async () => {
        const app = await launchApp({ env: { MI_EMBEDDED_MODE: '0' } })
        try {
          const page = await app.firstWindow()
          await page.waitForLoadState('domcontentloaded', { timeout: 30_000 })

          const title = await page.title()
          console.log(`[smoke-e2e] título da janela: "${title}"`)
          expect(title).toContain('MangaInk Agent')

          await expect
            .poll(() => page.textContent('body'), { timeout: 60_000, message: 'status screen não renderizou' })
            .toMatch(statusScreenBody)

          const hasDesktopApi = await page.evaluate(
            () => typeof (globalThis as unknown as { desktop?: { getStatus?: unknown } }).desktop?.getStatus,
          )
          expect(hasDesktopApi).toBe('function')

          const status = await readStatus(page)
          console.log(`[smoke-e2e] window.desktop.getStatus() → ${JSON.stringify(status)}`)
          expect(status.state?.status).toBeDefined()
          expect(TERMINAL_STATUSES).toContain(status.state?.status)

          await expect
            .poll(
              async () => (await readStatus(page)).state?.status,
              {
                timeout: 60_000,
                message:
                  'backend não atingiu um estado terminal (prereq_failed/postgres_failed/migration_failed/backend_failed/ready) em 60s',
              },
            )
            .not.toBe('starting')

          const terminalStatus = await readStatus(page)
          console.log(`[smoke-e2e] estado terminal do backend: ${terminalStatus.state?.status}`)
          expect(TERMINAL_STATUSES).toContain(terminalStatus.state?.status)

          if (terminalStatus.state?.status === 'prereq_failed') {
            await expect.poll(() => page.locator('#retry').count(), { timeout: 10_000 }).toBe(1)
          }
        } finally {
          await closeApp(app)
        }
      },
      90_000,
    )
  },
)

describe.skipIf(!RUN_E2E || !HAS_EXE || !RUN_EMBEDDED)(
  'smoke E2E embedded — runtime embutido (Postgres + Python) sem Docker',
  () => {
    test(
      'backend fica ready SEM Docker, tela de login renderiza, /api via app:// responde e quit sem órfãos',
      async () => {
        const tmpUserData = await makeTempUserData('mangaink-smoke-embedded-')
        console.log(`[smoke-embedded] userData temporário: ${tmpUserData}`)
        const failures: string[] = []
        let app: ElectronApplication | null = null
        try {
          app = await launchApp({ args: [`--user-data-dir=${tmpUserData}`] })
          const page = await app.firstWindow()
          await page.waitForLoadState('domcontentloaded', { timeout: 30_000 })

          const rendererLogs: string[] = []
          page.on('console', (msg) => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
              rendererLogs.push(`[renderer:${msg.type()}] ${msg.text()}`)
            }
          })
          page.on('pageerror', (err) => {
            rendererLogs.push(`[pageerror] ${err.message}`)
          })

          try {
            await expect
              .poll(
                async () => (await readStatus(page)).state?.status,
                {
                  timeout: 120_000,
                  message:
                    'backend embedded não saiu do estado "starting" em 120s (1ª execução roda initdb no userData temporário)',
                },
              )
              .not.toBe('starting')

            const bootStatus = await readStatus(page)
            console.log(
              `[smoke-embedded] estado terminal do boot: ${bootStatus.state?.status} — ${bootStatus.state?.message ?? ''}`,
            )
            console.log(`[smoke-embedded] url após boot: ${page.url()}`)
            if (bootStatus.state?.status !== 'ready') {
              const stderr = bootStatus.logs?.stderr ?? bootStatus.state?.stderr ?? ''
              failures.push(
                `backend não ficou ready (embedded): ${bootStatus.state?.status ?? 'desconhecido'} — ${bootStatus.state?.message ?? ''}\nstderr:\n${stderr.slice(0, 3000)}`,
              )
            } else {
              const loginDeadline = Date.now() + 60_000
              let loginProbe = { identifierInputs: 0, url: page.url() }
              while (Date.now() < loginDeadline) {
                const identifierInputs = await page.locator('#login-identifier').count()
                loginProbe = { identifierInputs, url: page.url() }
                if (identifierInputs >= 1) break
                await new Promise((resolve) => setTimeout(resolve, 1_000))
              }
              console.log(
                `[smoke-embedded] tela de login: identifierInputs=${loginProbe.identifierInputs} em url=${loginProbe.url}`,
              )
              if (loginProbe.identifierInputs < 1) {
                const body = ((await page.textContent('body')) ?? '').slice(0, 600)
                console.log(`[smoke-embedded] corpo da página (600 chars):\n${body}`)
                console.log(`[smoke-embedded] console do renderer:\n${rendererLogs.join('\n')}`)
                failures.push(`tela de login não renderizou (identifierInputs=0 em ${loginProbe.url})`)
              } else {
                const health = (await page.evaluate(() =>
                  fetch('/api/health').then((response) => response.json()),
                )) as { status?: string }
                console.log(`[smoke-embedded] GET /api/health → ${JSON.stringify(health)}`)
                if (health.status !== 'ok') {
                  failures.push(`/api/health não respondeu ok: ${JSON.stringify(health)}`)
                }

                const stamp = Date.now()
                const smokeUser = `smoke_${stamp}`
                const smokeEmail = `smoke_${stamp}@test.local`
                const smokePassword = 'Smoke123!'

                const register = (await page.evaluate(
                  async ({ username, email, password }) => {
                    const response = await fetch('/auth/register', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ username, email, password, confirmPassword: password }),
                    })
                    const body = await response.json().catch(() => null)
                    return { status: response.status, ok: response.ok, body }
                  },
                  { username: smokeUser, email: smokeEmail, password: smokePassword },
                )) as { status: number; ok: boolean; body: { token?: string } | null }
                console.log(
                  `[smoke-embedded] POST /auth/register → HTTP ${register.status} ok=${register.ok} token=${register.body?.token ? 'presente' : 'ausente'}`,
                )
                if (!register.ok || register.status !== 201) {
                  failures.push(
                    `POST /auth/register não respondeu 201 com token: ${JSON.stringify(register)}`,
                  )
                } else if (!register.body?.token) {
                  failures.push('POST /auth/register respondeu 201 mas sem token no corpo')
                }

                const login = (await page.evaluate(
                  async ({ identifier, password }) => {
                    const response = await fetch('/auth/login', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ identifier, password }),
                    })
                    const body = await response.json().catch(() => null)
                    return { status: response.status, ok: response.ok, body }
                  },
                  { identifier: smokeUser, password: smokePassword },
                )) as { status: number; ok: boolean; body: { token?: string } | null }
                console.log(
                  `[smoke-embedded] POST /auth/login → HTTP ${login.status} ok=${login.ok} token=${login.body?.token ? 'presente' : 'ausente'}`,
                )
                if (!login.ok || login.status !== 200) {
                  failures.push(`POST /auth/login não respondeu 200 com token: ${JSON.stringify(login)}`)
                } else if (!login.body?.token) {
                  failures.push('POST /auth/login respondeu 200 mas sem token no corpo')
                }

                const options = await page.evaluate(async () => {
                  const response = await fetch('/api/conversions/options')
                  return { status: response.status, ok: response.ok }
                })
                console.log(`[smoke-embedded] GET /api/conversions/options → HTTP ${options.status}`)
                if (!options.ok || options.status !== 200) {
                  failures.push(`/api/conversions/options não respondeu 200: ${JSON.stringify(options)}`)
                }
              }
            }
          } catch (err) {
            failures.push(
              `falha ao esperar o backend embedded sair de "starting": ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        } finally {
          if (app !== null) {
            try {
              await closeApp(app)
            } catch (err) {
              failures.push(`closeApp falhou: ${err instanceof Error ? err.message : String(err)}`)
            }
          }

          if (app !== null) {
            const postmasterPid = join(tmpUserData, 'pgdata', 'postmaster.pid')
            const pidDeadline = Date.now() + 15_000
            while (existsSync(postmasterPid) && Date.now() < pidDeadline) {
              await new Promise((resolve) => setTimeout(resolve, 500))
            }
            console.log(
              `[smoke-embedded] postmaster.pid ${existsSync(postmasterPid) ? 'AINDA existe' : 'ausente'} após quit`,
            )
            if (existsSync(postmasterPid)) {
              failures.push('postmaster.pid ainda existe — shutdown do Postgres embarcado não foi limpo (órfão)')
            }

            try {
              const orphans = probeOrphanProcesses(tmpUserData)
              console.log(
                `[smoke-embedded] processos órfãos detectados: ${orphans.length === 0 ? 'nenhum' : `\n${orphans.map((o) => `${o.name} (PID ${o.pid}): ${o.commandLine}`).join('\n')}`}`,
              )
              if (orphans.length > 0) {
                failures.push(
                  `processos órfãos sobreviveram ao quit: ${orphans.map((o) => `${o.name} (PID ${o.pid})`).join(', ')}`,
                )
              }
            } catch (err) {
              console.warn(
                '[smoke-embedded] consulta de processos órfãos indisponível (best effort) — ' +
                  (err instanceof Error ? err.message : String(err)),
              )
            }
          }

          await rm(tmpUserData, { recursive: true, force: true }).catch((err) => {
            console.warn(
              `[smoke-embedded] não foi possível remover o userData temporário (${tmpUserData}): ${
                err instanceof Error ? err.message : String(err)
              }`,
            )
          })
        }

        expect(failures, failures.join('\n')).toEqual([])
      },
      180_000,
    )
  },
)

describe.skipIf(!process.env.MI_SMOKE_FULL)('smoke full E2E — backend ready + frontend de login', () => {
  test(
    'backend fica ready, tela de login renderiza e proxy /api via app:// responde ok',
    async () => {
      const tmpUserData = await makeTempUserData('mangaink-smoke-full-')
      try {
        const app = await launchApp({ args: [`--user-data-dir=${tmpUserData}`] })
        try {
          const page = await app.firstWindow()
          await page.waitForLoadState('domcontentloaded', { timeout: 30_000 })

          await expect
            .poll(
              async () => (await readStatus(page)).state?.status,
              {
                timeout: 60_000,
                message:
                  'backend não ficou ready em 60s — suba Docker + PostgreSQL + Redis (pnpm docker:up) e rode com MI_SMOKE_FULL=1, ou rode sem Docker com MI_SMOKE_EMBEDDED=1 (modo embedded)',
              },
            )
            .toBe('ready')

          await expect
            .poll(
              async () => {
                const identifierInputs = await page.locator('#login-identifier').count()
                const body = (await page.textContent('body')) ?? ''
                return { identifierInputs, loginScreen: /Entrar|MangaInk/i.test(body) }
              },
              { timeout: 60_000, message: 'tela de login do frontend não renderizou após ready' },
            )
            .toMatchObject({ identifierInputs: 1 })

          const health = await page.evaluate(() =>
            fetch('/api/health').then((response) => response.json()),
          )
          console.log(`[smoke-full-e2e] GET /api/health → ${JSON.stringify(health)}`)
          expect(health).toMatchObject({ status: 'ok' })
        } finally {
          await closeApp(app)
        }
      } finally {
        await rm(tmpUserData, { recursive: true, force: true }).catch(() => undefined)
      }
    },
    150_000,
  )
})
