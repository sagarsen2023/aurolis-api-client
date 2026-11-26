pub mod api;
pub mod auth;
pub mod sync;

pub const API_VERSION: &str = "2022-11-28";

pub fn client_id() -> &'static str {
    option_env!("VITE_PUBLIC_GITHUB_CLIENT_ID").unwrap_or("")
}

pub fn app_slug() -> &'static str {
    option_env!("VITE_PUBLIC_GITHUB_APP_SLUG").unwrap_or("")
}
