//! `embedded_mode` — port Rust de `apps/desktop/src/main/embedded-mode.ts`.
//!
//! Decide se o app desktop roda em modo embedded (Postgres + runtime embarcados,
//! sem Docker/Node/Redis no host) ou usa a infraestrutura do host.
//!
//! - `env_flag == Some("1")` → embedded (override explícito: dev forçado ou produção).
//! - `env_flag == Some("0")` → host infra (override explícito, inclusive packaged — debug com Docker).
//! - sem flag → embedded em produção (`is_packaged`), host infra em dev.

/// Entrada para resolução do modo embedded.
#[derive(Debug, Clone, Default)]
pub struct ResolveEmbeddedModeOptions {
    /// `true` quando o app está empacotado (produção).
    pub is_packaged: bool,
    /// Valor de `MI_EMBEDDED_MODE` (opcional).
    pub env_flag: Option<String>,
}

/// Decide o modo embedded. Ver [`ResolveEmbeddedModeOptions`].
pub fn resolve_embedded_mode(opts: &ResolveEmbeddedModeOptions) -> bool {
    match opts.env_flag.as_deref() {
        Some("1") => true,
        Some("0") => false,
        _ => opts.is_packaged,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts(is_packaged: bool, env_flag: Option<&str>) -> ResolveEmbeddedModeOptions {
        ResolveEmbeddedModeOptions {
            is_packaged,
            env_flag: env_flag.map(str::to_string),
        }
    }

    #[test]
    fn dev_sem_flag_eh_host_infra() {
        assert!(!resolve_embedded_mode(&opts(false, None)));
    }

    #[test]
    fn packaged_sem_flag_eh_embedded() {
        assert!(resolve_embedded_mode(&opts(true, None)));
    }

    #[test]
    fn env_flag_1_forca_embedded_em_dev() {
        assert!(resolve_embedded_mode(&opts(false, Some("1"))));
    }

    #[test]
    fn env_flag_1_forca_embedded_em_producao() {
        assert!(resolve_embedded_mode(&opts(true, Some("1"))));
    }

    #[test]
    fn env_flag_0_forca_host_infra_em_packaged() {
        assert!(!resolve_embedded_mode(&opts(true, Some("0"))));
    }

    #[test]
    fn env_flag_0_forca_host_infra_em_dev() {
        assert!(!resolve_embedded_mode(&opts(false, Some("0"))));
    }

    #[test]
    fn flag_vazia_ou_estranha_trata_como_ausente() {
        assert!(resolve_embedded_mode(&opts(true, Some(""))));
        assert!(!resolve_embedded_mode(&opts(false, Some("lixo"))));
        assert!(resolve_embedded_mode(&opts(true, Some("anything"))));
    }
}
