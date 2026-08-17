//! `status_screen` — port Rust de `apps/desktop/src/main/status-screen.ts` (MEC-14 · Task 8).
//!
//! HTML standalone (pt-BR, pop-art) exibido enquanto o backend não está pronto
//! (`starting`, `postgres_failed`, `migration_failed`, `backend_failed`, ...).
//!
//! Decisões (D3):
//! - **Carregado via servidor HTTP local** (`GET /__status`), nunca `data:` URL
//!   (bloqueada pela CSP padrão do webview).
//! - **IPC do Tauri injetado inline**: substitui `window.desktop.retry()` /
//!   `window.desktop.openExternal()` por `window.__TAURI_INTERNALS__.invoke(...)`
//!   (presente no webview do Tauri v2 por padrão).
//! - **Reage a eventos `backend-state`** emitidos pelo Rust: o HTML se auto-renderiza
//!   e, quando o estado vira `ready`, recarrega a origem (a boot sequence navega a
//!   janela para o frontend). O botão "Tentar novamente" chama o comando `retry`.

/// Escapa HTML (paridade com `escapeHtml` do TS).
fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn status_title(state: &str) -> &'static str {
    match state {
        "idle" => "Inativo",
        "starting" => "Iniciando...",
        "prereq_failed" => "Pré-requisitos ausentes",
        "postgres_failed" => "PostgreSQL embarcado falhou",
        "migration_failed" => "Falha nas migrações do banco",
        "backend_failed" => "Backend falhou",
        _ => "Pronto",
    }
}

fn status_description(state: &str) -> &'static str {
    match state {
        "idle" => "O app ainda não iniciou o backend.",
        "starting" => "O backend está iniciando. Verificações de pré-requisitos e migrações do banco de dados em andamento.",
        "prereq_failed" => "Alguns pré-requisitos não foram detectados. Verifique o ambiente e tente novamente.",
        "postgres_failed" => "O PostgreSQL embarcado não iniciou. Verifique se os arquivos de runtime estão íntegros (resources/runtime) e tente novamente.",
        "migration_failed" => "As migrações do banco de dados falharam. Verifique o PostgreSQL e a DATABASE_URL em settings.json.",
        "backend_failed" => "O processo do backend encerrou inesperadamente ou não respondeu no tempo limite. Confira o erro abaixo, abra os logs ou tente novamente.",
        _ => "O backend está pronto.",
    }
}

/// Renderiza o status screen HTML.
///
/// `state` e `message`/`stderr` são injetados server-side no primeiro paint; o
/// inline script se auto-atualiza reagindo a `backend-state` (IPC do Tauri).
pub fn render_status_html(
    state: &str,
    message: &str,
    stderr: &str,
    version: &str,
) -> String {
    let title = status_title(state);
    let description = status_description(state);
    let spinner = if state == "starting" {
        r#"<span class="spinner"></span>"#
    } else {
        ""
    };
    let logs_block = if !stderr.trim().is_empty() {
        format!(
            "      <h2>Saída do backend</h2>\n      <pre id=\"logs\">{}</pre>\n",
            escape_html(stderr)
        )
    } else {
        String::new()
    };
    let message_block = if !message.is_empty() {
        format!(
            "<p class=\"message\">{}</p>",
            escape_html(message)
        )
    } else {
        String::new()
    };
    let version_line = if !version.is_empty() {
        format!("\n      <p class=\"version\">v{}</p>", escape_html(version))
    } else {
        String::new()
    };

    format!(
        r#"<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MangaInk Agent — {title}</title>
    <style>
      :root {{
        --comic-yellow: #f5c518;
        --comic-red: #e63946;
        --comic-blue: #1d3557;
        --comic-cream: #fff8e1;
        --comic-ink: #1d3557;
      }}
      * {{ box-sizing: border-box; margin: 0; padding: 0; }}
      body {{
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
      }}
      .panel {{
        width: min(560px, 100%);
        background: var(--comic-cream);
        border: 4px solid var(--comic-ink);
        border-radius: 16px;
        box-shadow: 10px 10px 0 rgba(29, 53, 87, 0.85);
        padding: 32px;
      }}
      .badge {{
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
      }}
      h1 {{
        font-family: Bangers, 'Arial Black', sans-serif;
        font-size: 52px;
        line-height: 1;
        color: var(--comic-red);
        text-shadow: 3px 3px 0 var(--comic-yellow);
        letter-spacing: 1px;
      }}
      .subtitle {{
        font-family: Bangers, 'Arial Black', sans-serif;
        font-size: 26px;
        color: var(--comic-blue);
        margin: 8px 0 20px;
        letter-spacing: 1px;
      }}
      .diagnosis {{
        background: #fff;
        border: 2px dashed var(--comic-blue);
        border-radius: 10px;
        padding: 16px;
        font-size: 15px;
        line-height: 1.55;
      }}
      .diagnosis .message {{
        margin-top: 8px;
        font-weight: 600;
        color: var(--comic-red);
      }}
      pre {{
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
      }}
      pre::-webkit-scrollbar {{ height: 8px; width: 8px; }}
      pre::-webkit-scrollbar-thumb {{ background: #456; border-radius: 4px; }}
      .actions {{
        display: flex;
        gap: 12px;
        margin-top: 24px;
        flex-wrap: wrap;
      }}
      button, a.button {{
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
      }}
      button:active, a.button:active {{ transform: translate(2px, 2px); box-shadow: 2px 2px 0 var(--comic-ink); }}
      button {{ background: var(--comic-red); color: #fff; }}
      a.button {{ background: var(--comic-yellow); color: var(--comic-ink); }}
      .version {{ margin-top: 20px; text-align: right; font-size: 12px; color: #6a7f9e; }}
      .spinner {{
        display: inline-block;
        width: 14px;
        height: 14px;
        margin-left: 8px;
        border: 3px solid rgba(255, 255, 255, 0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 700ms linear infinite;
        vertical-align: -2px;
      }}
      @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    </style>
  </head>
  <body>
    <main class="panel">
      <header>
        <span class="badge">MANGAINK AGENT</span>
        <h1>MangaInk Agent</h1>
        <p class="subtitle">{title}{spinner}</p>
      </header>
      <section class="diagnosis">
        <p>{description}</p>
        {message_block}
      </section>
{logs_block}      <footer class="actions">
        <button id="retry" type="button">Tentar novamente</button>
        <a id="browser" class="button" href="{backend_url}" rel="noopener">Abrir no navegador</a>
      </footer>
{version_line}
    </main>
    <script>
      // IPC do Tauri injetado inline (D3): window.__TAURI_INTERNALS__ existe
      // no webview do Tauri v2. Fallback seguro se não estiver presente.
      function invoke(cmd, args) {{
        const internals = window.__TAURI_INTERNALS__;
        if (internals && typeof internals.invoke === 'function') {{
          return internals.invoke(cmd, args || {{}});
        }}
        return Promise.reject(new Error('IPC do Tauri não disponível'));
      }}

      function renderState(status, message, stderr) {{
        const titles = {{
          idle: 'Inativo', starting: 'Iniciando...',
          prereq_failed: 'Pré-requisitos ausentes', postgres_failed: 'PostgreSQL embarcado falhou',
          migration_failed: 'Falha nas migrações do banco', backend_failed: 'Backend falhou',
          ready: 'Pronto',
        }};
        const descs = {{
          idle: 'O app ainda não iniciou o backend.',
          starting: 'O backend está iniciando. Verificações de pré-requisitos e migrações em andamento.',
          prereq_failed: 'Alguns pré-requisitos não foram detectados. Verifique o ambiente e tente novamente.',
          postgres_failed: 'O PostgreSQL embarcado não iniciou. Verifique os arquivos de runtime e tente novamente.',
          migration_failed: 'As migrações do banco de dados falharam. Verifique o PostgreSQL e a DATABASE_URL.',
          backend_failed: 'O processo do backend encerrou inesperadamente ou não respondeu no tempo limite.',
          ready: 'O backend está pronto.',
        }};
        const subtitle = document.querySelector('.subtitle');
        if (subtitle) {{
          const spinner = status === 'starting' ? '<span class="spinner"></span>' : '';
          subtitle.innerHTML = (titles[status] || status) + spinner;
        }}
        const diag = document.querySelector('.diagnosis p:first-child');
        if (diag) diag.textContent = descs[status] || status;
        const msg = document.querySelector('.diagnosis .message');
        if (msg) {{
          if (message) {{ msg.textContent = message; msg.style.display = ''; }}
          else msg.style.display = 'none';
        }}
        const logs = document.getElementById('logs');
        if (logs) {{
          if (stderr) {{ logs.textContent = stderr; logs.style.display = ''; }}
          else logs.style.display = 'none';
        }}
        document.title = 'MangaInk Agent — ' + (titles[status] || status);

        // quando o backend ficou pronto, a boot sequence já navegou a janela;
        // aqui apenas garantimos um reload de segurança.
        if (status === 'ready') {{
          setTimeout(() => window.location.reload(), 500);
        }}
      }}

      document.getElementById('retry')?.addEventListener('click', () => {{
        invoke('retry').catch((e) => console.error('retry falhou', e));
      }});
      const browserLink = document.getElementById('browser');
      browserLink?.addEventListener('click', (event) => {{
        event.preventDefault();
        invoke('open_external', {{ url: browserLink.getAttribute('href') }})
          .catch((e) => console.error('open_external falhou', e));
      }});

      // Reage a eventos backend-state emitidos pelo Rust (Task 6).
      // O Tauri v2 injeta __TAURI_INTERNALS__.transformCallback + postMessage.
      (function listenBackendState() {{
        const internals = window.__TAURI_INTERNALS__;
        if (!internals || typeof internals.transformCallback !== 'function' || typeof internals.postMessage !== 'function') {{
          console.warn('IPC de eventos não disponível — sem atualização automática');
          return;
        }}
        const handlerId = internals.transformCallback((event) => {{
          const payload = event.payload;
          if (payload && typeof payload === 'object') {{
            renderState(payload.status, payload.message || '', payload.stderr || '');
          }} else if (typeof payload === 'string') {{
            renderState(payload, '', '');
          }}
        }});
        internals.postMessage({{ cmd: 'plugin:event|listen', event: 'backend-state', handler: handlerId }});
      }})();
    </script>
  </body>
</html>
"#,
        title = escape_html(title),
        description = escape_html(description),
        spinner = spinner,
        message_block = message_block,
        logs_block = logs_block,
        backend_url = "/", // janela já aponta para o servidor local; "Abrir no navegador" usa a origem
        version_line = version_line,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_nao_ready_inclui_spinner_e_titulo() {
        let html = render_status_html("starting", "Iniciando backend...", "", "");
        assert!(html.contains("Iniciando..."));
        assert!(html.contains("spinner"));
    }

    #[test]
    fn render_ready_sem_spinner() {
        let html = render_status_html("ready", "", "", "");
        // O spinner renderizado server-side fica no <p class="subtitle">; o
        // script contém a string (para re-render dinâmico), então inspecionamos
        // a linha do subtítulo.
        let subtitle_line = html
            .lines()
            .find(|l| l.contains("class=\"subtitle\""))
            .unwrap();
        assert!(!subtitle_line.contains("<span class=\"spinner\">"));
        assert!(subtitle_line.contains("Pronto"));
    }

    #[test]
    fn escape_html_escapa_caracteres() {
        assert_eq!(escape_html("<b>&\"'\""), "&lt;b&gt;&amp;&quot;&#39;&quot;");
    }

    #[test]
    fn render_include_titulo_acoes_e_ipc() {
        let html = render_status_html("starting", "Iniciando backend...", "", "0.1.0");
        assert!(html.contains("Iniciando..."));
        assert!(html.contains("Tentar novamente"));
        assert!(html.contains("__TAURI_INTERNALS__"));
        assert!(html.contains("backend-state"));
        assert!(html.contains("v0.1.0"));
    }

    #[test]
    fn render_include_logs_quando_stderr() {
        let html = render_status_html("backend_failed", "", "ERRO: porta ocupada", "");
        assert!(html.contains("ERRO: porta ocupada"));
    }
}
