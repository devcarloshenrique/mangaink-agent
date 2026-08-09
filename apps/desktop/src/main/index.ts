import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron'
import { execFile, spawn } from 'node:child_process'
import { join } from 'node:path'
import { createAppProtocolHandler } from './app-protocol'
import { createBackendManager, type BackendManager, type BackendState } from './backend-manager'
import { resolveEmbeddedMode } from './embedded-mode'
import { createPostgresManager } from './postgres-manager'
import { createSettingsStore, type SettingsStore } from './settings-store'
import { renderStatusScreenHtml, getStateStderr, resolveScreenAction } from './status-screen'

// Padroniza o userData para %APPDATA%/MangaInk Agent (alinhado ao settings-store e
// à status screen), independente do nome do package.json (@mangaink/desktop).
// MI_SMOKE_E2E=1 (smoke e2e) preserva o isolamento via --user-data-dir próprio.
if (process.env.MI_SMOKE_E2E !== '1') {
  app.setPath('userData', join(app.getPath('appData'), 'MangaInk Agent'))
}

// Registra o esquema customizado `app://` como standard/secure ANTES do app ficar
// pronto (obrigatório: registerSchemesAsPrivileged precisa rodar antes de
// app.whenReady). Sem `standard: true`, o Chromium trata app://bundle como uma
// origem não-standard e NEGA localStorage/sessionStorage no renderer — o que
// quebra o frontend empacotado (SecurityError no ErrorBoundary). `supportFetchAPI`
// garante que fetch('/api/...') relativo do renderer resolva via protocol.handle.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const DEV_RENDERER_URL = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173'
// Carrega a SPA na raiz (sem `index.html` no path): o TanStack Router lê
// location.pathname, e `/index.html` não casa com a rota `/` — renderizaria a
// notFoundComponent (404) no app empacotado. O protocol handler já mapeia `/` → index.html.
const PROD_RENDERER_URL = 'app://bundle/'
const QUIT_TIMEOUT_MS = 8_000

let mainWindow: BrowserWindow | null = null
let backend: BackendManager | null = null
let settingsStore: SettingsStore | null = null
let quitting = false

function statusDataUrl(state: BackendState): string {
  const current = settingsStore!.get()
  const logs = backend!.getLogs()
  const html = renderStatusScreenHtml(state, {
    version: app.getVersion(),
    backendUrl: `http://localhost:${current.backendPort}`,
    stderr: getStateStderr(state) ?? logs.stderr,
  })
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedPrefix = app.isPackaged ? 'app://' : DEV_RENDERER_URL
    if (url.startsWith(allowedPrefix)) return
    event.preventDefault()
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
  })

  const current = backend!.getState()
  const frontendUrl = app.isPackaged ? PROD_RENDERER_URL : DEV_RENDERER_URL
  if (resolveScreenAction(current) === 'frontend') {
    void mainWindow.loadURL(frontendUrl)
  } else {
    void mainWindow.loadURL(statusDataUrl(current))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    }
  })

  void app.whenReady().then(async () => {
    settingsStore = createSettingsStore({
      filePath: join(app.getPath('userData'), 'settings.json'),
    })
    await settingsStore.load()

    if (app.isPackaged) {
      const { net } = await import('electron')
      protocol.handle(
        'app',
        createAppProtocolHandler({
          netFetch: net.fetch as typeof fetch,
          frontendDir: join(process.resourcesPath, 'frontend'),
          backendPort: async () => settingsStore!.get().backendPort,
        }),
      )
    }

    const embedded = resolveEmbeddedMode({
      isPackaged: app.isPackaged,
      envFlag: process.env.MI_EMBEDDED_MODE,
    })

    const runtimePath = app.isPackaged
      ? join(process.resourcesPath, 'runtime')
      : join(app.getAppPath(), 'resources', 'runtime')

    backend = createBackendManager({
      spawn,
      execFile,
      fetch: globalThis.fetch,
      settings: settingsStore,
      resourcesBackendPath: app.isPackaged
        ? join(process.resourcesPath, 'backend')
        : join(app.getAppPath(), '..', 'backend'),
      storagePath: join(app.getPath('userData'), 'storage'),
      runtimePath,
      embedded,
      postgres: embedded
        ? createPostgresManager({
            execFile,
            spawn,
            runtimePostgresBin: join(runtimePath, 'postgres', 'bin'),
            dataDir: join(app.getPath('userData'), 'pgdata'),
            port: settingsStore.getManagedPostgresPort(),
          })
        : undefined,
      nodeBin: app.isPackaged ? process.execPath : 'node',
    })

    backend.onStateChange((state) => {
      if (mainWindow === null || mainWindow.isDestroyed()) return
      const frontendUrl = app.isPackaged ? PROD_RENDERER_URL : DEV_RENDERER_URL
      if (resolveScreenAction(state) === 'frontend') {
        void mainWindow.loadURL(frontendUrl)
      } else {
        void mainWindow.loadURL(statusDataUrl(state))
      }
    })

    ipcMain.handle('desktop:get-status', () => ({
      state: backend!.getState(),
      logs: backend!.getLogs(),
    }))
    ipcMain.handle('desktop:retry', async () => {
      const current = backend!.getState()
      if (
        current.status === 'prereq_failed' ||
        current.status === 'postgres_failed' ||
        current.status === 'migration_failed' ||
        current.status === 'backend_failed'
      ) {
        await backend!.restart()
      }
      return backend!.getState()
    })
    ipcMain.handle('desktop:open-logs', () => shell.openPath(app.getPath('userData')))
    ipcMain.handle('desktop:open-external', (_event, url: unknown) => {
      if (typeof url === 'string' && /^https?:\/\//.test(url)) {
        void shell.openExternal(url)
      }
    })
    ipcMain.handle('desktop:get-version', () => app.getVersion())

    createWindow()

    await backend.start()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    quitting = true
    if (backend === null) {
      app.exit(0)
      return
    }
    event.preventDefault()
    const stopPromise = backend.stop()
    const safety = new Promise<void>((resolve) => {
      setTimeout(resolve, QUIT_TIMEOUT_MS)
    })
    void Promise.race([stopPromise, safety]).then(() => {
      app.exit(0)
    })
  })
}
