//! `backend_manager` — port Rust de `apps/desktop/src/main/backend-manager.ts`.
//!
//! Orquestra o backend Fastify como processo filho do shell:
//!   - máquina de estados `idle|starting|prereq_failed|postgres_failed|migration_failed|backend_failed|ready`;
//!   - spawn do `node.exe` (v22.x resource) rodando `dist/app.js`;
//!   - `prisma migrate deploy` com marker hash (skippa quando as migrações já
//!     foram aplicadas — boot mais rápido, paridade com 5a9499f);
//!   - health-poll `GET /api/health` a cada 500ms até `ready` (timeout configurável);
//!   - retry/restart (SIGTERM → grace 5s → SIGKILL);
//!   - captura assíncrona de stdout/stderr alimentando `get_logs`.
//!
//! v1 = embedded (Windows x64): sem check de Docker (D7). O estado
//! `prereq_failed` permanece no tipo por compatibilidade, mas nunca é emitido
//! no modo embedded. Spawn de processos é abstraído no trait [`ProcessSpawner`]
//! (mockável); health-poll no trait [`HealthChecker`].

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tracing::warn;

use crate::postgres_manager::{PostgresManager, PostgresManagerError};
use crate::settings_store::{DesktopSettings, SettingsProvider};

/// `CREATE_NO_WINDOW` — impede a criação de console preto ao spawnar processos
/// filho no Windows (node.exe, initdb/pg_ctl/psql/createdb, taskkill).
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Aplica `CREATE_NO_WINDOW` a um `tokio::process::Command` no Windows.
#[cfg(target_os = "windows")]
fn hide_console(cmd: &mut Command) {
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Estados do backend (paridade com `BackendState` do TS).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub enum BackendState {
    Idle,
    Starting { message: String },
    #[allow(dead_code)]
    PrereqFailed { message: String, stderr: Option<String> },
    PostgresFailed { message: String, stderr: Option<String> },
    MigrationFailed { message: String, stderr: String },
    BackendFailed { message: String, stderr: Option<String> },
    Ready { message: String },
}

impl BackendState {
    pub fn status(&self) -> &'static str {
        match self {
            BackendState::Idle => "idle",
            BackendState::Starting { .. } => "starting",
            BackendState::PrereqFailed { .. } => "prereq_failed",
            BackendState::PostgresFailed { .. } => "postgres_failed",
            BackendState::MigrationFailed { .. } => "migration_failed",
            BackendState::BackendFailed { .. } => "backend_failed",
            BackendState::Ready { .. } => "ready",
        }
    }
}

/// Logs capturados do processo backend.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BackendLogs {
    pub stdout: String,
    pub stderr: String,
}

/// Contrato do Postgres embarcado usado pelo manager (mockável em testes).
#[async_trait]
pub trait EmbeddedPostgres: Send + Sync {
    async fn start(&self) -> Result<(), PostgresManagerError>;
    async fn stop(&self) -> Result<(), PostgresManagerError>;
    fn database_url(&self) -> Result<String, PostgresManagerError>;
}

#[async_trait]
impl EmbeddedPostgres for PostgresManager {
    async fn start(&self) -> Result<(), PostgresManagerError> {
        PostgresManager::start(self).await
    }

    async fn stop(&self) -> Result<(), PostgresManagerError> {
        PostgresManager::stop(self).await
    }

    fn database_url(&self) -> Result<String, PostgresManagerError> {
        PostgresManager::get_database_url(self)
    }
}

#[async_trait]
impl<T: EmbeddedPostgres> EmbeddedPostgres for Arc<T> {
    async fn start(&self) -> Result<(), PostgresManagerError> {
        (**self).start().await
    }

    async fn stop(&self) -> Result<(), PostgresManagerError> {
        (**self).stop().await
    }

    fn database_url(&self) -> Result<String, PostgresManagerError> {
        (**self).database_url()
    }
}

/// Processo filho (backend ou migração) com pipes de stdout/stderr.
#[async_trait]
pub trait SpawnedProcess: Send + Sync {
    fn take_stdout(&self) -> Option<Box<dyn AsyncRead + Send + Unpin>>;
    fn take_stderr(&self) -> Option<Box<dyn AsyncRead + Send + Unpin>>;
    async fn wait(&self) -> Option<i32>;
    fn kill(&self, signal: &str) -> bool;
    /// `true` quando o processo já terminou (observado pelo watcher).
    fn has_exited(&self) -> bool;
    /// PID do processo (usado no shutdown sem órfãos / taskkill, Task 6).
    #[allow(dead_code)]
    fn pid(&self) -> Option<u32>;
}

/// Abstrai o spawn de processos (mockável em testes).
#[async_trait]
pub trait ProcessSpawner: Send + Sync {
    async fn spawn(
        &self,
        cmd: &Path,
        args: &[String],
        cwd: &Path,
        env: &BTreeMap<String, String>,
    ) -> Result<Box<dyn SpawnedProcess>, String>;
}

/// Implementação real: `tokio::process::Command` com pipes.
#[derive(Debug, Default, Clone)]
pub struct TokioProcessSpawner;

struct TokioChild {
    pid: Option<u32>,
    child: std::sync::Mutex<Option<tokio::process::Child>>,
    exited: std::sync::atomic::AtomicBool,
}

impl TokioChild {
    fn new(child: tokio::process::Child) -> Self {
        let pid = child.id();
        Self {
            pid,
            child: std::sync::Mutex::new(Some(child)),
            exited: std::sync::atomic::AtomicBool::new(false),
        }
    }
}

#[async_trait]
impl SpawnedProcess for TokioChild {
    fn take_stdout(&self) -> Option<Box<dyn AsyncRead + Send + Unpin>> {
        self.child
            .lock()
            .unwrap()
            .as_mut()
            .and_then(|c| c.stdout.take())
            .map(|s| Box::new(s) as Box<dyn AsyncRead + Send + Unpin>)
    }

    fn take_stderr(&self) -> Option<Box<dyn AsyncRead + Send + Unpin>> {
        self.child
            .lock()
            .unwrap()
            .as_mut()
            .and_then(|c| c.stderr.take())
            .map(|s| Box::new(s) as Box<dyn AsyncRead + Send + Unpin>)
    }

    async fn wait(&self) -> Option<i32> {
        let child = {
            let mut guard = self.child.lock().unwrap();
            guard.take()
        };
        let mut child = child?;
        let code = child.wait().await.ok().and_then(|s| s.code());
        self.exited.store(true, std::sync::atomic::Ordering::SeqCst);
        code
    }

    fn has_exited(&self) -> bool {
        self.exited.load(std::sync::atomic::Ordering::SeqCst)
    }

    fn kill(&self, signal: &str) -> bool {
        // D6: no Windows, mata a árvore inteira (node + filhos Python/KCC)
        // via `taskkill /T /F` — independe do handle do Child (que pode já ter
        // sido consumido por `wait`). No Unix, envia SIGTERM/SIGKILL por PID.
        let Some(pid) = self.pid else {
            // fallback: tenta o handle direto
            let mut guard = self.child.lock().unwrap();
            if let Some(child) = guard.as_mut() {
                return child.start_kill().is_ok();
            }
            return false;
        };

        #[cfg(target_os = "windows")]
        {
            let is_kill = signal == "SIGKILL";
            let mut cmd = std::process::Command::new("taskkill");
            cmd.arg("/PID").arg(pid.to_string()).arg("/T");
            if is_kill {
                cmd.arg("/F");
            }
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
            // Blocking (kill ocorre em shutdown): o taskkill precisa terminar
            // antes de reter — fire-and-forget com kill_on_drop mataria o próprio
            // taskkill. Marca também o handle como finalizado.
            let ok = cmd.status().map(|s| s.success()).unwrap_or(false);
            let mut guard = self.child.lock().unwrap();
            if let Some(child) = guard.as_mut() {
                let _ = child.start_kill();
            }
            ok
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = signal;
            let mut guard = self.child.lock().unwrap();
            if let Some(child) = guard.as_mut() {
                child.start_kill().is_ok()
            } else {
                false
            }
        }
    }

    fn pid(&self) -> Option<u32> {
        self.pid
    }
}

#[async_trait]
impl ProcessSpawner for TokioProcessSpawner {
    async fn spawn(
        &self,
        cmd: &Path,
        args: &[String],
        cwd: &Path,
        env: &BTreeMap<String, String>,
    ) -> Result<Box<dyn SpawnedProcess>, String> {
        let mut command = Command::new(cmd);
        command
            .args(args)
            .current_dir(cwd)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        hide_console(&mut command);
        for (k, v) in env {
            command.env(k, v);
        }
        let child = command.spawn().map_err(|e| format!("spawn falhou: {e}"))?;
        Ok(Box::new(TokioChild::new(child)))
    }
}

/// Verifica o health endpoint (mockável em testes).
#[async_trait]
pub trait HealthChecker: Send + Sync {
    /// Retorna `true` quando o backend responde `200` com `{"status":"ok"}`.
    async fn check(&self, url: &str) -> bool;
}

/// Implementação real via `reqwest`.
#[derive(Debug, Clone)]
pub struct ReqwestHealthChecker {
    client: reqwest::Client,
}

impl ReqwestHealthChecker {
    pub fn new(client: reqwest::Client) -> Self {
        Self { client }
    }
}

#[async_trait]
impl HealthChecker for ReqwestHealthChecker {
    async fn check(&self, url: &str) -> bool {
        let resp = match self.client.get(url).send().await {
            Ok(r) => r,
            Err(_) => return false,
        };
        if !resp.status().is_success() {
            return false;
        }
        match resp.json::<serde_json::Value>().await {
            Ok(body) => body.get("status").and_then(|s| s.as_str()) == Some("ok"),
            Err(_) => false,
        }
    }
}

/// Opções de construção do backend manager.
#[derive(Clone)]
pub struct BackendManagerOptions {
    /// Store de settings (backendPort, jwtSecret, databaseUrl, redisUrl).
    pub settings: Arc<dyn SettingsProvider>,
    /// Diretório do backend bundle (contém `dist/app.js`, `node_modules/prisma`).
    pub resources_backend_path: PathBuf,
    /// Storage path explícito (override do default derivado).
    pub storage_path: Option<PathBuf>,
    /// Raiz do runtime embutido (Postgres/Python/KCC) — `MI_EMBEDDED_RUNTIME_PATH`.
    pub runtime_path: Option<PathBuf>,
    /// Porta do backend.
    pub backend_port: u16,
    /// Intervalo do health-poll (default 500ms).
    pub poll_interval_ms: u64,
    /// Timeout do health-poll (default 30s).
    pub health_timeout_ms: u64,
    /// Grace do kill (default 5s).
    pub kill_grace_ms: u64,
    /// Roda `prisma migrate deploy` no boot.
    pub managed_migrations: bool,
    /// Path do marker hash das migrações (skippa deploy quando atual).
    pub migrations_marker_path: Option<PathBuf>,
    /// Binário node (resource `node/node.exe` no embedded; `node` em dev).
    pub node_bin: PathBuf,
    /// Modo embedded (Postgres embarcado, sem Docker).
    pub embedded: bool,
    /// Postgres gerenciado (obrigatório quando embedded).
    pub postgres: Option<Arc<dyn EmbeddedPostgres>>,
}

impl Default for BackendManagerOptions {
    fn default() -> Self {
        Self {
            settings: Arc::new(DesktopSettings::default()),
            resources_backend_path: PathBuf::new(),
            storage_path: None,
            runtime_path: None,
            backend_port: 3333,
            poll_interval_ms: 500,
            health_timeout_ms: 30_000,
            kill_grace_ms: 5_000,
            managed_migrations: true,
            migrations_marker_path: None,
            node_bin: PathBuf::from("node"),
            embedded: false,
            postgres: None,
        }
    }
}

/// Handle de unsubscribe de listener de estado.
pub struct Unsubscribe {
    listeners: Arc<Mutex<Vec<(usize, StateListener)>>>,
    id: usize,
}

/// Listener de mudança de estado.
type StateListener = Box<dyn Fn(BackendState) + Send + Sync>;

impl Drop for Unsubscribe {
    fn drop(&mut self) {
        self.listeners
            .lock()
            .unwrap()
            .retain(|(id, _)| *id != self.id);
    }
}

/// Backend manager (paridade com `createBackendManager` do TS).
pub struct BackendManager {
    options: BackendManagerOptions,
    spawner: Arc<dyn ProcessSpawner>,
    health: Arc<dyn HealthChecker>,
    state: Mutex<BackendState>,
    listeners: Arc<Mutex<Vec<(usize, StateListener)>>>,
    next_listener_id: AtomicUsize,
    child: Mutex<Option<Arc<dyn SpawnedProcess>>>,
    child_epoch: AtomicUsize,
    stopping: AtomicBool,
    stdout_chunks: Arc<Mutex<Vec<String>>>,
    stderr_chunks: Arc<Mutex<Vec<String>>>,
    poll_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl std::fmt::Debug for BackendManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BackendManager")
            .field("state", &self.state.lock().unwrap().status())
            .finish()
    }
}

impl BackendManager {
    pub fn new(options: BackendManagerOptions) -> Self {
        Self::with_runners(
            options,
            Arc::new(TokioProcessSpawner),
            Arc::new(ReqwestHealthChecker::new(reqwest::Client::new())),
        )
    }

    /// Construtor com spawner/health injectáveis (testes).
    pub fn with_runners(
        options: BackendManagerOptions,
        spawner: Arc<dyn ProcessSpawner>,
        health: Arc<dyn HealthChecker>,
    ) -> Self {
        Self {
            options,
            spawner,
            health,
            state: Mutex::new(BackendState::Idle),
            listeners: Arc::new(Mutex::new(Vec::new())),
            next_listener_id: AtomicUsize::new(0),
            child: Mutex::new(None),
            child_epoch: AtomicUsize::new(0),
            stopping: AtomicBool::new(false),
            stdout_chunks: Arc::new(Mutex::new(Vec::new())),
            stderr_chunks: Arc::new(Mutex::new(Vec::new())),
            poll_handle: Mutex::new(None),
        }
    }

    // ── interno ──────────────────────────────────────────────────────────

    fn set_state(&self, next: BackendState) {
        *self.state.lock().unwrap() = next.clone();
        let listeners = self.listeners.lock().unwrap();
        for (_, listener) in listeners.iter() {
            listener(next.clone());
        }
    }

    fn clear_poll(&self) {
        if let Some(handle) = self.poll_handle.lock().unwrap().take() {
            handle.abort();
        }
    }

    fn resolve_storage_path(&self) -> PathBuf {
        if let Some(storage) = &self.options.storage_path {
            return std::path::absolute(storage).unwrap_or_else(|_| storage.clone());
        }
        let default = self.options.resources_backend_path.join("..").join("storage");
        std::path::absolute(&default).unwrap_or(default)
    }

    fn resolve_node_env(&self, base: &mut BTreeMap<String, String>) {
        if self.options.node_bin.as_os_str() != "node" {
            base.insert("ELECTRON_RUN_AS_NODE".to_string(), "1".to_string());
        }
    }

    fn hash_migrations_dir(&self) -> Option<String> {
        hash_migrations_dir(&self.options.resources_backend_path)
    }

    fn migrations_are_current(&self) -> bool {
        let Some(marker_path) = &self.options.migrations_marker_path else {
            return false;
        };
        let Some(current) = self.hash_migrations_dir() else {
            return false;
        };
        let Ok(persisted) = std::fs::read_to_string(marker_path) else {
            return false;
        };
        persisted.trim() == current
    }

    fn persist_migrations_marker(&self) {
        let Some(marker_path) = &self.options.migrations_marker_path else {
            return;
        };
        let Some(current) = self.hash_migrations_dir() else {
            return;
        };
        if let Some(parent) = marker_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::write(marker_path, current);
    }

    async fn run_migrations(&self, database_url: &str) -> bool {
        let prisma_cli = self
            .options
            .resources_backend_path
            .join("node_modules")
            .join("prisma")
            .join("build")
            .join("index.js");
        let mut env: BTreeMap<String, String> = std::env::vars().collect();
        env.insert("DATABASE_URL".to_string(), database_url.to_string());
        self.resolve_node_env(&mut env);

        let spawned = match self
            .spawner
            .spawn(
                &self.options.node_bin,
                &[
                    prisma_cli.to_string_lossy().to_string(),
                    "migrate".to_string(),
                    "deploy".to_string(),
                ],
                &self.options.resources_backend_path,
                &env,
            )
            .await
        {
            Ok(p) => p,
            Err(e) => {
                self.set_state(BackendState::MigrationFailed {
                    message: "Falha ao executar as migrações do banco de dados.".to_string(),
                    stderr: e,
                });
                return false;
            }
        };

        let mut migration_stderr = String::new();
        if let Some(mut stderr) = spawned.take_stderr() {
            let mut buf = [0u8; 4096];
            loop {
                match stderr.read(&mut buf).await {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        migration_stderr.push_str(&text);
                        self.stderr_chunks.lock().unwrap().push(text);
                    }
                }
            }
        }

        let code = spawned.wait().await;
        if code != Some(0) {
            self.set_state(BackendState::MigrationFailed {
                message: "Falha ao executar as migrações do banco de dados.".to_string(),
                stderr: migration_stderr,
            });
            return false;
        }
        true
    }

    async fn spawn_backend(self: &Arc<Self>, port: u16, database_url: &str) -> Result<(), String> {
        let current = self.options.settings.get();
        let storage = self.resolve_storage_path();
        let mut env: BTreeMap<String, String> = std::env::vars().collect();
        env.insert("PORT".to_string(), port.to_string());
        env.insert("JWT_SECRET".to_string(), current.jwt_secret.clone());
        env.insert("DATABASE_URL".to_string(), database_url.to_string());
        env.insert("STORAGE_PATH".to_string(), storage.to_string_lossy().to_string());
        env.insert(
            "CONVERSIONS_STORAGE_PATH".to_string(),
            storage.join("conversions").to_string_lossy().to_string(),
        );
        env.insert("OTEL_SDK_DISABLED".to_string(), "true".to_string());
        env.insert(
            "MI_DESKTOP_MANAGED".to_string(),
            if self.options.embedded || self.options.managed_migrations {
                "1"
            } else {
                "0"
            }
            .to_string(),
        );
        if self.options.embedded {
            env.remove("REDIS_URL");
            env.insert("MI_EMBEDDED_MODE".to_string(), "1".to_string());
            if let Some(runtime) = &self.options.runtime_path {
                env.insert("MI_EMBEDDED_RUNTIME_PATH".to_string(), runtime.to_string_lossy().to_string());
            }
        } else {
            env.insert("REDIS_URL".to_string(), current.redis_url.clone());
        }
        self.resolve_node_env(&mut env);

        let app_path = self.options.resources_backend_path.join("dist").join("app.js");
        let spawned = self
            .spawner
            .spawn(
                &self.options.node_bin,
                &[app_path.to_string_lossy().to_string()],
                &self.options.resources_backend_path,
                &env,
            )
            .await?;

        self.stdout_chunks.lock().unwrap().clear();
        self.stderr_chunks.lock().unwrap().clear();

        let spawned: Arc<dyn SpawnedProcess> = Arc::from(spawned);

        if let Some(mut stdout) = spawned.take_stdout() {
            let chunks = self.stdout_chunks.clone();
            tokio::spawn(async move {
                let mut buf = [0u8; 4096];
                loop {
                    match stdout.read(&mut buf).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => chunks
                            .lock()
                            .unwrap()
                            .push(String::from_utf8_lossy(&buf[..n]).to_string()),
                    }
                }
            });
        }
        if let Some(mut stderr) = spawned.take_stderr() {
            let chunks = self.stderr_chunks.clone();
            tokio::spawn(async move {
                let mut buf = [0u8; 4096];
                loop {
                    match stderr.read(&mut buf).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => chunks
                            .lock()
                            .unwrap()
                            .push(String::from_utf8_lossy(&buf[..n]).to_string()),
                    }
                }
            });
        }

        // Watcher de exit inesperado antes do ready. O `epoch` evita que um exit
        // do child anterior (após restart) derrube o novo boot.
        let spawned_watch = spawned.clone();
        let manager = self.clone();
        let epoch = self.child_epoch.fetch_add(1, Ordering::SeqCst) + 1;
        tokio::spawn(async move {
            let code = spawned_watch.wait().await;
            manager.handle_exit(code, epoch);
        });

        *self.child.lock().unwrap() = Some(spawned);
        Ok(())
    }

    fn start_health_poll(self: &Arc<Self>, port: u16) {
        self.clear_poll();
        let url = format!("http://127.0.0.1:{port}/api/health");
        let health = self.health.clone();
        let timeout_ms = self.options.health_timeout_ms;
        let poll_ms = self.options.poll_interval_ms;
        let manager = self.clone();
        let handle = tokio::spawn(async move {
            let deadline = tokio::time::Instant::now() + Duration::from_millis(timeout_ms);
            loop {
                if !manager.is_starting() {
                    break;
                }
                if tokio::time::Instant::now() >= deadline {
                    manager.kill_child("SIGKILL");
                    manager.set_state(BackendState::BackendFailed {
                        message: "O backend não respondeu dentro do tempo limite.".to_string(),
                        stderr: Some(manager.get_logs().stderr),
                    });
                    break;
                }
                if health.check(&url).await {
                    manager.set_state(BackendState::Ready {
                        message: "Backend pronto.".to_string(),
                    });
                    break;
                }
                tokio::time::sleep(Duration::from_millis(poll_ms)).await;
            }
        });
        *self.poll_handle.lock().unwrap() = Some(handle);
    }

    fn handle_exit(&self, code: Option<i32>, epoch: usize) {
        if self.stopping.load(Ordering::SeqCst) {
            return;
        }
        if !self.is_starting() {
            return;
        }
        // Exit de child antigo (restart já spawnou novo) — ignora.
        if epoch != self.child_epoch.load(Ordering::SeqCst) {
            return;
        }
        self.clear_poll();
        *self.child.lock().unwrap() = None;
        let stderr = self.get_logs().stderr;
        self.set_state(BackendState::BackendFailed {
            message: format!(
                "O backend encerrou inesperadamente (exit {}).",
                code.map(|c| c.to_string())
                    .unwrap_or_else(|| "desconhecido".to_string())
            ),
            stderr: Some(stderr),
        });
    }

    // ── API pública ─────────────────────────────────────────────────────

    /// Sobe o backend: (embedded) Postgres → migrations → spawn → health-poll.
    pub async fn start(self: &Arc<Self>) -> Result<(), String> {
        if self.child.lock().unwrap().is_some() {
            return Ok(());
        }
        self.stopping.store(false, Ordering::SeqCst);
        self.set_state(BackendState::Starting {
            message: "Iniciando backend...".to_string(),
        });

        let database_url = if self.options.embedded {
            let postgres = self
                .options
                .postgres
                .clone()
                .ok_or_else(|| "BackendManager: postgres é obrigatório quando embedded=true.".to_string())?;
            match postgres.start().await {
                Ok(()) => {}
                Err(err) => {
                    self.set_state(BackendState::PostgresFailed {
                        message: err.message().to_string(),
                        stderr: err.stderr().map(str::to_string),
                    });
                    return Ok(());
                }
            }
            postgres.database_url().map_err(|e| e.to_string())?
        } else {
            self.options.settings.get().database_url
        };

        if self.options.managed_migrations {
            if self.migrations_are_current() {
                self.set_state(BackendState::Starting {
                    message: "Migrações já aplicadas. Iniciando backend...".to_string(),
                });
            } else {
                let ok = self.run_migrations(&database_url).await;
                if !ok {
                    return Ok(());
                }
                self.persist_migrations_marker();
            }
        }

        let port = self.options.backend_port;
        if let Err(e) = self.spawn_backend(port, &database_url).await {
            self.set_state(BackendState::BackendFailed {
                message: format!("Falha ao iniciar o backend: {e}"),
                stderr: None,
            });
            return Ok(());
        }
        self.start_health_poll(port);
        Ok(())
    }

    /// Para o backend: SIGTERM → grace → SIGKILL; depois Postgres (embedded).
    pub async fn stop(&self) -> Result<(), String> {
        let child = self.child.lock().unwrap().take();
        if let Some(child) = child {
            self.stopping.store(true, Ordering::SeqCst);
            self.clear_poll();
            child.kill("SIGTERM");
            let grace = Duration::from_millis(self.options.kill_grace_ms);
            // Aguarda até o exit OU o grace (o watcher marca `has_exited`).
            let deadline = tokio::time::Instant::now() + grace;
            while tokio::time::Instant::now() < deadline && !child.has_exited() {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            // Exit não chegou dentro do grace → força SIGKILL na árvore (D6).
            if !child.has_exited() {
                child.kill("SIGKILL");
                let _ = child.wait().await;
            }
            self.set_state(BackendState::Idle);
            self.stopping.store(false, Ordering::SeqCst);
        }

        if self.options.embedded {
            if let Some(postgres) = &self.options.postgres {
                if let Err(e) = postgres.stop().await {
                    warn!(?e, "Falha ao parar o PostgreSQL embarcado");
                }
            }
        }
        Ok(())
    }

    /// Restart: stop + start.
    pub async fn restart(self: &Arc<Self>) -> Result<(), String> {
        self.stop().await?;
        self.start().await
    }

    pub fn get_status(&self) -> &'static str {
        self.state.lock().unwrap().status()
    }

    pub fn get_state(&self) -> BackendState {
        self.state.lock().unwrap().clone()
    }

    pub fn get_logs(&self) -> BackendLogs {
        BackendLogs {
            stdout: self.stdout_chunks.lock().unwrap().join(""),
            stderr: self.stderr_chunks.lock().unwrap().join(""),
        }
    }

    pub fn is_starting(&self) -> bool {
        matches!(*self.state.lock().unwrap(), BackendState::Starting { .. })
    }

    pub fn kill_child(&self, signal: &str) {
        if let Some(child) = self.child.lock().unwrap().clone() {
            child.kill(signal);
        }
    }

    /// Registra listener de mudança de estado; retorna handle de unsubscribe.
    pub fn on_state_change(
        &self,
        listener: impl Fn(BackendState) + Send + Sync + 'static,
    ) -> Unsubscribe {
        let mut listeners = self.listeners.lock().unwrap();
        let id = self.next_listener_id.fetch_add(1, Ordering::SeqCst);
        listeners.push((id, Box::new(listener)));
        Unsubscribe {
            listeners: self.listeners.clone(),
            id,
        }
    }
}

/// Hash das migrações (paridade com `hashMigrationsDir` do TS, sha256 dos
/// paths ordenados). Estável entre execuções — suporta o marker skip.
fn hash_migrations_dir(resources_backend_path: &Path) -> Option<String> {
    let migrations_dir = resources_backend_path.join("prisma").join("migrations");
    let entries = std::fs::read_dir(&migrations_dir).ok()?;
    let mut files: Vec<String> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_file() {
            files.push(name);
        } else if path.is_dir() {
            if let Ok(nested) = std::fs::read_dir(&path) {
                for n in nested.flatten() {
                    files.push(format!("{name}/{}", n.file_name().to_string_lossy()));
                }
            }
        }
    }
    if files.is_empty() {
        return None;
    }
    files.sort();
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    for file in files {
        hasher.update(file.as_bytes());
    }
    Some(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings_stub(settings: DesktopSettings) -> Arc<dyn SettingsProvider> {
        #[derive(Clone)]
        struct Stub(DesktopSettings);
        impl SettingsProvider for Stub {
            fn get(&self) -> DesktopSettings {
                self.0.clone()
            }
        }
        Arc::new(Stub(settings))
    }

    fn test_settings() -> DesktopSettings {
        DesktopSettings {
            backend_port: 3333,
            database_url: "postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db".to_string(),
            redis_url: "redis://localhost:6379".to_string(),
            jwt_secret: "a".repeat(64),
            managed_postgres_port: None,
        }
    }

    /// Mock spawner: registra chamadas e responde com childs configuráveis.
    #[derive(Default)]
    struct MockSpawner {
        calls: Mutex<Vec<(String, Vec<String>, String)>>,
        migration_exit_code: Mutex<i32>,
        migration_stderr: Mutex<String>,
        backend_exit_code: Mutex<Option<i32>>,
        spawn_error: Mutex<Option<String>>,
    }

    impl MockSpawner {
        fn set_migration_fail(&self, stderr: &str) {
            *self.migration_exit_code.lock().unwrap() = 1;
            *self.migration_stderr.lock().unwrap() = stderr.to_string();
        }
        fn set_backend_exit(&self, code: Option<i32>) {
            *self.backend_exit_code.lock().unwrap() = code;
        }
        fn spawn_calls(&self) -> Vec<(String, Vec<String>, String)> {
            self.calls.lock().unwrap().clone()
        }
    }

    struct MockChild {
        args: Vec<String>,
        migration_exit_code: i32,
        migration_stderr: String,
        backend_exit_code: Option<i32>,
        killed: Mutex<Vec<String>>,
        kill_notify: tokio::sync::Notify,
        exited: std::sync::atomic::AtomicBool,
    }

    #[async_trait]
    impl SpawnedProcess for MockChild {
        fn take_stdout(&self) -> Option<Box<dyn AsyncRead + Send + Unpin>> {
            None
        }
        fn take_stderr(&self) -> Option<Box<dyn AsyncRead + Send + Unpin>> {
            if self.args.iter().any(|a| a == "migrate") && !self.migration_stderr.is_empty() {
                Some(Box::new(std::io::Cursor::new(self.migration_stderr.clone().into_bytes())))
            } else {
                None
            }
        }
        async fn wait(&self) -> Option<i32> {
            if self.args.iter().any(|a| a == "migrate") {
                return Some(self.migration_exit_code);
            }
            // Backend: exit code pré-configurado (exit imediato) OU aguarda kill.
            if let Some(code) = self.backend_exit_code {
                self.exited.store(true, std::sync::atomic::Ordering::SeqCst);
                return Some(code);
            }
            loop {
                if self.exited.load(std::sync::atomic::Ordering::SeqCst) {
                    return Some(0);
                }
                self.kill_notify.notified().await;
            }
        }
        fn has_exited(&self) -> bool {
            self.exited.load(std::sync::atomic::Ordering::SeqCst)
        }
        fn kill(&self, signal: &str) -> bool {
            self.killed.lock().unwrap().push(signal.to_string());
            self.exited.store(true, std::sync::atomic::Ordering::SeqCst);
            self.kill_notify.notify_waiters();
            true
        }
        fn pid(&self) -> Option<u32> {
            Some(4242)
        }
    }

    #[async_trait]
    impl ProcessSpawner for MockSpawner {
        async fn spawn(
            &self,
            cmd: &Path,
            args: &[String],
            cwd: &Path,
            _env: &BTreeMap<String, String>,
        ) -> Result<Box<dyn SpawnedProcess>, String> {
            if let Some(e) = self.spawn_error.lock().unwrap().clone() {
                return Err(e);
            }
            self.calls.lock().unwrap().push((
                cmd.to_string_lossy().to_string(),
                args.to_vec(),
                cwd.to_string_lossy().to_string(),
            ));
            Ok(Box::new(MockChild {
                args: args.to_vec(),
                migration_exit_code: *self.migration_exit_code.lock().unwrap(),
                migration_stderr: self.migration_stderr.lock().unwrap().clone(),
                backend_exit_code: *self.backend_exit_code.lock().unwrap(),
                killed: Mutex::new(Vec::new()),
                kill_notify: tokio::sync::Notify::new(),
                exited: std::sync::atomic::AtomicBool::new(false),
            }))
        }
    }

    /// Mock health checker: devolve a fila; quando vazia, devolve o `default`.
    struct MockHealth {
        responses: Mutex<Vec<bool>>,
        default: bool,
    }
    impl MockHealth {
        fn new(responses: Vec<bool>) -> Self {
            Self {
                responses: Mutex::new(responses),
                default: false,
            }
        }
        fn ok() -> Self {
            Self::new(vec![]).with_default(true)
        }
        fn with_default(mut self, default: bool) -> Self {
            self.default = default;
            self
        }
    }
    #[async_trait]
    impl HealthChecker for MockHealth {
        async fn check(&self, _url: &str) -> bool {
            let mut r = self.responses.lock().unwrap();
            if r.is_empty() {
                self.default
            } else {
                r.remove(0)
            }
        }
    }

    fn base_options(settings: Arc<dyn SettingsProvider>, backend_path: PathBuf) -> BackendManagerOptions {
        BackendManagerOptions {
            settings,
            resources_backend_path: backend_path,
            storage_path: None,
            runtime_path: None,
            backend_port: 3333,
            poll_interval_ms: 5,
            health_timeout_ms: 5_000,
            kill_grace_ms: 1_000,
            managed_migrations: true,
            migrations_marker_path: None,
            node_bin: PathBuf::from("node"),
            embedded: false,
            postgres: None,
        }
    }

    async fn temp_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("mangaink-backend-{label}-{}-{nanos}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn start_spawna_backend_com_env_correto() {
        let backend = temp_dir("env").await;
        std::fs::create_dir_all(backend.join("dist")).unwrap();
        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::ok());
        let manager = Arc::new(BackendManager::with_runners(
            base_options(settings_stub(test_settings()), backend.clone()),
            spawner.clone(),
            health,
        ));

        manager.start().await.unwrap();
        tokio::time::sleep(Duration::from_millis(30)).await;

        let calls = spawner.spawn_calls();
        assert!(calls.len() >= 2);
        let migrate = calls.iter().find(|(_, a, _)| a.iter().any(|x| x == "migrate")).unwrap();
        assert_eq!(migrate.0, "node");
        assert!(migrate.1[0].contains("node_modules"));

        let app = calls.iter().find(|(_, a, _)| a.iter().any(|x| x.ends_with("app.js"))).unwrap();
        assert_eq!(app.0, "node");
        assert!(app.1[0].contains("app.js"));

        assert_eq!(manager.get_state().status(), "ready");
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn health_poll_timeout_leva_backend_failed() {
        let backend = temp_dir("timeout").await;
        std::fs::create_dir_all(backend.join("dist")).unwrap();
        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::new(vec![false, false, false]));
        let mut opts = base_options(settings_stub(test_settings()), backend.clone());
        opts.health_timeout_ms = 50;
        let manager = Arc::new(BackendManager::with_runners(opts, spawner.clone(), health));

        manager.start().await.unwrap();
        tokio::time::sleep(Duration::from_millis(150)).await;

        let state = manager.get_state();
        assert_eq!(state.status(), "backend_failed");
        assert!(matches!(state, BackendState::BackendFailed { .. }));
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn exit_do_child_antes_do_ready_leva_backend_failed() {
        let backend = temp_dir("exit").await;
        std::fs::create_dir_all(backend.join("dist")).unwrap();
        let spawner = Arc::new(MockSpawner::default());
        spawner.set_backend_exit(Some(1));
        let health = Arc::new(MockHealth::new(vec![false]));
        let mut opts = base_options(settings_stub(test_settings()), backend.clone());
        opts.managed_migrations = false;
        let manager = Arc::new(BackendManager::with_runners(opts, spawner.clone(), health));

        manager.start().await.unwrap();
        tokio::time::sleep(Duration::from_millis(50)).await;

        assert_eq!(manager.get_state().status(), "backend_failed");
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn migrations_falham_leva_migration_failed() {
        let backend = temp_dir("migfail").await;
        std::fs::create_dir_all(backend.join("dist")).unwrap();
        let spawner = Arc::new(MockSpawner::default());
        spawner.set_migration_fail("Prisma Migrate failed: connection refused");
        let health = Arc::new(MockHealth::ok());
        let manager = Arc::new(BackendManager::with_runners(
            base_options(settings_stub(test_settings()), backend.clone()),
            spawner.clone(),
            health,
        ));

        manager.start().await.unwrap();

        let state = manager.get_state();
        assert_eq!(state.status(), "migration_failed");
        assert!(matches!(
            state,
            BackendState::MigrationFailed { stderr, .. } if stderr.contains("Prisma Migrate failed")
        ));
        assert!(manager.get_logs().stderr.contains("Prisma Migrate failed"));
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn marker_hash_atual_pula_migrate() {
        let backend = temp_dir("marker").await;
        let migrations = backend.join("prisma").join("migrations");
        std::fs::create_dir_all(migrations.join("0001_init")).unwrap();
        std::fs::write(migrations.join("0001_init").join("migration.sql"), "CREATE TABLE x;").unwrap();

        let expected = hash_migrations_dir(&backend).unwrap();
        let marker = backend.join("marker.txt");
        std::fs::write(&marker, &expected).unwrap();

        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::ok());
        let mut opts = base_options(settings_stub(test_settings()), backend.clone());
        opts.migrations_marker_path = Some(marker);
        let manager = Arc::new(BackendManager::with_runners(opts, spawner.clone(), health));

        manager.start().await.unwrap();
        tokio::time::sleep(Duration::from_millis(30)).await;

        let migrate_calls = spawner
            .spawn_calls()
            .iter()
            .filter(|(_, a, _)| a.iter().any(|x| x == "migrate"))
            .count();
        assert_eq!(migrate_calls, 0);
        assert_eq!(manager.get_state().status(), "ready");
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn marker_hash_divergente_roda_migrate_e_atualiza_marker() {
        let backend = temp_dir("marker2").await;
        let migrations = backend.join("prisma").join("migrations");
        std::fs::create_dir_all(migrations.join("0001_init")).unwrap();
        std::fs::write(migrations.join("0001_init").join("migration.sql"), "CREATE TABLE x;").unwrap();
        let marker = backend.join("marker.txt");
        std::fs::write(&marker, "hash-antigo").unwrap();

        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::ok());
        let mut opts = base_options(settings_stub(test_settings()), backend.clone());
        opts.migrations_marker_path = Some(marker.clone());
        let manager = Arc::new(BackendManager::with_runners(opts, spawner.clone(), health));

        manager.start().await.unwrap();
        tokio::time::sleep(Duration::from_millis(30)).await;

        let migrate_calls = spawner
            .spawn_calls()
            .iter()
            .filter(|(_, a, _)| a.iter().any(|x| x == "migrate"))
            .count();
        assert_eq!(migrate_calls, 1);
        let persisted = std::fs::read_to_string(&marker).unwrap();
        assert_eq!(persisted, hash_migrations_dir(&backend).unwrap());
        assert_eq!(manager.get_state().status(), "ready");
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn managed_migrations_false_pula_migrate() {
        let backend = temp_dir("nomig").await;
        std::fs::create_dir_all(backend.join("dist")).unwrap();
        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::ok());
        let mut opts = base_options(settings_stub(test_settings()), backend.clone());
        opts.managed_migrations = false;
        let manager = Arc::new(BackendManager::with_runners(opts, spawner.clone(), health));

        manager.start().await.unwrap();

        let migrate_calls = spawner
            .spawn_calls()
            .iter()
            .filter(|(_, a, _)| a.iter().any(|x| x == "migrate"))
            .count();
        assert_eq!(migrate_calls, 0);
        assert!(spawner
            .spawn_calls()
            .iter()
            .any(|(_, a, _)| a.iter().any(|x| x.ends_with("app.js"))));
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn restart_mata_child_anterior_e_volta_a_ready() {
        let backend = temp_dir("restart").await;
        std::fs::create_dir_all(backend.join("dist")).unwrap();
        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::ok());
        let mut opts = base_options(settings_stub(test_settings()), backend.clone());
        opts.managed_migrations = false;
        let manager = Arc::new(BackendManager::with_runners(opts, spawner.clone(), health));

        manager.start().await.unwrap();
        tokio::time::sleep(Duration::from_millis(30)).await;
        assert_eq!(manager.get_state().status(), "ready");
        manager.restart().await.unwrap();
        tokio::time::sleep(Duration::from_millis(30)).await;
        assert_eq!(manager.get_state().status(), "ready");
        let apps = spawner
            .spawn_calls()
            .iter()
            .filter(|(_, a, _)| a.iter().any(|x| x.ends_with("app.js")))
            .count();
        assert_eq!(apps, 2);
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn stop_e_idempotente_sem_backend() {
        let backend = temp_dir("stopidle").await;
        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::new(vec![]));
        let manager = Arc::new(BackendManager::with_runners(
            base_options(settings_stub(test_settings()), backend.clone()),
            spawner.clone(),
            health,
        ));
        manager.stop().await.unwrap();
        assert_eq!(manager.get_state().status(), "idle");
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[tokio::test]
    async fn state_listener_recebe_transicoes() {
        let backend = temp_dir("listen").await;
        std::fs::create_dir_all(backend.join("dist")).unwrap();
        let spawner = Arc::new(MockSpawner::default());
        let health = Arc::new(MockHealth::ok());
        let mut opts = base_options(settings_stub(test_settings()), backend.clone());
        opts.managed_migrations = false;
        let manager = Arc::new(BackendManager::with_runners(opts, spawner.clone(), health));

        let transitions = Arc::new(Mutex::new(Vec::new()));
        let t = transitions.clone();
        let _unsub = manager.on_state_change(move |s| t.lock().unwrap().push(s.status().to_string()));

        manager.start().await.unwrap();
        tokio::time::sleep(Duration::from_millis(30)).await;

        let observed = transitions.lock().unwrap().clone();
        assert!(observed.contains(&"starting".to_string()));
        assert!(observed.contains(&"ready".to_string()));
        let _ = std::fs::remove_dir_all(&backend);
    }

    #[test]
    fn hash_migrations_dir_estavel() {
        let dir = std::env::temp_dir().join(format!("mi-hash-{}", std::process::id()));
        let migrations = dir.join("prisma").join("migrations");
        std::fs::create_dir_all(migrations.join("0001_init")).unwrap();
        std::fs::write(migrations.join("0001_init").join("migration.sql"), "CREATE TABLE x;").unwrap();

        let a = hash_migrations_dir(&dir).unwrap();
        let b = hash_migrations_dir(&dir).unwrap();
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
