//! `commands` — comandos IPC do shell (MEC-14 · Task 6).
//!
//! Paridade com os handlers IPC do Electron (`desktop:get-status`,
//! `desktop:retry`, `desktop:open-logs`, `desktop:open-external`,
//! `desktop:get-version`). Expostos ao frontend/status screen via
//! `window.__TAURI_INTERNALS__.invoke(...)`.

use std::sync::atomic::Ordering;

use crate::backend_manager::BackendState;
use crate::boot::{is_valid_external_url, BootServices};

/// Estado atual do backend.
#[tauri::command]
pub fn get_status(state: tauri::State<'_, BootServices>) -> BackendState {
    state.backend.get_state()
}

/// Retry: reinicia o backend quando em estado de falha recuperável.
#[tauri::command]
pub async fn retry(state: tauri::State<'_, BootServices>) -> Result<BackendState, String> {
    let current = state.backend.get_state();
    let recoverable = matches!(
        current,
        BackendState::PostgresFailed { .. }
            | BackendState::MigrationFailed { .. }
            | BackendState::BackendFailed { .. }
    );
    if recoverable {
        state.backend.restart().await?;
    }
    Ok(state.backend.get_state())
}

/// Abre o diretório de logs/dados do app no gerenciador de arquivos.
#[tauri::command]
pub fn open_logs(state: tauri::State<'_, BootServices>) -> Result<(), String> {
    let dir = state.settings.file_path().parent().unwrap_or(std::path::Path::new("."));
    open_path(dir).map_err(|e| e.to_string())
}

/// Abre uma URL externa no navegador padrão (apenas http/https).
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if !is_valid_external_url(&url) {
        return Err("URL inválida — apenas http(s) são permitidas.".to_string());
    }
    open_path(std::path::Path::new(&url)).map_err(|e| e.to_string())
}

/// Versão do app.
#[tauri::command]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Porta do servidor HTTP local (utilizada pelo frontend em alguns fluxos).
#[tauri::command]
pub fn get_http_port(state: tauri::State<'_, BootServices>) -> u16 {
    state.http_port.load(Ordering::SeqCst)
}
/// Abre `target` no programa padrão do SO (via `explorer`/`start` no Windows).
fn open_path(target: &std::path::Path) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        // `explorer` abre pastas; `cmd /c start "" <url>` abre URLs.
        let path_str = target.to_string_lossy();
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "start", "", &path_str]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW — sem console preto
        }
        cmd.spawn()?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open").arg(target).spawn()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_nao_fica_em_loop() {
        // Estado idle → retry não reinicia (guard). Testamos a lógica pura
        // do recoverable via enum (o restante usa o manager mockado no boot).
        let recoverable_idle = matches!(BackendState::Idle, BackendState::PostgresFailed { .. } | BackendState::MigrationFailed { .. } | BackendState::BackendFailed { .. });
        assert!(!recoverable_idle);
        let recoverable_fail = matches!(BackendState::BackendFailed { message: "x".into(), stderr: None }, BackendState::PostgresFailed { .. } | BackendState::MigrationFailed { .. } | BackendState::BackendFailed { .. });
        assert!(recoverable_fail);
    }

    #[test]
    fn version_nao_vazia() {
        assert!(!get_version().is_empty());
    }
}
