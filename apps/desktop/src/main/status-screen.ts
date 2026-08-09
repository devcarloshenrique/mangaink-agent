import type { BackendState } from './backend-manager'

export type ScreenAction = 'status' | 'frontend'

export interface StatusScreenOptions {
  message?: string
  stderr?: string
  version?: string
  backendUrl?: string
}

const STATUS_TITLES: Record<BackendState['status'], string> = {
  idle: 'Inativo',
  starting: 'Iniciando...',
  prereq_failed: 'Pré-requisitos ausentes',
  postgres_failed: 'PostgreSQL embarcado falhou',
  migration_failed: 'Falha nas migrações do banco',
  backend_failed: 'Backend falhou',
  ready: 'Pronto',
}

const STATUS_DESCRIPTIONS: Record<BackendState['status'], string> = {
  idle: 'O app ainda não iniciou o backend.',
  starting:
    'O backend está iniciando. Verificações de pré-requisitos e migrações do banco de dados em andamento.',
  prereq_failed:
    'Alguns pré-requisitos não foram detectados. Instale e inicie o Docker Desktop e suba os containers do banco com `pnpm docker:up`. Verifique também se o PostgreSQL e o Redis estão acessíveis.',
  postgres_failed:
    'O PostgreSQL embarcado não iniciou. Verifique se os arquivos de runtime estão íntegros (resources/runtime) e tente novamente. Se persistir, reinstale o app.',
  migration_failed:
    'As migrações do banco de dados falharam. Verifique se o PostgreSQL está acessível e se a DATABASE_URL configurada em settings.json está correta.',
  backend_failed:
    'O processo do backend encerrou inesperadamente ou não respondeu no tempo limite. Confira o erro abaixo, abra os logs ou tente novamente.',
  ready: 'O backend está pronto e o frontend está carregando.',
}

const CACHE_BUSTER = 'v2'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function getStateStderr(state: BackendState): string | undefined {
  switch (state.status) {
    case 'prereq_failed':
    case 'postgres_failed':
    case 'migration_failed':
    case 'backend_failed':
      return state.stderr
    default:
      return undefined
  }
}

function stateMessage(state: BackendState): string {
  return state.status === 'idle' ? '' : state.message
}

export function resolveScreenAction(state: BackendState): ScreenAction {
  return state.status === 'ready' ? 'frontend' : 'status'
}

export function renderStatusScreenHtml(state: BackendState, options: StatusScreenOptions = {}): string {
  const title = STATUS_TITLES[state.status]
  const description = STATUS_DESCRIPTIONS[state.status]
  const message = options.message ?? stateMessage(state)
  const stderr = options.stderr ?? getStateStderr(state) ?? ''
  const version = options.version ?? ''
  const backendUrl = options.backendUrl ?? ''

  const logsBlock =
    stderr.trim() !== ''
      ? `      <h2>Saída do backend</h2>\n      <pre id="logs">${escapeHtml(stderr)}</pre>\n`
      : ''
  const browserLink =
    backendUrl !== ''
      ? `      <a id="browser" href="${escapeHtml(backendUrl)}" rel="noopener">Abrir no navegador</a>\n`
      : ''
  const versionLine = version !== '' ? `\n      <p class="version">v${escapeHtml(version)}</p>` : ''

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src https://fonts.gstatic.com; style-src-elem https://fonts.googleapis.com 'unsafe-inline'" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MangaInk Agent — ${escapeHtml(title)}</title>
    <style>
      :root {
        --comic-yellow: #f5c518;
        --comic-red: #e63946;
        --comic-blue: #1d3557;
        --comic-cream: #fff8e1;
        --comic-ink: #1d3557;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--comic-yellow);
        background-image:
          radial-gradient(circle at 20% 15%, rgba(29, 53, 87, 0.08) 0, rgba(29, 53, 87, 0.08) 24px, transparent 25px),
          radial-gradient(circle at 80% 85%, rgba(230, 57, 70, 0.10) 0, rgba(230, 57, 70, 0.10) 18px, transparent 19px);
        font-family: Inter, Arial, sans-serif;
        color: var(--comic-ink);
        padding: 24px;
      }
      .panel {
        width: min(560px, 100%);
        background: var(--comic-cream);
        border: 4px solid var(--comic-ink);
        border-radius: 16px;
        box-shadow: 10px 10px 0 rgba(29, 53, 87, 0.85);
        padding: 32px;
      }
      .badge {
        display: inline-block;
        background: var(--comic-red);
        color: #fff;
        font-family: Bangers, 'Arial Black', sans-serif;
        font-size: 16px;
        letter-spacing: 2px;
        padding: 4px 12px;
        border-radius: 6px;
        transform: rotate(-2deg);
        margin-bottom: 16px;
      }
      h1 {
        font-family: Bangers, 'Arial Black', sans-serif;
        font-size: 52px;
        line-height: 1;
        color: var(--comic-red);
        text-shadow: 3px 3px 0 var(--comic-yellow);
        letter-spacing: 1px;
      }
      .subtitle {
        font-family: Bangers, 'Arial Black', sans-serif;
        font-size: 26px;
        color: var(--comic-blue);
        margin: 8px 0 20px;
        letter-spacing: 1px;
      }
      .diagnosis {
        background: #fff;
        border: 2px dashed var(--comic-blue);
        border-radius: 10px;
        padding: 16px;
        font-size: 15px;
        line-height: 1.55;
      }
      .diagnosis .message {
        margin-top: 8px;
        font-weight: 600;
        color: var(--comic-red);
      }
      pre {
        margin-top: 16px;
        background: #1d3557;
        color: #b8e6ff;
        border-radius: 10px;
        padding: 14px;
        font-size: 12px;
        line-height: 1.5;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 220px;
        overflow-y: auto;
      }
      pre::-webkit-scrollbar { height: 8px; width: 8px; }
      pre::-webkit-scrollbar-thumb { background: #456; border-radius: 4px; }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        flex-wrap: wrap;
      }
      button, a.button {
        font-family: Bangers, 'Arial Black', sans-serif;
        font-size: 20px;
        letter-spacing: 1px;
        text-decoration: none;
        cursor: pointer;
        border: 3px solid var(--comic-ink);
        border-radius: 10px;
        padding: 10px 20px;
        box-shadow: 4px 4px 0 var(--comic-ink);
        transition: transform 80ms ease, box-shadow 80ms ease;
      }
      button:active, a.button:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--comic-ink); }
      button {
        background: var(--comic-red);
        color: #fff;
      }
      a.button {
        background: var(--comic-yellow);
        color: var(--comic-ink);
      }
      .version {
        margin-top: 20px;
        text-align: right;
        font-size: 12px;
        color: #6a7f9e;
      }
      .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        margin-left: 8px;
        border: 3px solid rgba(255, 255, 255, 0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 700ms linear infinite;
        vertical-align: -2px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main class="panel">
      <header>
        <span class="badge">MANGAINK AGENT</span>
        <h1>MangaInk Agent</h1>
        <p class="subtitle">${escapeHtml(title)}${state.status === 'starting' ? '<span class="spinner"></span>' : ''}</p>
      </header>
      <section class="diagnosis">
        <p>${escapeHtml(description)}</p>
        ${message !== '' ? `<p class="message">${escapeHtml(message)}</p>` : ''}
      </section>
${logsBlock}      <footer class="actions">
        <button id="retry" type="button">Tentar novamente</button>
${browserLink}      </footer>
${versionLine}
    </main>
    <script>
      document.getElementById('retry')?.addEventListener('click', () => {
        window.desktop.retry()
      })
      const browserLink = document.getElementById('browser')
      browserLink?.addEventListener('click', (event) => {
        event.preventDefault()
        window.desktop.openExternal(browserLink.getAttribute('href'))
      })
    </script>
  </body>
</html>
`
}
