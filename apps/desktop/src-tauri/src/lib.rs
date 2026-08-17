//! MangaInk Agent — shell desktop Tauri v2 (substitui o Electron).
//!
//! Canal webview↔backend: servidor HTTP local em Rust (axum) em
//! `127.0.0.1:{porta}` (decisão do líder MEC-14 após NO-GO do SPIKE MEC-15).
//! A boot sequence (Task 6) orquestra: settings → modo embedded → Postgres →
//! migrações → spawn do backend → health-poll → servidor local → navegação da
//! janela e emissão de `backend-state`/`backend-logs`.

mod backend_manager;
mod boot;
mod commands;
mod embedded_mode;
mod http_server;
mod postgres_manager;
mod settings_store;
mod status_screen;

use tauri::Manager;

/// Registra os comandos IPC no Builder a partir de uma fonte única.
///
/// Cada entrada é `nome => função`; a macro emite BOTH a const [`REGISTERED_COMMANDS`]
/// (nomes que o frontend/status screen invocam via `invoke(...)`) e o
/// `invoke_handler` usado no Builder. O teste em `lib.rs::tests` valida que os
/// nomes registrados são exatamente os esperados (paridade com os canais do
/// preload Electron: `desktop:get-status` → `get_status`, etc.).
macro_rules! desktop_commands {
    ($($name:literal => $cmd:path),+ $(,)?) => {
        /// Nomes dos comandos IPC registrados no Builder.
        pub const REGISTERED_COMMANDS: &[&str] = &[$($name),+];

        fn invoke_handler() -> impl Fn(tauri::ipc::Invoke) -> bool + Send + Sync + 'static {
            tauri::generate_handler![$($cmd),+]
        }
    };
}

desktop_commands! {
    "get_status" => commands::get_status,
    "retry" => commands::retry,
    "open_logs" => commands::open_logs,
    "open_external" => commands::open_external,
    "get_version" => commands::get_version,
    "get_http_port" => commands::get_http_port,
}

/// Inicializa logging estruturado (tracing).
fn init_tracing() {
    use tracing_subscriber::EnvFilter;
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,mangaink_desktop=debug"));
    let _ = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(true)
        .try_init();
}

/// Entry point do shell Tauri.
pub fn run() {
    init_tracing();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Foca a janela existente quando uma segunda instância tenta abrir.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let app_handle = app.handle().clone();

            match boot::run_boot(&app_handle) {
                Ok(services) => {
                    app_handle.manage(services);
                }
                Err(e) => {
                    tracing::error!(?e, "falha na boot sequence");
                }
            }

            Ok(())
        })
        .invoke_handler(invoke_handler())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Shutdown ordeiro (D6): para o backend + Postgres embarcado.
            if let tauri::RunEvent::ExitRequested { .. } = event {
                boot::shutdown(app_handle);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Os comandos IPC registrados no Builder (via `desktop_commands!`) precisam
    /// bater com o contrato exposto ao frontend/status screen. Paridade com os
    /// canais do preload Electron: `desktop:get-status` → `get_status`, etc.
    /// Se um comando for adicionado/renomeado, esta lista deve ser atualizada.
    #[test]
    fn builder_registra_comandos_esperados() {
        let expected: &[&str] = &[
            "get_status",
            "retry",
            "open_logs",
            "open_external",
            "get_version",
            "get_http_port",
        ];
        assert_eq!(REGISTERED_COMMANDS, expected);
    }

    /// Não pode haver nomes duplicados no registro do Builder (o Tauri faria
    /// match ambíguo no invoke_handler).
    #[test]
    fn nomes_dos_comandos_sao_unicos() {
        let mut sorted = REGISTERED_COMMANDS.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), REGISTERED_COMMANDS.len());
    }

    /// A mesma declaração que produz a lista também gera o invoke_handler usado
    /// no Builder — garante que a lista reflete o que está realmente registrado.
    #[test]
    fn invoke_handler_compila_a_partir_da_mesma_lista() {
        let _handler = invoke_handler();
    }
}
