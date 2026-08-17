//! `postgres_manager` — port Rust de `apps/desktop/src/main/postgres-manager.ts`.
//!
//! Orquestra o PostgreSQL 16.8 embarcado (modo embedded):
//!   - `initdb` uma vez (quando `PG_VERSION` não existe no data dir);
//!   - `pg_ctl start` com porta livre (via `portpicker`, respeitando a preferência
//!     persistida em settings `managed_postgres_port`);
//!   - readiness poll via `psql -tAc 'SELECT 1'`;
//!   - `createdb` quando o banco não existe;
//!   - `pg_ctl stop -m fast -w` no shutdown.
//!
//! Binários resolvidos de `resource_dir()/runtime/postgres/bin` (paridade com o
//! `bundle.resources`). v1 = Windows x64 (`.exe`).
//!
//! A execução de binários é abstraída pelo trait [`ProcessRunner`] — a
//! implementação real usa `tokio::process::Command`; os testes usam mocks
//! (mesma estratégia dos testes vitest do Electron).

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use tokio::process::Command;

/// `CREATE_NO_WINDOW` — impede a criação de console preto ao spawnar binários
/// do Postgres embarcado no Windows (initdb/pg_ctl/psql/createdb).
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Aplica `CREATE_NO_WINDOW` a um `tokio::process::Command` no Windows.
#[cfg(target_os = "windows")]
fn hide_console(cmd: &mut Command) {
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Erro de operação do Postgres embarcado.
#[derive(Debug, Clone)]
pub struct PostgresManagerError {
    message: String,
    stderr: Option<String>,
}

impl PostgresManagerError {
    pub fn new(message: impl Into<String>, stderr: Option<String>) -> Self {
        Self {
            message: message.into(),
            stderr,
        }
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn stderr(&self) -> Option<&str> {
        self.stderr.as_deref()
    }
}

impl std::fmt::Display for PostgresManagerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for PostgresManagerError {}

/// `true` se o stderr indica que o servidor não está rodando (stop tolerante).
fn stderr_says_not_running(stderr: &str) -> bool {
    let lower = stderr.to_ascii_lowercase();
    ["not running", "does not run", "no server"]
        .iter()
        .any(|needle| lower.contains(needle))
}

/// Resultado de um comando executado até o fim.
#[derive(Debug, Clone)]
pub struct CmdOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    pub exit_code: Option<i32>,
}

/// Abstrai a execução de binários (paridade com `execFile`/`spawn` do Node).
#[async_trait]
pub trait ProcessRunner: Send + Sync {
    /// Executa um binário até o fim (execFile) e devolve stdout/stderr.
    async fn run(&self, cmd: &Path, args: &[String]) -> Result<CmdOutput, PostgresManagerError>;

    /// Executa um binário aguardando o exit (usado pelo `pg_ctl start`, que
    /// captura stderr e resolve quando o processo termina).
    async fn spawn_and_wait(&self, cmd: &Path, args: &[String]) -> Result<CmdOutput, PostgresManagerError>;
}

/// Implementação real: `tokio::process::Command`.
#[derive(Debug, Default, Clone)]
pub struct TokioProcessRunner;

#[async_trait]
impl ProcessRunner for TokioProcessRunner {
    async fn run(&self, cmd: &Path, args: &[String]) -> Result<CmdOutput, PostgresManagerError> {
        let mut command = Command::new(cmd);
        command.args(args);
        #[cfg(target_os = "windows")]
        hide_console(&mut command);
        let output = command.output().await.map_err(|e| {
            PostgresManagerError::new(format!("{} falhou ao executar: {e}", cmd.display()), None)
        })?;
        Ok(CmdOutput {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            success: output.status.success(),
            exit_code: output.status.code(),
        })
    }

    async fn spawn_and_wait(&self, cmd: &Path, args: &[String]) -> Result<CmdOutput, PostgresManagerError> {
        let mut command = Command::new(cmd);
        command
            .args(args)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped());
        #[cfg(target_os = "windows")]
        hide_console(&mut command);
        let mut child = command
            .spawn()
            .map_err(|e| PostgresManagerError::new(format!("{} falhou ao spawnar: {e}", cmd.display()), None))?;

        // `pg_ctl -w start` spawna o `postgres`, que HERDA o handle do stderr:
        // ler até EOF bloquearia para sempre. Então lemos incrementalmente numa
        // task e a abortamos assim que o pg_ctl sai.
        let stderr_buf = Arc::new(Mutex::new(String::new()));
        let reader = if let Some(mut err_pipe) = child.stderr.take() {
            let buf = stderr_buf.clone();
            Some(tokio::spawn(async move {
                use tokio::io::AsyncReadExt;
                let mut chunk = [0u8; 4096];
                loop {
                    match err_pipe.read(&mut chunk).await {
                        Ok(0) | Err(_) => break,
                        Ok(n) => buf
                            .lock()
                            .unwrap()
                            .push_str(&String::from_utf8_lossy(&chunk[..n])),
                    }
                }
            }))
        } else {
            None
        };

        let status = child.wait().await.map_err(|e| {
            PostgresManagerError::new(format!("{} falhou ao aguardar: {e}", cmd.display()), None)
        })?;

        if let Some(task) = reader {
            task.abort();
        }

        let stderr = stderr_buf.lock().unwrap().clone();
        Ok(CmdOutput {
            stdout: String::new(),
            stderr,
            success: status.success(),
            exit_code: status.code(),
        })
    }
}

/// Opções de construção do manager.
#[derive(Debug, Clone)]
pub struct PostgresManagerOptions {
    /// Diretório com os binários (`initdb.exe`, `pg_ctl.exe`, `psql.exe`, `createdb.exe`).
    pub runtime_postgres_bin: PathBuf,
    /// Diretório de dados do cluster (`PGDATA`).
    pub data_dir: PathBuf,
    /// Porta fixa (preferência persistida). `None` → porta livre em runtime.
    pub port: Option<u16>,
    /// Host de bind/connect. Default `127.0.0.1`.
    pub host: String,
    /// Nome do banco de dados. Default `mangaink_agent_db`.
    pub database_name: String,
    /// Intervalo do readiness poll. Default 300ms.
    pub poll_interval_ms: u64,
    /// Timeout total do readiness. Default 30s.
    pub start_timeout_ms: u64,
}

impl Default for PostgresManagerOptions {
    fn default() -> Self {
        Self {
            runtime_postgres_bin: PathBuf::new(),
            data_dir: PathBuf::new(),
            port: None,
            host: "127.0.0.1".to_string(),
            database_name: "mangaink_agent_db".to_string(),
            poll_interval_ms: 300,
            start_timeout_ms: 30_000,
        }
    }
}

/// Manager do Postgres embarcado.
///
/// Thread-safe: `start`/`stop` são idempotentes (múltiplas chamadas são no-ops).
pub struct PostgresManager {
    options: PostgresManagerOptions,
    runner: Arc<dyn ProcessRunner>,
    running: AtomicBool,
    port: Mutex<Option<u16>>,
}

impl std::fmt::Debug for PostgresManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PostgresManager")
            .field("options", &self.options)
            .field("running", &self.is_running())
            .finish()
    }
}

impl PostgresManager {
    pub fn new(options: PostgresManagerOptions) -> Self {
        let initial_port = options.port;
        Self {
            options,
            runner: Arc::new(TokioProcessRunner),
            running: AtomicBool::new(false),
            port: Mutex::new(initial_port),
        }
    }

    /// Construtor com runner customizado (testes).
    #[allow(dead_code)]
    pub fn with_runner(options: PostgresManagerOptions, runner: Arc<dyn ProcessRunner>) -> Self {
        let initial_port = options.port;
        Self {
            options,
            runner,
            running: AtomicBool::new(false),
            port: Mutex::new(initial_port),
        }
    }

    fn bin(&self, name: &str) -> PathBuf {
        self.options.runtime_postgres_bin.join(format!("{name}.exe"))
    }

    async fn run(&self, name: &str, args: &[String]) -> Result<CmdOutput, PostgresManagerError> {
        self.runner.run(&self.bin(name), args).await
    }

    async fn start_server(&self) -> Result<(), PostgresManagerError> {
        let port = self.get_port()?;
        let log_path = self.options.data_dir.join("postgres.log");
        let args = vec![
            "-D".to_string(),
            self.options.data_dir.to_string_lossy().to_string(),
            "-l".to_string(),
            log_path.to_string_lossy().to_string(),
            "-o".to_string(),
            format!("-p {port} -h {}", self.options.host),
            "-w".to_string(),
            "start".to_string(),
        ];

        let out = self.runner.spawn_and_wait(&self.bin("pg_ctl"), &args).await?;
        if !out.success {
            return Err(PostgresManagerError::new(
                format!("pg_ctl start falhou (exit {:?}).", out.exit_code),
                Some(out.stderr),
            ));
        }
        Ok(())
    }

    async fn wait_for_readiness(&self) -> Result<(), PostgresManagerError> {
        let deadline = tokio::time::Instant::now() + Duration::from_millis(self.options.start_timeout_ms);
        let mut last_stderr: Option<String> = None;
        loop {
            let args = vec![
                "-h".to_string(),
                self.options.host.clone(),
                "-p".to_string(),
                self.get_port()?.to_string(),
                "-U".to_string(),
                "postgres".to_string(),
                "-tAc".to_string(),
                "SELECT 1".to_string(),
            ];
            match self.run("psql", &args).await {
                Ok(out) => {
                    if out.stdout.trim() == "1" {
                        return Ok(());
                    }
                    last_stderr = Some(out.stdout);
                }
                Err(e) => {
                    last_stderr = e.stderr().map(str::to_string).or(last_stderr);
                }
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(PostgresManagerError::new(
                    format!("PostgreSQL não respondeu em {}ms.", self.options.start_timeout_ms),
                    last_stderr,
                ));
            }
            tokio::time::sleep(Duration::from_millis(self.options.poll_interval_ms)).await;
        }
    }

    async fn ensure_database(&self) -> Result<(), PostgresManagerError> {
        let check_args = vec![
            "-h".to_string(),
            self.options.host.clone(),
            "-p".to_string(),
            self.get_port()?.to_string(),
            "-U".to_string(),
            "postgres".to_string(),
            "-tAc".to_string(),
            format!("SELECT 1 FROM pg_database WHERE datname='{}'", self.options.database_name),
        ];
        let check = self.run("psql", &check_args).await?;
        if check.stdout.trim() == "1" {
            return Ok(());
        }
        let createdb_args = vec![
            "-h".to_string(),
            self.options.host.clone(),
            "-p".to_string(),
            self.get_port()?.to_string(),
            "-U".to_string(),
            "postgres".to_string(),
            self.options.database_name.clone(),
        ];
        self.run("createdb", &createdb_args).await?;
        Ok(())
    }

    /// Sobe o cluster: initdb (1ª vez) → porta → pg_ctl start → readiness → createdb.
    pub async fn start(&self) -> Result<(), PostgresManagerError> {
        if self.running.load(Ordering::SeqCst) {
            return Ok(());
        }

        if !self.options.data_dir.join("PG_VERSION").exists() {
            let args = vec![
                "-D".to_string(),
                self.options.data_dir.to_string_lossy().to_string(),
                "-U".to_string(),
                "postgres".to_string(),
                "--auth=trust".to_string(),
                "-E".to_string(),
                "UTF8".to_string(),
            ];
            let out = self.run("initdb", &args).await.map_err(|e| {
                PostgresManagerError::new(
                    format!("initdb falhou: {}", e.message()),
                    e.stderr().map(str::to_string),
                )
            })?;
            if !out.success {
                return Err(PostgresManagerError::new(
                    format!("initdb falhou (exit {:?}).", out.exit_code),
                    Some(out.stderr),
                ));
            }
        }

        {
            let mut port = self.port.lock().unwrap();
            if port.is_none() {
                let free = portpicker::pick_unused_port()
                    .ok_or_else(|| PostgresManagerError::new("Não foi possível obter uma porta livre.", None))?;
                *port = Some(free);
            }
        }

        self.start_server().await?;
        self.wait_for_readiness().await?;
        self.ensure_database().await?;

        self.running.store(true, Ordering::SeqCst);
        Ok(())
    }

    /// Para o cluster: `pg_ctl -m fast -w stop`. Tolerante a "not running".
    pub async fn stop(&self) -> Result<(), PostgresManagerError> {
        if !self.running.load(Ordering::SeqCst) {
            return Ok(());
        }
        let args = vec![
            "-D".to_string(),
            self.options.data_dir.to_string_lossy().to_string(),
            "-m".to_string(),
            "fast".to_string(),
            "-w".to_string(),
            "stop".to_string(),
        ];
        match self.run("pg_ctl", &args).await {
            Ok(out) => {
                if !out.success && !stderr_says_not_running(&out.stderr) {
                    return Err(PostgresManagerError::new(
                        format!("pg_ctl stop falhou (exit {:?}).", out.exit_code),
                        Some(out.stderr),
                    ));
                }
            }
            Err(e) => {
                if !e.stderr().map(stderr_says_not_running).unwrap_or(false) {
                    return Err(e);
                }
            }
        }
        self.running.store(false, Ordering::SeqCst);
        Ok(())
    }

    /// Porta efetiva do cluster.
    pub fn get_port(&self) -> Result<u16, PostgresManagerError> {
        self.port
            .lock()
            .unwrap()
            .ok_or_else(|| PostgresManagerError::new("Porta ainda não determinada — chame start() primeiro.", None))
    }

    /// URL de conexão (`postgresql://postgres@{host}:{port}/{db}`).
    pub fn get_database_url(&self) -> Result<String, PostgresManagerError> {
        Ok(format!(
            "postgresql://postgres@{}:{}/{}",
            self.options.host,
            self.get_port()?,
            self.options.database_name
        ))
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Diretório de dados usado (para testes/observabilidade).
    #[allow(dead_code)]
    pub fn data_dir(&self) -> &Path {
        &self.options.data_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// Mock de runner: roteia por basename do binário.
    #[derive(Default)]
    struct MockRunner {
        calls: Mutex<Vec<(String, Vec<String>)>>,
        psql_stdout: Mutex<HashMap<String, String>>,
        pg_ctl_start_exit: Mutex<Option<i32>>,
        pg_ctl_start_stderr: Mutex<Option<String>>,
        pg_ctl_stop_stderr: Mutex<Option<String>>,
        initdb_error: Mutex<Option<(String, String)>>,
    }

    impl MockRunner {
        fn set_psql(&self, sql_contains: &str, stdout: &str) {
            self.psql_stdout.lock().unwrap().insert(sql_contains.to_string(), stdout.to_string());
        }
        fn set_pg_ctl_start_fail(&self, code: i32, stderr: &str) {
            *self.pg_ctl_start_exit.lock().unwrap() = Some(code);
            *self.pg_ctl_start_stderr.lock().unwrap() = Some(stderr.to_string());
        }
        fn set_pg_ctl_stop_stderr(&self, stderr: &str) {
            *self.pg_ctl_stop_stderr.lock().unwrap() = Some(stderr.to_string());
        }
        fn set_initdb_error(&self, msg: &str, stderr: &str) {
            *self.initdb_error.lock().unwrap() = Some((msg.to_string(), stderr.to_string()));
        }
        fn calls_for(&self, exe: &str) -> Vec<Vec<String>> {
            self.calls
                .lock()
                .unwrap()
                .iter()
                .filter(|(cmd, _)| cmd.ends_with(&format!("{exe}.exe")))
                .map(|(_, args)| args.clone())
                .collect()
        }
    }

    #[async_trait]
    impl ProcessRunner for MockRunner {
        async fn run(&self, cmd: &Path, args: &[String]) -> Result<CmdOutput, PostgresManagerError> {
            self.calls.lock().unwrap().push((cmd.to_string_lossy().to_string(), args.to_vec()));
            let base = cmd.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

            if base == "initdb.exe" {
                if let Some((msg, stderr)) = self.initdb_error.lock().unwrap().clone() {
                    return Err(PostgresManagerError::new(msg, Some(stderr)));
                }
                return Ok(CmdOutput { stdout: String::new(), stderr: String::new(), success: true, exit_code: Some(0) });
            }

            if base == "psql.exe" {
                let sql = args.last().cloned().unwrap_or_default();
                let map = self.psql_stdout.lock().unwrap();
                if sql.contains("pg_database") {
                    let stdout = map.get("pg_database").cloned().unwrap_or_default();
                    return Ok(CmdOutput { stdout, stderr: String::new(), success: true, exit_code: Some(0) });
                }
                let stdout = map.get("SELECT 1").cloned().unwrap_or_else(|| "1".to_string());
                return Ok(CmdOutput { stdout, stderr: String::new(), success: true, exit_code: Some(0) });
            }

            if base == "pg_ctl.exe" {
                if args.iter().any(|a| a == "stop") {
                    let stderr = self.pg_ctl_stop_stderr.lock().unwrap().clone().unwrap_or_default();
                    let ok = stderr.is_empty();
                    return Ok(CmdOutput { stdout: String::new(), stderr, success: ok, exit_code: if ok { Some(0) } else { Some(4) } });
                }
                // start
                let code = *self.pg_ctl_start_exit.lock().unwrap();
                let stderr = self.pg_ctl_start_stderr.lock().unwrap().clone();
                return match (code, stderr) {
                    (Some(c), Some(s)) => Ok(CmdOutput { stdout: String::new(), stderr: s, success: false, exit_code: Some(c) }),
                    _ => Ok(CmdOutput { stdout: String::new(), stderr: String::new(), success: true, exit_code: Some(0) }),
                };
            }

            Ok(CmdOutput { stdout: String::new(), stderr: String::new(), success: true, exit_code: Some(0) })
        }

        async fn spawn_and_wait(&self, cmd: &Path, args: &[String]) -> Result<CmdOutput, PostgresManagerError> {
            self.run(cmd, args).await
        }
    }

    fn options(data_dir: &Path, port: Option<u16>) -> PostgresManagerOptions {
        PostgresManagerOptions {
            runtime_postgres_bin: PathBuf::from("C:/fake/runtime/postgres/bin"),
            data_dir: data_dir.to_path_buf(),
            port,
            host: "127.0.0.1".to_string(),
            database_name: "mangaink_agent_db".to_string(),
            poll_interval_ms: 5,
            start_timeout_ms: 200,
        }
    }

    async fn unique_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("mangaink-pg-{label}-{}-{nanos}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn primeiro_start_initdb_ctl_psql_createdb() {
        let data_dir = unique_dir("case1").await;
        let mock = Arc::new(MockRunner::default());
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        manager.start().await.unwrap();
        manager.start().await.unwrap(); // idempotente

        let initdb = mock.calls_for("initdb");
        assert_eq!(initdb.len(), 1);
        assert_eq!(
            initdb[0],
            ["-D", &data_dir.to_string_lossy(), "-U", "postgres", "--auth=trust", "-E", "UTF8"]
                .iter().map(|s| s.to_string()).collect::<Vec<_>>()
        );

        let pg_ctl = mock.calls_for("pg_ctl").into_iter().find(|a| a.iter().any(|x| x == "start")).unwrap();
        assert_eq!(
            pg_ctl,
            vec![
                "-D".to_string(), data_dir.to_string_lossy().to_string(),
                "-l".to_string(), data_dir.join("postgres.log").to_string_lossy().to_string(),
                "-o".to_string(), "-p 55432 -h 127.0.0.1".to_string(),
                "-w".to_string(), "start".to_string(),
            ]
        );

        let psql = mock.calls_for("psql");
        assert!(psql.len() >= 2);
        let db_check = psql.iter().find(|a| a.last().map(|s| s.contains("pg_database")).unwrap_or(false)).unwrap();
        assert_eq!(
            *db_check,
            vec![
                "-h".to_string(), "127.0.0.1".to_string(),
                "-p".to_string(), "55432".to_string(),
                "-U".to_string(), "postgres".to_string(),
                "-tAc".to_string(), "SELECT 1 FROM pg_database WHERE datname='mangaink_agent_db'".to_string(),
            ]
        );

        let createdb = mock.calls_for("createdb");
        assert_eq!(createdb.len(), 1);
        assert_eq!(
            createdb[0],
            vec![
                "-h".to_string(), "127.0.0.1".to_string(),
                "-p".to_string(), "55432".to_string(),
                "-U".to_string(), "postgres".to_string(),
                "mangaink_agent_db".to_string(),
            ]
        );

        assert!(manager.is_running());
        assert_eq!(manager.get_port().unwrap(), 55432);
        assert_eq!(manager.get_database_url().unwrap(), "postgresql://postgres@127.0.0.1:55432/mangaink_agent_db");
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn start_com_pg_version_nao_chama_initdb() {
        let data_dir = unique_dir("case2").await;
        std::fs::write(data_dir.join("PG_VERSION"), "16\n").unwrap();
        let mock = Arc::new(MockRunner::default());
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        manager.start().await.unwrap();

        assert_eq!(mock.calls_for("initdb").len(), 0);
        assert!(manager.is_running());
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn porta_auto_quando_nao_injetada() {
        let data_dir = unique_dir("case3").await;
        let mock = Arc::new(MockRunner::default());
        let opts = options(&data_dir, None);
        let manager = PostgresManager::with_runner(opts, mock.clone());

        manager.start().await.unwrap();

        let port = manager.get_port().unwrap();
        assert!(port > 0);
        assert_eq!(manager.get_database_url().unwrap(), format!("postgresql://postgres@127.0.0.1:{port}/mangaink_agent_db"));
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn falha_initdb_retorna_erro_com_stderr() {
        let data_dir = unique_dir("case4").await;
        let mock = Arc::new(MockRunner::default());
        mock.set_initdb_error("initdb falhou", "ERRO: sem permissão em C:\\pgdata");
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        let err = manager.start().await.unwrap_err();
        assert!(err.message().contains("initdb"));
        assert_eq!(err.stderr(), Some("ERRO: sem permissão em C:\\pgdata"));
        assert!(!manager.is_running());
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn falha_pg_ctl_start_retorna_erro_com_stderr() {
        let data_dir = unique_dir("case5").await;
        let mock = Arc::new(MockRunner::default());
        mock.set_pg_ctl_start_fail(1, "pg_ctl: could not start server");
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        let err = manager.start().await.unwrap_err();
        assert!(err.message().contains("pg_ctl"));
        assert_eq!(err.stderr(), Some("pg_ctl: could not start server"));
        assert!(!manager.is_running());
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn banco_ja_existe_nao_chama_createdb() {
        let data_dir = unique_dir("case6").await;
        let mock = Arc::new(MockRunner::default());
        mock.set_psql("pg_database", "1\n");
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        manager.start().await.unwrap();

        assert_eq!(mock.calls_for("createdb").len(), 0);
        assert!(manager.is_running());
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn stop_usa_flags_corretas_e_segundo_stop_noop() {
        let data_dir = unique_dir("case7").await;
        let mock = Arc::new(MockRunner::default());
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        manager.start().await.unwrap();
        assert!(manager.is_running());

        manager.stop().await.unwrap();
        assert!(!manager.is_running());
        let stop_calls = mock.calls_for("pg_ctl").into_iter().filter(|a| a.iter().any(|x| x == "stop")).count();
        assert_eq!(stop_calls, 1);

        manager.stop().await.unwrap();
        assert_eq!(
            mock.calls_for("pg_ctl").into_iter().filter(|a| a.iter().any(|x| x == "stop")).count(),
            1
        );

        let mock2 = Arc::new(MockRunner::default());
        let fresh = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock2.clone());
        fresh.stop().await.unwrap();
        assert_eq!(mock2.calls_for("pg_ctl").len(), 0);
        assert!(!fresh.is_running());
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn stop_com_not_running_e_tolerado() {
        let data_dir = unique_dir("case8").await;
        let mock = Arc::new(MockRunner::default());
        mock.set_pg_ctl_stop_stderr("pg_ctl: server does not run");
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        manager.start().await.unwrap();
        manager.stop().await.unwrap();
        assert!(!manager.is_running());
        let _ = std::fs::remove_dir_all(&data_dir);
    }

    #[tokio::test]
    async fn is_running_reflete_estado() {
        let data_dir = unique_dir("case9").await;
        let mock = Arc::new(MockRunner::default());
        let manager = PostgresManager::with_runner(options(&data_dir, Some(55432)), mock.clone());

        assert!(!manager.is_running());
        manager.start().await.unwrap();
        assert!(manager.is_running());
        manager.stop().await.unwrap();
        assert!(!manager.is_running());
        let _ = std::fs::remove_dir_all(&data_dir);
    }
}

/// Teste de integração real com os binários do Postgres embarcado.
///
/// Roda apenas quando os binários existem (var `MI_PG_RUNTIME_BIN` ou o path
/// padrão do runtime no repo de referência). Usa um data dir temporário — o
/// cluster é inicializado, sobe, responde a `SELECT 1`, cria o banco e para.
/// Cobre o fluxo completo `initdb → pg_ctl start → readiness → createdb → stop`.
#[cfg(test)]
mod integration {
    use super::*;

    fn runtime_postgres_bin() -> Option<PathBuf> {
        if let Ok(dir) = std::env::var("MI_PG_RUNTIME_BIN") {
            let p = PathBuf::from(dir);
            if p.join("initdb.exe").exists() {
                return Some(p);
            }
        }
        // Path padrão no repo de referência (original read-only; rodar não o modifica).
        let candidates = [
            "C:/Users/devca/OneDrive/Documentos/developer/mangaink-agent/apps/desktop/resources/runtime/postgres/bin",
            "C:/Users/devca/OneDrive/Documentos/developer/mangaink-agent/apps/desktop/dist/win-unpacked/resources/runtime/postgres/bin",
        ];
        for c in candidates {
            let p = PathBuf::from(c);
            if p.join("initdb.exe").exists() {
                return Some(p);
            }
        }
        None
    }

    #[tokio::test]
    async fn ciclo_completo_initdb_start_readiness_createdb_stop() {
        let Some(bin) = runtime_postgres_bin() else {
            eprintln!("SKIP: binários Postgres não encontrados (defina MI_PG_RUNTIME_BIN)");
            return;
        };

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let data_dir = std::env::temp_dir().join(format!("mangaink-pg-int-{}-{nanos}", std::process::id()));
        std::fs::create_dir_all(&data_dir).unwrap();

        let opts = PostgresManagerOptions {
            runtime_postgres_bin: bin.clone(),
            data_dir: data_dir.clone(),
            port: None,
            host: "127.0.0.1".to_string(),
            database_name: "mangaink_agent_db".to_string(),
            poll_interval_ms: 200,
            start_timeout_ms: 60_000,
        };
        let manager = PostgresManager::new(opts);

        // start deve criar o cluster, subir o servidor, validar readiness e criar o banco.
        manager
            .start()
            .await
            .unwrap_or_else(|e| panic!("start falhou: {} (stderr: {:?})", e.message(), e.stderr()));
        assert!(manager.is_running());
        assert!(manager.get_port().is_ok());
        assert!(manager.data_dir().join("PG_VERSION").exists());

        // Criação real do banco: conectar via psql e confirmar SELECT 1.
        let url = manager.get_database_url().unwrap();
        let check = Command::new(bin.join("psql.exe"))
            .args([
                "-h", "127.0.0.1",
                "-p", &manager.get_port().unwrap().to_string(),
                "-U", "postgres",
                "-d", "mangaink_agent_db",
                "-tAc", "SELECT 1",
            ])
            .output()
            .await
            .expect("psql deve rodar");
        assert_eq!(
            String::from_utf8_lossy(&check.stdout).trim(),
            "1",
            "banco mangaink_agent_db deve responder SELECT 1 (psql stderr: {})",
            String::from_utf8_lossy(&check.stderr)
        );

        // stop encerra o servidor.
        manager
            .stop()
            .await
            .unwrap_or_else(|e| panic!("stop falhou: {} (stderr: {:?})", e.message(), e.stderr()));
        assert!(!manager.is_running());

        let _ = std::fs::remove_dir_all(&data_dir);
        eprintln!("OK: integração real postgres_manager passou (url {url})");
    }
}
