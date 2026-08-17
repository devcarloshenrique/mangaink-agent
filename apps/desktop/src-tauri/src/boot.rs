//! `boot` — sequência de boot do shell desktop (MEC-14 · Task 6).
//!
//! Orquestra: settings → modo embedded → Postgres embarcado → migrações →
//! spawn do backend → health-poll → servidor HTTP local (axum) → navegação da
//! janela para `http://127.0.0.1:{porta}/` → emissão de `backend-state`/
//! `backend-logs`.
//!
//! Também expõe os serviços gerenciados ([`BootServices`]) consumidos pelos
//! comandos IPC (Task 6) e o path resolution empacotado vs dev.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;

use tauri::{Emitter, Manager};
use tracing::{error, info, warn};

use crate::backend_manager::{BackendManager, BackendManagerOptions};
use crate::embedded_mode::{resolve_embedded_mode, ResolveEmbeddedModeOptions};
use crate::http_server::{self, HttpServerState};
use crate::postgres_manager::{PostgresManager, PostgresManagerOptions};
use crate::settings_store::SettingsStore;

/// Paths do shell resolvidos para empacotado vs dev.
#[derive(Debug, Clone)]
pub struct BootPaths {
    /// Diretório de assets estáticos do frontend.
    pub frontend_dir: PathBuf,
    /// Diretório do bundle do backend (`dist/app.js`, `node_modules/prisma`).
    pub resources_backend_path: PathBuf,
    /// Raiz do runtime embutido (`postgres`, `python`, `kcc`, ...).
    pub runtime_path: Option<PathBuf>,
    /// Binário node (resource `node/node.exe` no embedded; `node` em dev).
    pub node_bin: PathBuf,
    /// Diretório de dados do app (`%APPDATA%/com.mangaink.desktop`, via
    /// `app_data_dir()` nativo do Tauri).
    pub data_dir: PathBuf,
}

impl BootPaths {
    /// Resolve os paths do shell. `resource_dir` é `app.path().resource_dir()`
    /// (empacotado); em dev usamos o workspace relativo ao manifesto do crate.
    ///
    /// Detecção empacotado vs dev: em `cargo run` o `resource_dir()` resolve para
    /// `target/debug`, que não contém o layout empacotado (`frontend/`, `backend/`,
    /// `runtime/`). Só usamos o resource_dir quando o layout empacotado existe.
    pub fn resolve(resource_dir: Option<&std::path::Path>, data_dir: PathBuf) -> Self {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let repo_root = manifest.join("../../..");

        let packaged = resource_dir
            .map(|res| {
                res.join("frontend").is_dir() || res.join("backend").is_dir() || res.join("runtime").is_dir()
            })
            .unwrap_or(false);

        let (resources_backend_path, runtime_path, node_bin, frontend_dir) = if packaged {
            let res = resource_dir.expect("packaged exige resource_dir");
            (
                res.join("backend"),
                Some(res.join("runtime")),
                res.join("node").join("node.exe"),
                res.join("frontend"),
            )
        } else {
            // Dev: bundle preparado (`apps/desktop/resources/backend`) quando
            // existir (contém dist/app.js + node_modules); senão o source.
            let desktop_resources = manifest.join("..").join("resources");
            let bundle_backend = desktop_resources.join("backend");
            let backend_path = if bundle_backend.join("dist").join("app.js").is_file() {
                bundle_backend
            } else {
                repo_root.join("apps").join("backend")
            };
            let dev_runtime = desktop_resources.join("runtime");
            let runtime_path = if dev_runtime.join("postgres").join("bin").join("initdb.exe").is_file() {
                Some(dev_runtime)
            } else {
                None
            };
            (
                backend_path,
                runtime_path,
                PathBuf::from("node"),
                repo_root.join("apps").join("frontend").join("dist"),
            )
        };

        Self {
            frontend_dir,
            resources_backend_path,
            runtime_path,
            node_bin,
            data_dir,
        }
        .normalized()
    }

    /// Normaliza paths com prefixo verboroso `\\?\` do Windows.
    ///
    /// O `resource_dir()` do Tauri no Windows retorna caminhos com prefixo
    /// `\\?\C:\...`. Ao spawnar binários (initdb.exe/pg_ctl.exe/node.exe) com
    /// esse prefixo, o loader de DLLs do Windows não resolve as DLLs irmãs
    /// (ex.: icudt67.dll do Postgres) — "O sistema não pode encontrar o caminho".
    /// Aqui convertemos de volta para `C:\...` (mantendo long paths na prática).
    fn normalized(mut self) -> Self {
        let strip = |p: std::path::PathBuf| -> std::path::PathBuf {
            let s = p.to_string_lossy();
            if let Some(rest) = s.strip_prefix("\\\\?\\") {
                std::path::PathBuf::from(rest)
            } else {
                p
            }
        };
        self.frontend_dir = strip(self.frontend_dir);
        self.resources_backend_path = strip(self.resources_backend_path);
        if let Some(r) = self.runtime_path.take() {
            self.runtime_path = Some(strip(r));
        }
        self.node_bin = strip(self.node_bin);
        self.data_dir = strip(self.data_dir);
        self
    }
}

/// Serviços gerenciados pelo app (acessados pelos comandos IPC).
pub struct BootServices {
    pub settings: Arc<SettingsStore>,
    pub embedded: bool,
    pub backend: Arc<BackendManager>,
    /// Porta do servidor HTTP local (definida no boot via portpicker).
    pub http_port: Arc<AtomicU16>,
    /// Estado atual do backend (compartilhado com o status screen).
    #[allow(dead_code)]
    pub status: Arc<http_server::CurrentStatus>,
    /// Mantém o listener de estado vivo (o Drop do Unsubscribe o remove).
    #[allow(dead_code)]
    pub _state_listener: crate::backend_manager::Unsubscribe,
}

impl std::fmt::Debug for BootServices {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BootServices")
            .field("embedded", &self.embedded)
            .field("http_port", &self.http_port.load(Ordering::SeqCst))
            .field("backend_status", &self.backend.get_status())
            .finish()
    }
}

/// Resolve o diretório do Postgres embarcado dentro do runtime.
fn runtime_postgres_bin(runtime_path: &std::path::Path) -> PathBuf {
    runtime_path.join("postgres").join("bin")
}

/// Resolve a porta do backend: usa a porta configurada quando ela está livre;
/// caso contrário, escolhe uma porta livre (mesma política do http_server e do
/// postgres_manager via `portpicker`).
///
/// Motivação (MEC-30): o app roda embarcado sem Docker, mas se outra instância
/// (ex.: backend de dev do usuário rodando em paralelo) já estiver ocupando a
/// porta configurada, o node embarcado não consegue bindar e o health-check
/// "acerta" o processo errado — o app acaba dependendo de infra do host. Aqui
/// garantimos uma porta livre real para o backend embarcado.
fn resolve_backend_port(configured: u16) -> u16 {
    use std::net::TcpListener;
    let ok = TcpListener::bind(("127.0.0.1", configured)).is_ok();
    if ok {
        configured
    } else {
        portpicker::pick_unused_port().unwrap_or(configured)
    }
}

/// Constrói o `BackendManager` a partir dos paths e settings.
fn build_backend_manager(
    paths: &BootPaths,
    settings: Arc<SettingsStore>,
    embedded: bool,
    postgres: Option<Arc<PostgresManager>>,
    backend_port: u16,
) -> BackendManager {
    let options = BackendManagerOptions {
        settings: settings.clone(),
        resources_backend_path: paths.resources_backend_path.clone(),
        storage_path: Some(paths.data_dir.join("storage")),
        runtime_path: paths.runtime_path.clone(),
        backend_port,
        poll_interval_ms: 500,
        health_timeout_ms: 30_000,
        kill_grace_ms: 5_000,
        managed_migrations: true,
        migrations_marker_path: Some(paths.data_dir.join("migrations.marker")),
        node_bin: paths.node_bin.clone(),
        embedded,
        postgres: postgres.map(|p| p as Arc<dyn crate::backend_manager::EmbeddedPostgres>),
    };
    BackendManager::new(options)
}

/// Sobe o shell completo.
///
/// Retorna os serviços gerenciados (para `app.manage`) e a porta do servidor
/// HTTP local. Navega a janela para `http://127.0.0.1:{porta}/` quando o
/// backend estiver `ready`.
pub fn run_boot(app: &tauri::AppHandle) -> Result<BootServices, String> {
    let paths = {
        // Diretório de dados nativo do Tauri: `%APPDATA%/com.mangaink.desktop`
        // (baseado no `identifier` do tauri.conf.json). Substitui o path manual
        // legado `%APPDATA%/MangaInk Agent` (decisão do usuário, MEC-30).
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("falha ao resolver app_data_dir(): {e}"))?;
        let resource_dir = app.path().resource_dir().ok();
        BootPaths::resolve(resource_dir.as_deref(), data_dir)
    };

    // 1. settings (load é async; aqui rodamos no contexto síncrono do setup)
    let settings = Arc::new(SettingsStore::new(paths.data_dir.join("settings.json")));
    let loaded = tauri::async_runtime::block_on(settings.load())
        .map_err(|e| format!("falha ao carregar settings: {e}"))?;
    info!(backend_port = %loaded.backend_port, "settings carregados");

    // 2. modo embedded
    let embedded = resolve_embedded_mode(&ResolveEmbeddedModeOptions {
        is_packaged: cfg!(not(debug_assertions)),
        env_flag: std::env::var("MI_EMBEDDED_MODE").ok(),
    });
    info!(embedded, "modo de execução resolvido");

    // 3. Postgres embarcado
    let postgres: Option<Arc<PostgresManager>> = if embedded {
        let runtime_path = paths
            .runtime_path
            .clone()
            .ok_or_else(|| "runtime_path ausente no modo embedded".to_string())?;
        let manager = Arc::new(PostgresManager::new(PostgresManagerOptions {
            runtime_postgres_bin: runtime_postgres_bin(&runtime_path),
            data_dir: paths.data_dir.join("pgdata"),
            port: settings.get_managed_postgres_port(),
            host: "127.0.0.1".to_string(),
            database_name: "mangaink_agent_db".to_string(),
            poll_interval_ms: 300,
            start_timeout_ms: 30_000,
        }));
        info!(
            pgdata = %paths.data_dir.join("pgdata").display(),
            "Postgres embarcado configurado"
        );
        Some(manager)
    } else {
        None
    };

    // 4. backend manager — porta do backend embarcado: usa a configurada se
    //    livre; senão resolve uma porta livre (não depende de infra do host).
    let configured_backend_port = settings.get().backend_port;
    let backend_port = resolve_backend_port(configured_backend_port);
    info!(
        configured = %configured_backend_port,
        resolved = %backend_port,
        "porta do backend resolvida"
    );
    let backend = Arc::new(build_backend_manager(&paths, settings.clone(), embedded, postgres, backend_port));
    info!(resources = %paths.resources_backend_path.display(), node = %paths.node_bin.display(), "backend manager criado");

    // 5. servidor HTTP local (porta livre) — o proxy já aponta para o backend.
    let http_port = Arc::new(AtomicU16::new(0));
    let backend_port_for_server = backend_port;
    let status = Arc::new(http_server::CurrentStatus::new());
    status.set_version(env!("CARGO_PKG_VERSION"));
    let state = HttpServerState {
        frontend_dir: paths.frontend_dir.clone(),
        backend_port: backend_port_for_server,
        client: reqwest::Client::new(),
        status: status.clone(),
    };
    let server = tauri::async_runtime::block_on(async move { http_server::start(state, None).await })
        .map_err(|e| format!("falha ao subir o servidor HTTP local: {e}"))?;
    http_port.store(server.addr.port(), Ordering::SeqCst);
    info!(addr = %server.addr, "servidor HTTP local no ar");

    // 6. listener de estado → atualiza o status compartilhado, emite eventos e
    // navega a janela: `/__status` enquanto não estiver pronto, `/` quando ready.
    // O handle retornado é mantido em `BootServices` (drop o removeria).
    let app_handle = app.clone();
    let shared_status = status.clone();
    let listener_http_port = http_port.clone();
    let state_listener = backend.on_state_change(move |state| {
        let status = state.status().to_string();
        let (message, stderr) = match &state {
            crate::backend_manager::BackendState::Starting { message } => (message.clone(), String::new()),
            crate::backend_manager::BackendState::PrereqFailed { message, stderr } => (
                message.clone(),
                stderr.clone().unwrap_or_default(),
            ),
            crate::backend_manager::BackendState::PostgresFailed { message, stderr } => (
                message.clone(),
                stderr.clone().unwrap_or_default(),
            ),
            crate::backend_manager::BackendState::MigrationFailed { message, stderr } => {
                (message.clone(), stderr.clone())
            }
            crate::backend_manager::BackendState::BackendFailed { message, stderr } => (
                message.clone(),
                stderr.clone().unwrap_or_default(),
            ),
            _ => (String::new(), String::new()),
        };
        shared_status.set(&status, &message, &stderr);

        let json = match serde_json::to_value(&status) {
            Ok(v) => v,
            Err(_) => serde_json::Value::Null,
        };
        let _ = app_handle.emit("backend-state", json);
        info!(status = %status, "backend-state emitido");

        let port = listener_http_port.load(Ordering::SeqCst);
        let path = if status == "ready" { "/" } else { "/__status" };
        let url = format!("http://127.0.0.1:{port}{path}");
        if let Some(window) = app_handle.get_webview_window("main") {
            if let Ok(u) = url.parse() {
                let _ = window.navigate(u);
                info!(url = %url, "janela navegada");
            }
        }
    });

    // Serviços gerenciados (o listener é mantido vivo aqui).
    let services = BootServices {
        settings: settings.clone(),
        embedded,
        backend: backend.clone(),
        http_port: http_port.clone(),
        status: status.clone(),
        _state_listener: state_listener,
    };

    // 7. boot do backend (Postgres → migrações → spawn → health-poll).
    tauri::async_runtime::spawn(async move {
        if let Err(e) = backend.start().await {
            error!(?e, "falha no boot do backend");
        }
    });

    Ok(services)
}

/// Encerra o shell de forma ordeira (D6): para o backend (que para o Postgres
/// embarcado) com grace e sem órfãos. Chamado no exit do app.
pub fn shutdown(app: &tauri::AppHandle) {
    if let Some(services) = app.try_state::<BootServices>() {
        let backend = services.backend.clone();
        info!("shutdown iniciado — parando backend");
        // Roda em thread própria: `block_on` do runtime do Tauri a partir do
        // main thread durante o exit pode travar; aqui garantimos conclusão.
        let handle = std::thread::spawn(move || {
            tauri::async_runtime::block_on(async move {
                match backend.stop().await {
                    Ok(()) => info!("backend parado no shutdown"),
                    Err(e) => warn!(?e, "erro ao parar o backend no shutdown"),
                }
            })
        });
        // grace de espera para não travar o exit indefinidamente
        let _ = handle.join();
    } else {
        info!("shutdown sem serviços ativos — nada a parar");
    }
}

/// Valida URLs aceitas pelo comando `open_external` (apenas http(s)).
pub fn is_valid_external_url(url: &str) -> bool {
    url.starts_with("http://") || url.starts_with("https://")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boot_paths_dev_aponta_para_workspace() {
        let paths = BootPaths::resolve(None, PathBuf::from("C:/tmp/com.mangaink.desktop"));
        // Sem bundle preparado → source `apps/backend`; com bundle → resources.
        let uses_source = paths
            .resources_backend_path
            .to_string_lossy()
            .contains("apps\\backend")
            || paths
                .resources_backend_path
                .to_string_lossy()
                .contains("apps/backend");
        let uses_bundle = paths
            .resources_backend_path
            .to_string_lossy()
            .contains("resources\\backend")
            || paths
                .resources_backend_path
                .to_string_lossy()
                .contains("resources/backend");
        assert!(uses_source || uses_bundle);
        assert_eq!(paths.node_bin, PathBuf::from("node"));
        assert_eq!(paths.data_dir, PathBuf::from("C:/tmp/com.mangaink.desktop"));
    }

    #[test]
    fn boot_paths_dev_prefere_bundle_preparado() {
        // Cria apps/desktop/resources/backend/dist/app.js + runtime/postgres/bin/initdb.exe
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let res = manifest.join("..").join("resources");
        let had_bundle = res.join("backend").join("dist").join("app.js").is_file();
        let had_runtime = res.join("runtime").join("postgres").join("bin").join("initdb.exe").is_file();

        let paths = BootPaths::resolve(None, PathBuf::from("C:/tmp/com.mangaink.desktop"));
        let uses_bundle = paths
            .resources_backend_path
            .to_string_lossy()
            .contains("resources\\backend");
        let runtime_ok = paths.runtime_path.is_some();
        assert_eq!(uses_bundle, had_bundle);
        assert_eq!(runtime_ok, had_runtime);
    }

    #[test]
    fn boot_paths_packaged_usa_resource_dir() {
        let res = std::env::temp_dir().join("mi-resources");
        std::fs::create_dir_all(res.join("frontend")).unwrap();
        let paths = BootPaths::resolve(Some(&res), PathBuf::from("C:/tmp/com.mangaink.desktop"));
        assert_eq!(paths.resources_backend_path, res.join("backend"));
        assert_eq!(paths.node_bin, res.join("node").join("node.exe"));
        assert_eq!(paths.frontend_dir, res.join("frontend"));
        let _ = std::fs::remove_dir_all(&res);
    }

    #[test]
    fn boot_paths_resource_dir_sem_layout_falls_back_dev() {
        // `cargo run` → resource_dir = target/debug (sem frontend/backend/runtime)
        let res = std::env::temp_dir().join("mi-not-packaged");
        std::fs::create_dir_all(&res).unwrap();
        let paths = BootPaths::resolve(Some(&res), PathBuf::from("C:/tmp/com.mangaink.desktop"));
        assert_eq!(paths.node_bin, PathBuf::from("node"));
        assert!(paths.resources_backend_path.to_string_lossy().contains("apps"));
        let _ = std::fs::remove_dir_all(&res);
    }

    #[test]
    fn external_url_so_http_https() {
        assert!(is_valid_external_url("https://mangaink.app"));
        assert!(is_valid_external_url("http://localhost:3333/api/health"));
        assert!(!is_valid_external_url("file:///etc/passwd"));
        assert!(!is_valid_external_url("javascript:alert(1)"));
        assert!(!is_valid_external_url("ftp://x"));
    }

    #[test]
    fn runtime_postgres_bin_aponta_para_bin() {
        let p = runtime_postgres_bin(&PathBuf::from("C:/runtime"));
        assert!(p.ends_with("postgres\\bin") || p.ends_with("postgres/bin"));
    }

    #[test]
    fn resolve_backend_port_usa_configurada_quando_livre() {
        // Porta livre → devolve a própria configurada.
        let free = portpicker::pick_unused_port().expect("porta livre disponível");
        let resolved = resolve_backend_port(free);
        assert_eq!(resolved, free);
    }

    #[test]
    fn resolve_backend_port_escolhe_livre_quando_ocupada() {
        // Ocupa uma porta com um listener e pede a resolução para ela.
        use std::net::TcpListener;
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("bind ok");
        let occupied = listener.local_addr().expect("addr ok").port();

        let resolved = resolve_backend_port(occupied);
        assert_ne!(resolved, occupied, "não pode devolver a porta ocupada");

        // A porta resolvida deve estar realmente livre para bind.
        let ok = TcpListener::bind(("127.0.0.1", resolved)).is_ok();
        assert!(ok, "porta resolvida precisa estar livre: {resolved}");
    }
}
