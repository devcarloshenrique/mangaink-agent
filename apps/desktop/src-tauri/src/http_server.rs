//! Servidor HTTP local (axum) — canal webview↔backend aprovado pelo líder
//! (MEC-14 · Task 1, após NO-GO do SPIKE MEC-15).
//!
//! Em produção a origem da janela é `http://127.0.0.1:{porta}/`; este servidor:
//!   1. Serve os assets estáticos do frontend.
//!   2. Faz proxy de `/api/*`, `/auth/*`, `/users/*` para o backend local
//!      (`http://127.0.0.1:{backend_port}`) preservando método/headers/body,
//!      com streaming real de SSE via reqwest (resposta sem buffer).
//!   3. SPA fallback → `index.html`.
//!   4. Rota `/__status` serve o status screen HTML (Task 8).
//!
//! Escolha axum vs hyper: **axum** — camada de roteamento ergonômica sobre
//! hyper/tower/tokio, `Router` com wildcards `{*path}`, integração natural com
//! `Body::from_stream` (SSE) e ecossistema maduro. Hyper puro exigiria
//! roteamento e parsing de conexão à mão para o mesmo resultado.
//!
//! Esta task: scaffold + esboço funcional das rotas. Orquestração de boot,
//! navegação da janela e estado do backend são Tasks 5/6.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderValue, Request as HttpRequest, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get};
use axum::Router;
use futures_util::StreamExt;
use tokio::net::TcpListener;
use tracing::{error, info, warn};

/// Máximo de bytes aceitos no corpo de requisições de proxy.
const MAX_BODY_BYTES: usize = 64 * 1024 * 1024;

/// Mapa de MIME mínimo (paridade com o `DEFAULT_MIME_MAP` do Electron).
const DEFAULT_MIME_MAP: &[(&str, &str)] = &[
    ("html", "text/html; charset=utf-8"),
    ("js", "text/javascript"),
    ("mjs", "text/javascript"),
    ("css", "text/css"),
    ("json", "application/json"),
    ("map", "application/json"),
    ("png", "image/png"),
    ("webp", "image/webp"),
    ("gif", "image/gif"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("ico", "image/x-icon"),
    ("svg", "image/svg+xml"),
    ("woff2", "font/woff2"),
    ("ttf", "font/ttf"),
    ("otf", "font/otf"),
    ("txt", "text/plain"),
];

fn mime_for_path(path: &std::path::Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    let mime = ext
        .as_deref()
        .and_then(|e| DEFAULT_MIME_MAP.iter().find(|(k, _)| *k == e))
        .map(|(_, v)| *v);
    mime.unwrap_or("application/octet-stream")
}

/// Estado compartilhado do servidor HTTP local.
#[derive(Clone)]
pub struct HttpServerState {
    /// Diretório raiz dos assets estáticos do frontend.
    pub frontend_dir: PathBuf,
    /// Porta do backend local (definida em runtime pelo backend_manager).
    pub backend_port: u16,
    /// Client HTTP reutilizado pelo proxy (requer features `json` e `stream`).
    pub client: reqwest::Client,
    /// Estado atual do backend (publicado pelo backend_manager; consumido pelo
    /// status screen `/__status`).
    pub status: Arc<CurrentStatus>,
}

/// Snapshot do estado do backend compartilhado entre o manager e o status screen.
#[derive(Debug, Default, Clone)]
pub struct CurrentStatus {
    pub state: Arc<std::sync::RwLock<String>>,
    pub message: Arc<std::sync::RwLock<String>>,
    pub stderr: Arc<std::sync::RwLock<String>>,
    pub version: Arc<std::sync::RwLock<String>>,
}

impl CurrentStatus {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set(&self, state: &str, message: &str, stderr: &str) {
        *self.state.write().unwrap() = state.to_string();
        *self.message.write().unwrap() = message.to_string();
        *self.stderr.write().unwrap() = stderr.to_string();
    }

    pub fn set_version(&self, version: &str) {
        *self.version.write().unwrap() = version.to_string();
    }

    pub fn snapshot(&self) -> (String, String, String, String) {
        (
            self.state.read().unwrap().clone(),
            self.message.read().unwrap().clone(),
            self.stderr.read().unwrap().clone(),
            self.version.read().unwrap().clone(),
        )
    }
}

/// Informação retornada ao subir o servidor.
pub struct LocalHttpServer {
    pub addr: SocketAddr,
}

/// Sobe o servidor HTTP local em `127.0.0.1:{porta}`.
///
/// A porta é escolhida via `portpicker` (porta livre) — paridade com a decisão
/// D1/parent de nunca assumir porta fixa. Retorna a porta efetiva no `addr`.
pub async fn start(
    state: HttpServerState,
    pick_port: Option<u16>,
) -> Result<LocalHttpServer, Box<dyn std::error::Error>> {
    let port = match pick_port {
        Some(p) => p,
        None => portpicker::pick_unused_port().ok_or("no free port available")?,
    };
    let bind_addr = SocketAddr::from(([127, 0, 0, 1], port));

    let app = build_router(state);
    let listener = TcpListener::bind(bind_addr).await?;
    let addr = listener.local_addr()?;
    info!(%addr, "local http server listening");

    let _handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!(?e, "local http server stopped with error");
        }
    });

    Ok(LocalHttpServer { addr })
}

/// Monta o `Router` com todas as rotas do servidor local.
pub fn build_router(state: HttpServerState) -> Router {
    Router::new()
        .route("/api/{*path}", any(proxy_api))
        .route("/auth/{*path}", any(proxy_api))
        .route("/users/{*path}", any(proxy_api))
        .route("/__status", get(status_screen))
        .fallback(static_handler)
        .with_state(state)
}

/// Proxy transparente de `/api/*`, `/auth/*`, `/users/*` para o backend local.
///
/// Preserva método, headers e body. Para SSE (`text/event-stream`) o corpo da
/// resposta é devolvido como stream (`reqwest` `bytes_stream` → `Body`), sem
/// buffering — o canal aprovado na MEC-15.
async fn proxy_api(
    State(state): State<HttpServerState>,
    req: HttpRequest<Body>,
) -> Response {
    let method = req.method().clone();
    let path_and_query = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/")
        .to_string();
    let target = format!("http://127.0.0.1:{}{}", state.backend_port, path_and_query);

    let mut builder = state.client.request(method, &target);

    for (name, value) in req.headers().iter() {
        let lower = name.as_str().to_ascii_lowercase();
        if matches!(
            lower.as_str(),
            "host" | "content-length" | "transfer-encoding" | "connection"
        ) {
            continue;
        }
        builder = builder.header(name.as_str(), value.as_bytes());
    }

    // Corpo da requisição (buffer — aceitável; proxy de upload fica para Tasks 5/6).
    let body_bytes = match axum::body::to_bytes(req.into_body(), MAX_BODY_BYTES).await {
        Ok(b) => b,
        Err(e) => {
            warn!(?e, "proxy: failed to read request body");
            return (
                StatusCode::BAD_REQUEST,
                "failed to read request body".to_string(),
            )
                .into_response();
        }
    };
    if !body_bytes.is_empty() {
        builder = builder.body(body_bytes);
    }

    let resp = match builder.send().await {
        Ok(r) => r,
        Err(e) => {
            error!(?e, target, "proxy: upstream request failed");
            return (
                StatusCode::BAD_GATEWAY,
                format!("upstream request failed: {e}"),
            )
                .into_response();
        }
    };

    let status = resp.status();
    let resp_headers = resp.headers().clone();

    // Corpo como stream (sem buffer) — crítico para SSE.
    let stream = resp
        .bytes_stream()
        .map(|chunk| chunk.map_err(std::io::Error::other));
    let body = Body::from_stream(stream);

    let mut response_builder = Response::builder().status(status);
    for (name, value) in resp_headers.iter() {
        let lower = name.as_str().to_ascii_lowercase();
        if matches!(lower.as_str(), "transfer-encoding" | "connection" | "content-length") {
            continue;
        }
        response_builder = response_builder.header(name.as_str(), value.as_bytes());
    }

    response_builder
        .body(body)
        .map_err(|e| {
            error!(?e, "proxy: failed to build response");
            StatusCode::INTERNAL_SERVER_ERROR
        })
        .into_response()
}

/// Serve os assets estáticos do frontend com SPA fallback para `index.html`.
///
/// Path traversal protegido: resolve o arquivo dentro de `frontend_dir`.
async fn static_handler(
    State(state): State<HttpServerState>,
    uri: Uri,
) -> Response {
    let decoded = match percent_encoding::percent_decode_str(uri.path())
        .decode_utf8()
    {
        Ok(s) => s.to_string(),
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid path encoding").into_response(),
    };
    let relative = decoded.trim_start_matches('/');
    let candidate = state.frontend_dir.join(relative);

    if !is_within(&candidate, &state.frontend_dir) {
        warn!(path = %candidate.display(), "static: path traversal blocked");
        return (StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    // SPA fallback: qualquer rota sem arquivo físico retorna index.html.
    let file = if candidate.is_dir() {
        candidate.join("index.html")
    } else {
        candidate
    };

    match tokio::fs::read(&file).await {
        Ok(data) => {
            let content_type = mime_for_path(&file);
            let mut resp = Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .body(Body::from(data))
                .unwrap();
            if content_type.starts_with("text/") {
                resp.headers_mut().insert(
                    header::CACHE_CONTROL,
                    HeaderValue::from_static("no-cache"),
                );
            }
            resp
        }
        Err(_) => {
            // Fallback SPA: tenta index.html na raiz do frontend.
            let index = state.frontend_dir.join("index.html");
            match tokio::fs::read(&index).await {
                Ok(data) => Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                    .body(Body::from(data))
                    .unwrap(),
                Err(e) => {
                    warn!(path = %index.display(), ?e, "static: index.html not found");
                    (
                        StatusCode::NOT_FOUND,
                        format!("{} not found", index.display()),
                    )
                        .into_response()
                }
            }
        }
    }
}

/// Status screen HTML completo (pt-BR, pop-art), renderizado com o estado atual
/// do backend e com IPC do Tauri injetado inline (Task 8 / D3).
async fn status_screen(State(state): State<HttpServerState>) -> Response {
    let (status, message, stderr, version) = state.status.snapshot();
    let html = crate::status_screen::render_status_html(&status, &message, &stderr, &version);
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .header(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"))
        .body(Body::from(html))
        .unwrap()
}

/// Verifica se `path` está dentro do diretório `root`.
///
/// Primeiro faz uma checagem lexical (resolve `.`/`..`) — cobre caminhos que
/// ainda não existem no disco (rotas SPA). Se ambos existirem, confirma com
/// `canonicalize` (resolve symlinks/8.3 no Windows) para bloquear escapes.
fn is_within(path: &std::path::Path, root: &std::path::Path) -> bool {
    let path_lex = lexical_normalize(path);
    let root_lex = lexical_normalize(root);
    if !(path_lex.starts_with(&root_lex)) {
        return false;
    }
    if let (Ok(root_c), Ok(path_c)) = (std::fs::canonicalize(root), std::fs::canonicalize(path)) {
        return path_c.starts_with(&root_c);
    }
    true
}

/// Normaliza um path lexicalmente (resolve `.`/`..`) sem tocar no filesystem.
fn lexical_normalize(path: &std::path::Path) -> std::path::PathBuf {
    use std::path::Component;

    let mut out = std::path::PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    out.push(component.as_os_str());
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mime_map_returns_default() {
        assert_eq!(mime_for_path(std::path::Path::new("a.bin")), "application/octet-stream");
        assert_eq!(mime_for_path(std::path::Path::new("index.html")), "text/html; charset=utf-8");
    }

    #[test]
    fn is_within_allows_children_and_blocks_escape() {
        let root = std::path::PathBuf::from("C:/tmp/frontend");
        assert!(is_within(&root.join("index.html"), &root));
        assert!(is_within(&root.join("assets/app.js"), &root));
        assert!(!is_within(&root.join("../secret.txt"), &root));
        assert!(!is_within(&std::path::PathBuf::from("C:/tmp/frontend-other/x"), &root));
    }

    #[test]
    fn socket_addr_parses() {
        let addr = SocketAddr::from(([127, 0, 0, 1], 1234));
        assert_eq!(addr.port(), 1234);
    }

    #[tokio::test]
    async fn serves_static_and_proxy_route() {
        let frontend_dir = std::env::temp_dir().join(format!("mangaink-test-{}", std::process::id()));
        std::fs::create_dir_all(&frontend_dir).unwrap();
        std::fs::write(frontend_dir.join("index.html"), b"<html>ok</html>").unwrap();

        let state = super::HttpServerState {
            frontend_dir,
            backend_port: 1, // porta inválida → proxy deve responder 502
            client: reqwest::Client::new(),
            status: Arc::new(super::CurrentStatus::new()),
        };
        let server = super::start(state, None).await.unwrap();
        let base = format!("http://{}", server.addr);

        // Asset estático
        let resp = reqwest::get(format!("{base}/")).await.unwrap();
        assert_eq!(resp.status(), 200);
        assert_eq!(resp.text().await.unwrap(), "<html>ok</html>");

        // SPA fallback
        let resp = reqwest::get(format!("{base}/some/spa/route")).await.unwrap();
        assert_eq!(resp.status(), 200);

        // Rota de proxy existe e falha com 502 (backend não está no ar)
        let resp = reqwest::get(format!("{base}/api/health")).await.unwrap();
        assert_eq!(resp.status(), 502);
    }
}
