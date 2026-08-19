//! `settings_store` — port Rust de `apps/desktop/src/main/settings-store.ts`.
//!
//! Store de settings persistidas em `{app_data_dir()}/settings.json`.
//!
//! Decisões (MEC-14 · Task 2, atualizado MEC-30):
//! - **Path nativo do Tauri**: o diretório de dados é resolvido pelo
//!   `app.path().app_data_dir()` no boot (`%APPDATA%\com.mangaink.desktop`,
//!   baseado no `identifier`). O path manual legado `%APPDATA%\MangaInk Agent`
//!   foi abandonado (decisão do usuário) — settings.json, pgdata e storage
//!   vivem exclusivamente na pasta padrão do Tauri.
//! - Em modo embedded, `database_url` e `redis_url` do arquivo são ignoradas pelo
//!   backend_manager; campos mantidos por compatibilidade web/dev.
//! - `managed_postgres_port` é apenas persistido como preferência; a revalidação
//!   de porta livre é responsabilidade do `postgres_manager`.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rand::RngCore;
use serde::{Deserialize, Serialize};

/// Porta padrão do backend Fastify (contrato `apps/backend`).
pub const DEFAULT_BACKEND_PORT: u16 = 3333;
/// URL padrão do Postgres (host infra / dev).
pub const DEFAULT_DATABASE_URL: &str =
    "postgresql://mangaink:mangaink@localhost:5432/mangaink_agent_db";
/// URL padrão do Redis (host infra / dev).
pub const DEFAULT_REDIS_URL: &str = "redis://localhost:6379";

/// Settings persistidas em `settings.json`.
///
/// Serialização em camelCase (paridade byte-a-byte com o arquivo do Electron).
/// `#[serde(default)]` em todos os campos: arquivo legado/parcial (ex.: sem
/// `jwtSecret`) carrega com defaults para os campos ausentes — mesma semântica
/// do merge `{...base, ...parsed}` do TS.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    #[serde(default = "default_backend_port")]
    pub backend_port: u16,
    #[serde(default = "default_database_url")]
    pub database_url: String,
    #[serde(default = "default_redis_url")]
    pub redis_url: String,
    #[serde(default)]
    pub jwt_secret: String,
    /// Token de API injetado no backend como `X_API_TOKEN`.
    /// Gerado automaticamente na primeira execução (hex 32 bytes).
    #[serde(default)]
    pub x_api_token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub managed_postgres_port: Option<u16>,
}

fn default_backend_port() -> u16 {
    DEFAULT_BACKEND_PORT
}

fn default_database_url() -> String {
    DEFAULT_DATABASE_URL.to_string()
}

fn default_redis_url() -> String {
    DEFAULT_REDIS_URL.to_string()
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            backend_port: DEFAULT_BACKEND_PORT,
            database_url: DEFAULT_DATABASE_URL.to_string(),
            redis_url: DEFAULT_REDIS_URL.to_string(),
            jwt_secret: String::new(),
            x_api_token: String::new(),
            managed_postgres_port: None,
        }
    }
}

/// Erros do settings store.
#[derive(Debug)]
pub enum SettingsStoreError {
    Io(std::io::Error),
    Json(serde_json::Error),
}

impl std::fmt::Display for SettingsStoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SettingsStoreError::Io(e) => write!(f, "io error: {e}"),
            SettingsStoreError::Json(e) => write!(f, "json error: {e}"),
        }
    }
}

impl std::error::Error for SettingsStoreError {}

impl From<std::io::Error> for SettingsStoreError {
    fn from(e: std::io::Error) -> Self {
        SettingsStoreError::Io(e)
    }
}

impl From<serde_json::Error> for SettingsStoreError {
    fn from(e: serde_json::Error) -> Self {
        SettingsStoreError::Json(e)
    }
}

/// Gera um JWT secret de 64 hex chars (32 bytes aleatórios) — paridade com
/// `randomBytes(32).toString('hex')` do Electron.
fn generate_jwt_secret() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Gera um X-API-Token de 64 hex chars (32 bytes aleatórios).
fn generate_api_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Escreve `settings.json` atomicamente: grava em `.tmp` e faz `rename`.
///
/// Renomear sobre o arquivo final no Windows usa `MoveFileEx(MOVEFILE_REPLACE_EXISTING)`,
/// então o arquivo ou é o antigo ou o novo — nunca um meio-termo.
async fn write_json_atomic(file_path: &Path, settings: &DesktopSettings) -> Result<(), SettingsStoreError> {
    if let Some(parent) = file_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    let tmp_path = file_path.with_extension(format!("{nanos}.tmp"));
    let json = serde_json::to_string_pretty(settings)?;
    let write_result = tokio::fs::write(&tmp_path, json).await;
    let rename_result = match write_result {
        Ok(()) => tokio::fs::rename(&tmp_path, file_path).await,
        Err(e) => Err(e),
    };
    if rename_result.is_err() {
        let _ = tokio::fs::remove_file(&tmp_path).await;
    }
    rename_result?;
    Ok(())
}

/// Store de settings persistidas (thread-safe).
#[derive(Debug)]
pub struct SettingsStore {
    file_path: PathBuf,
    current: Mutex<DesktopSettings>,
}

/// Contrato de leitura de settings usado pelo `backend_manager` e boot
/// (permite injetar stub em testes).
pub trait SettingsProvider: Send + Sync {
    fn get(&self) -> DesktopSettings;
}

impl SettingsProvider for SettingsStore {
    fn get(&self) -> DesktopSettings {
        SettingsStore::get(self)
    }
}

impl SettingsProvider for DesktopSettings {
    fn get(&self) -> DesktopSettings {
        self.clone()
    }
}

impl<T: SettingsProvider> SettingsProvider for std::sync::Arc<T> {
    fn get(&self) -> DesktopSettings {
        (**self).get()
    }
}

impl SettingsStore {
    /// Cria o store apontando para `file_path`.
    ///
    /// Uso típico: `SettingsStore::new(data_dir.join("settings.json"))` onde
    /// `data_dir` vem de `app.path().app_data_dir()` no boot.
    /// Chame [`load`](Self::load) antes de ler via [`get`](Self::get).
    pub fn new(file_path: PathBuf) -> Self {
        Self {
            file_path,
            current: Mutex::new(DesktopSettings::default()),
        }
    }

    /// Caminho do arquivo de settings usado por este store.
    pub fn file_path(&self) -> &Path {
        &self.file_path
    }

    /// Carrega o arquivo; em arquivo ausente/corrompido cai em defaults.
    ///
    /// Gera e persiste `jwt_secret` quando ausente ou vazio. Sempre que o
    /// arquivo foi lido com falha, estava ausente ou faltava o secret, o arquivo
    /// é reescrito (válido). Retorna os settings carregados.
    pub async fn load(&self) -> Result<DesktopSettings, SettingsStoreError> {
        let mut parsed: Option<DesktopSettings> = None;
        let mut read_failed = false;

        match tokio::fs::read_to_string(&self.file_path).await {
            Ok(raw) => match serde_json::from_str::<DesktopSettings>(&raw) {
                Ok(s) => parsed = Some(s),
                Err(_) => read_failed = true,
            },
            Err(_) => read_failed = true,
        }

        // `#[serde(default)]` preenche campos ausentes com defaults (paridade
        // com `{...base, ...(parsed ?? {})}` do TS).
        let had_parsed = parsed.is_some();
        let mut settings = parsed.unwrap_or_default();

        let missing_jwt = settings.jwt_secret.is_empty();
        if missing_jwt {
            settings.jwt_secret = generate_jwt_secret();
        }

        let missing_token = settings.x_api_token.is_empty();
        if missing_token {
            settings.x_api_token = generate_api_token();
        }

        if read_failed || !had_parsed || missing_jwt || missing_token {
            write_json_atomic(&self.file_path, &settings).await?;
        }

        *self.current.lock().expect("settings lock poisoned") = settings.clone();
        Ok(settings)
    }

    /// Retorna os settings em memória (cópia). Requer `load()` prévio.
    pub fn get(&self) -> DesktopSettings {
        self.current.lock().expect("settings lock poisoned").clone()
    }

    /// Persiste os settings e atualiza o estado em memória.
    #[allow(dead_code)]
    pub async fn save(&self, settings: &DesktopSettings) -> Result<(), SettingsStoreError> {
        write_json_atomic(&self.file_path, settings).await?;
        *self.current.lock().expect("settings lock poisoned") = settings.clone();
        Ok(())
    }

    /// Porta preferida do Postgres gerenciado (embedded), se configurada.
    pub fn get_managed_postgres_port(&self) -> Option<u16> {
        self.get().managed_postgres_port
    }

    /// Persiste a preferência de porta do Postgres gerenciado.
    #[allow(dead_code)]
    pub async fn set_managed_postgres_port(&self, port: u16) -> Result<(), SettingsStoreError> {
        let mut updated = self.get();
        if updated.jwt_secret.is_empty() {
            updated.jwt_secret = generate_jwt_secret();
        }
        updated.managed_postgres_port = Some(port);
        self.save(&updated).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or_default();
        let dir = std::env::temp_dir()
            .join(format!("mangaink-settings-{label}-{}-{nanos}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[tokio::test]
    async fn cria_arquivo_com_defaults_quando_ausente() {
        let dir = unique_dir("missing");
        let file_path = dir.join("settings.json");

        let store = SettingsStore::new(file_path.clone());
        let settings = store.load().await.unwrap();

        assert_eq!(settings.backend_port, DEFAULT_BACKEND_PORT);
        assert_eq!(settings.database_url, DEFAULT_DATABASE_URL);
        assert_eq!(settings.redis_url, DEFAULT_REDIS_URL);
        assert_eq!(settings.jwt_secret.len(), 64);

        let on_disk: serde_json::Value =
            serde_json::from_str(&tokio::fs::read_to_string(&file_path).await.unwrap()).unwrap();
        assert_eq!(on_disk["backendPort"], serde_json::json!(DEFAULT_BACKEND_PORT));
        assert_eq!(on_disk["databaseUrl"], serde_json::json!(DEFAULT_DATABASE_URL));
        assert_eq!(on_disk["jwtSecret"], serde_json::json!(settings.jwt_secret));

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn persiste_e_reutiliza_jwt_secret() {
        let dir = unique_dir("persist");
        let file_path = dir.join("settings.json");

        let first = SettingsStore::new(file_path.clone()).load().await.unwrap();
        assert_eq!(first.jwt_secret.len(), 64);

        let again = SettingsStore::new(file_path).load().await.unwrap();
        assert_eq!(again.jwt_secret, first.jwt_secret);

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn save_atomico_sem_tmp_residual() {
        let dir = unique_dir("atomic");
        let file_path = dir.join("settings.json");

        let store = SettingsStore::new(file_path.clone());
        store.load().await.unwrap();

        let mut updated = store.get();
        updated.backend_port = 4444;
        store.save(&updated).await.unwrap();

        let mut entries = tokio::fs::read_dir(&dir).await.unwrap();
        let mut names = Vec::new();
        while let Some(e) = entries.next_entry().await.unwrap() {
            names.push(e.file_name().to_string_lossy().to_string());
        }
        assert_eq!(names, vec!["settings.json".to_string()]);

        let on_disk: serde_json::Value =
            serde_json::from_str(&tokio::fs::read_to_string(&file_path).await.unwrap()).unwrap();
        assert_eq!(on_disk["backendPort"], serde_json::json!(4444));
        assert_eq!(on_disk["jwtSecret"], serde_json::json!(store.get().jwt_secret));

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn arquivo_corrompido_cai_em_defaults_e_reescreve() {
        let dir = unique_dir("corrupt");
        let file_path = dir.join("settings.json");
        tokio::fs::write(&file_path, "{nao-json").await.unwrap();

        let store = SettingsStore::new(file_path.clone());
        let settings = store.load().await.unwrap();

        assert_eq!(settings.backend_port, DEFAULT_BACKEND_PORT);
        assert_eq!(settings.database_url, DEFAULT_DATABASE_URL);
        assert_eq!(settings.redis_url, DEFAULT_REDIS_URL);

        let on_disk: serde_json::Value =
            serde_json::from_str(&tokio::fs::read_to_string(&file_path).await.unwrap()).unwrap();
        assert_eq!(on_disk["backendPort"], serde_json::json!(DEFAULT_BACKEND_PORT));
        assert_eq!(on_disk["jwtSecret"].as_str().unwrap().len(), 64);

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn arquivo_legado_sem_secret_carrega_e_gera_secret() {
        let dir = unique_dir("legacy");
        let file_path = dir.join("settings.json");
        tokio::fs::write(
            &file_path,
            serde_json::json!({
                "backendPort": 4000,
                "databaseUrl": DEFAULT_DATABASE_URL,
                "redisUrl": DEFAULT_REDIS_URL,
            })
            .to_string(),
        )
        .await
        .unwrap();

        let store = SettingsStore::new(file_path.clone());
        let settings = store.load().await.unwrap();

        assert_eq!(settings.backend_port, 4000);
        assert_eq!(settings.database_url, DEFAULT_DATABASE_URL);
        assert!(settings.managed_postgres_port.is_none());
        assert_eq!(settings.jwt_secret.len(), 64);

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[tokio::test]
    async fn set_managed_postgres_port_roundtrip_sem_reescrever_secret() {
        let dir = unique_dir("set-managed");
        let file_path = dir.join("settings.json");

        let store = SettingsStore::new(file_path.clone());
        let before = store.load().await.unwrap();
        let jwt = before.jwt_secret.clone();

        store.set_managed_postgres_port(54321).await.unwrap();
        assert_eq!(store.get_managed_postgres_port(), Some(54321));

        let on_disk: serde_json::Value =
            serde_json::from_str(&tokio::fs::read_to_string(&file_path).await.unwrap()).unwrap();
        assert_eq!(on_disk["managedPostgresPort"], serde_json::json!(54321));
        assert_eq!(on_disk["jwtSecret"], serde_json::json!(jwt));
        assert_eq!(on_disk["backendPort"], serde_json::json!(DEFAULT_BACKEND_PORT));

        let reloaded = SettingsStore::new(file_path).load().await.unwrap();
        assert_eq!(reloaded.managed_postgres_port, Some(54321));
        assert_eq!(reloaded.jwt_secret, jwt);

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }

    #[test]
    fn camel_case_roundtrip_matches_electron_keys() {
        let s = DesktopSettings {
            backend_port: 3333,
            database_url: DEFAULT_DATABASE_URL.to_string(),
            redis_url: DEFAULT_REDIS_URL.to_string(),
            jwt_secret: "abc".to_string(),
            x_api_token: "tok".to_string(),
            managed_postgres_port: Some(55432),
        };
        let json = serde_json::to_value(&s).unwrap();
        let obj = json.as_object().unwrap();
        assert!(obj.contains_key("backendPort"));
        assert!(obj.contains_key("databaseUrl"));
        assert!(obj.contains_key("redisUrl"));
        assert!(obj.contains_key("jwtSecret"));
        assert!(obj.contains_key("xApiToken"));
        assert!(obj.contains_key("managedPostgresPort"));
        assert!(!obj.contains_key("backend_port"));
    }

    #[tokio::test]
    async fn gera_e_persiste_x_api_token() {
        let dir = unique_dir("x-api-token");
        let file_path = dir.join("settings.json");

        let first = SettingsStore::new(file_path.clone()).load().await.unwrap();
        assert_eq!(first.x_api_token.len(), 64);

        let again = SettingsStore::new(file_path).load().await.unwrap();
        assert_eq!(again.x_api_token, first.x_api_token);

        let _ = tokio::fs::remove_dir_all(&dir).await;
    }
}
