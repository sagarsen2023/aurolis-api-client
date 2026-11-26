use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::github::{API_VERSION, client_id};
use crate::paths::{AppPaths, write_atomic};
use crate::vault::Vault;

const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const USER_URL: &str = "https://api.github.com/user";
const DEVICE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";
const DEAD_REFRESH_ERRORS: [&str; 3] = [
    "bad_refresh_token",
    "incorrect_client_credentials",
    "unauthorized_client",
];
const EXPIRY_SKEW_MS: i64 = 60_000;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GithubUser {
    pub id: u64,
    pub login: String,
    pub name: Option<String>,
    pub avatar_url: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub signed_in: bool,
    pub user: Option<GithubUser>,
}

#[derive(Debug, Clone)]
pub enum TokenState {
    Ready(String),
    Offline,
    SignedOut,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Session {
    access_token: String,
    refresh_token: Option<String>,
    access_token_expires_at: Option<i64>,
    refresh_token_expires_at: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct TokenResponse {
    access_token: Option<String>,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
    refresh_token_expires_in: Option<i64>,
    error: Option<String>,
    interval: Option<u64>,
}

#[derive(Debug, Deserialize, Default)]
struct DeviceCodeResponse {
    device_code: Option<String>,
    user_code: Option<String>,
    verification_uri: Option<String>,
    expires_in: Option<i64>,
    interval: Option<u64>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserResponse {
    id: u64,
    login: String,
    name: Option<String>,
    avatar_url: String,
}

struct PendingFlow {
    device_code: String,
    interval: u64,
    expires_at: i64,
    cancel: CancellationToken,
}

enum Refresh {
    Refreshed(Session),
    Offline,
    Rejected,
}

enum UserFetch {
    Ok(GithubUser),
    Unauthorized,
    Offline,
}

enum ApiSession {
    Ready(Session),
    Offline,
    SignedOut,
}

pub struct GithubAuth {
    http: reqwest::Client,
    paths: AppPaths,
    vault: Arc<Vault>,
    session: Mutex<Option<Option<Session>>>,
    pending: Mutex<Option<PendingFlow>>,
    status: Mutex<Option<AuthStatus>>,
    refresh_lock: Mutex<()>,
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn expires_at(seconds: Option<i64>) -> Option<i64> {
    seconds.map(|seconds| now_ms() + seconds * 1000)
}

fn session_from(response: &TokenResponse, previous: Option<&Session>) -> Option<Session> {
    let access_token = response
        .access_token
        .clone()
        .filter(|token| !token.is_empty())?;
    Some(Session {
        access_token,
        refresh_token: response
            .refresh_token
            .clone()
            .filter(|token| !token.is_empty())
            .or_else(|| previous.and_then(|session| session.refresh_token.clone())),
        access_token_expires_at: expires_at(response.expires_in),
        refresh_token_expires_at: expires_at(response.refresh_token_expires_in)
            .or_else(|| previous.and_then(|session| session.refresh_token_expires_at)),
    })
}

fn stale(session: &Session) -> bool {
    session
        .access_token_expires_at
        .is_some_and(|expires| now_ms() >= expires - EXPIRY_SKEW_MS)
}

fn refreshable(session: &Session) -> bool {
    session.refresh_token.is_some()
        && session
            .refresh_token_expires_at
            .is_none_or(|expires| now_ms() < expires)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DevicePrompt {
    user_code: String,
    verification_uri: String,
    expires_in: i64,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum FlowStart {
    Started { ok: bool, prompt: DevicePrompt },
    Failed { ok: bool, error: &'static str },
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum SignIn {
    Done { ok: bool, user: Option<GithubUser> },
    Failed { ok: bool, error: &'static str },
}

fn start_failed(error: &'static str) -> FlowStart {
    FlowStart::Failed { ok: false, error }
}

fn sign_in_failed(error: &'static str) -> SignIn {
    SignIn::Failed { ok: false, error }
}

impl GithubAuth {
    pub fn new(http: reqwest::Client, paths: AppPaths, vault: Arc<Vault>) -> Self {
        Self {
            http,
            paths,
            vault,
            session: Mutex::new(None),
            pending: Mutex::new(None),
            status: Mutex::new(None),
            refresh_lock: Mutex::new(()),
        }
    }

    async fn post_form<T: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        body: &[(&str, &str)],
    ) -> Option<T> {
        let encoded = url::form_urlencoded::Serializer::new(String::new())
            .extend_pairs(body.iter())
            .finish();
        let response = self
            .http
            .post(url)
            .header("Accept", "application/json")
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(encoded)
            .send()
            .await
            .ok()?;
        response.json::<T>().await.ok()
    }

    async fn load_session(&self) -> Option<Session> {
        let mut cached = self.session.lock().await;
        if let Some(session) = cached.as_ref() {
            return session.clone();
        }
        let mut loaded = None;
        if let Ok(sealed) = tokio::fs::read_to_string(self.paths.session_file()).await
            && let Some(plain) = self.vault.open(&sealed).await
        {
            loaded = serde_json::from_slice::<Session>(&plain).ok();
        }
        *cached = Some(loaded.clone());
        loaded
    }

    async fn save_session(&self, session: &Session) {
        *self.session.lock().await = Some(Some(session.clone()));
        let Ok(plain) = serde_json::to_vec(session) else {
            return;
        };
        if let Some(sealed) = self.vault.seal(&plain).await {
            let _ = write_atomic(&self.paths.session_file(), sealed.as_bytes()).await;
        }
    }

    async fn clear_session(&self) {
        *self.session.lock().await = Some(None);
        *self.status.lock().await = None;
        let _ = tokio::fs::remove_file(self.paths.session_file()).await;
    }

    async fn refresh(&self, session: &Session) -> Refresh {
        let _guard = self.refresh_lock.lock().await;
        if let Some(current) = self.load_session().await
            && current.access_token != session.access_token
            && !stale(&current)
        {
            return Refresh::Refreshed(current);
        }
        if !refreshable(session) {
            return Refresh::Rejected;
        }
        let Some(refresh_token) = session.refresh_token.as_deref() else {
            return Refresh::Rejected;
        };
        let Some(response) = self
            .post_form::<TokenResponse>(
                ACCESS_TOKEN_URL,
                &[
                    ("client_id", client_id()),
                    ("grant_type", "refresh_token"),
                    ("refresh_token", refresh_token),
                ],
            )
            .await
        else {
            return Refresh::Offline;
        };
        match session_from(&response, Some(session)) {
            Some(next) => {
                self.save_session(&next).await;
                Refresh::Refreshed(next)
            }
            None => match response.error.as_deref() {
                Some(error) if DEAD_REFRESH_ERRORS.contains(&error) => Refresh::Rejected,
                _ => Refresh::Offline,
            },
        }
    }

    async fn fetch_user(&self, token: &str) -> UserFetch {
        let Ok(response) = self
            .http
            .get(USER_URL)
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", API_VERSION)
            .bearer_auth(token)
            .send()
            .await
        else {
            return UserFetch::Offline;
        };
        if response.status().as_u16() == 401 {
            return UserFetch::Unauthorized;
        }
        if !response.status().is_success() {
            return UserFetch::Offline;
        }
        match response.json::<UserResponse>().await {
            Ok(user) => UserFetch::Ok(GithubUser {
                id: user.id,
                login: user.login,
                name: user.name,
                avatar_url: user.avatar_url,
            }),
            Err(_) => UserFetch::Offline,
        }
    }

    pub async fn start_device_flow(&self) -> FlowStart {
        if client_id().is_empty() {
            return start_failed("not_configured");
        }
        self.cancel_device_flow().await;
        let Some(start) = self
            .post_form::<DeviceCodeResponse>(DEVICE_CODE_URL, &[("client_id", client_id())])
            .await
        else {
            return start_failed("network");
        };
        let (Some(device_code), Some(user_code), Some(verification_uri), Some(expires_in)) = (
            start.device_code,
            start.user_code,
            start.verification_uri,
            start.expires_in,
        ) else {
            return start_failed(if start.error.as_deref() == Some("device_flow_disabled") {
                "device_flow_disabled"
            } else {
                "unknown"
            });
        };
        *self.pending.lock().await = Some(PendingFlow {
            device_code,
            interval: start.interval.unwrap_or(5),
            expires_at: now_ms() + expires_in * 1000,
            cancel: CancellationToken::new(),
        });
        FlowStart::Started {
            ok: true,
            prompt: DevicePrompt {
                user_code,
                verification_uri,
                expires_in,
            },
        }
    }

    pub async fn wait_for_authorization(&self) -> SignIn {
        let (device_code, mut interval, expires, cancel) = {
            let pending = self.pending.lock().await;
            let Some(flow) = pending.as_ref() else {
                return sign_in_failed("cancelled");
            };
            (
                flow.device_code.clone(),
                flow.interval,
                flow.expires_at,
                flow.cancel.clone(),
            )
        };
        let result = loop {
            if now_ms() >= expires {
                break sign_in_failed("expired");
            }
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(interval)) => {}
                _ = cancel.cancelled() => break sign_in_failed("cancelled"),
            }
            let Some(response) = self
                .post_form::<TokenResponse>(
                    ACCESS_TOKEN_URL,
                    &[
                        ("client_id", client_id()),
                        ("device_code", &device_code),
                        ("grant_type", DEVICE_GRANT),
                    ],
                )
                .await
            else {
                continue;
            };
            if let Some(session) = session_from(&response, None) {
                self.save_session(&session).await;
                let user = match self.fetch_user(&session.access_token).await {
                    UserFetch::Ok(user) => Some(user),
                    _ => None,
                };
                *self.status.lock().await = Some(AuthStatus {
                    signed_in: true,
                    user: user.clone(),
                });
                break SignIn::Done { ok: true, user };
            }
            match response.error.as_deref() {
                Some("authorization_pending") => continue,
                Some("slow_down") => {
                    interval = response.interval.unwrap_or(interval + 5);
                    continue;
                }
                Some("expired_token") => break sign_in_failed("expired"),
                Some("access_denied") => break sign_in_failed("access_denied"),
                Some("device_flow_disabled") => break sign_in_failed("device_flow_disabled"),
                _ => break sign_in_failed("unknown"),
            }
        };
        let mut pending = self.pending.lock().await;
        if pending
            .as_ref()
            .is_some_and(|flow| flow.device_code == device_code)
        {
            *pending = None;
        }
        result
    }

    pub async fn cancel_device_flow(&self) {
        if let Some(flow) = self.pending.lock().await.take() {
            flow.cancel.cancel();
        }
    }

    async fn session_for_api(&self) -> ApiSession {
        let Some(stored) = self.load_session().await else {
            return ApiSession::SignedOut;
        };
        if !stale(&stored) {
            return ApiSession::Ready(stored);
        }
        match self.refresh(&stored).await {
            Refresh::Refreshed(session) => ApiSession::Ready(session),
            Refresh::Offline => ApiSession::Offline,
            Refresh::Rejected => {
                self.clear_session().await;
                ApiSession::SignedOut
            }
        }
    }

    async fn cached_user(&self) -> Option<GithubUser> {
        self.status
            .lock()
            .await
            .as_ref()
            .and_then(|status| status.user.clone())
    }

    pub async fn status(&self) -> AuthStatus {
        if let Some(cached) = self.status.lock().await.clone()
            && cached.signed_in
            && cached.user.is_some()
            && let Some(stored) = self.load_session().await
            && !stale(&stored)
        {
            return cached;
        }
        let session = match self.session_for_api().await {
            ApiSession::SignedOut => {
                *self.status.lock().await = None;
                return AuthStatus::default();
            }
            ApiSession::Offline => {
                return AuthStatus {
                    signed_in: true,
                    user: self.cached_user().await,
                };
            }
            ApiSession::Ready(session) => session,
        };
        let mut result = self.fetch_user(&session.access_token).await;
        if matches!(result, UserFetch::Unauthorized) && refreshable(&session) {
            match self.refresh(&session).await {
                Refresh::Refreshed(next) => result = self.fetch_user(&next.access_token).await,
                Refresh::Offline => {
                    return AuthStatus {
                        signed_in: true,
                        user: self.cached_user().await,
                    };
                }
                Refresh::Rejected => {}
            }
        }
        let user = match result {
            UserFetch::Unauthorized => {
                self.clear_session().await;
                return AuthStatus::default();
            }
            UserFetch::Ok(user) => Some(user),
            UserFetch::Offline => None,
        };
        let status = AuthStatus {
            signed_in: true,
            user,
        };
        *self.status.lock().await = Some(status.clone());
        status
    }

    pub async fn access_token(&self) -> TokenState {
        match self.session_for_api().await {
            ApiSession::Ready(session) => TokenState::Ready(session.access_token),
            ApiSession::Offline => TokenState::Offline,
            ApiSession::SignedOut => TokenState::SignedOut,
        }
    }

    pub async fn recover_from_unauthorized(&self, rejected: &str) -> TokenState {
        let Some(session) = self.load_session().await else {
            return TokenState::SignedOut;
        };
        if session.access_token != rejected {
            return TokenState::Ready(session.access_token);
        }
        if !refreshable(&session) {
            self.clear_session().await;
            return TokenState::SignedOut;
        }
        match self.refresh(&session).await {
            Refresh::Refreshed(next) => TokenState::Ready(next.access_token),
            Refresh::Offline => TokenState::Offline,
            Refresh::Rejected => {
                self.clear_session().await;
                TokenState::SignedOut
            }
        }
    }

    pub async fn sign_out(&self) {
        self.cancel_device_flow().await;
        self.clear_session().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessions_keep_previous_refresh_token() {
        let previous = Session {
            access_token: "old".into(),
            refresh_token: Some("refresh".into()),
            access_token_expires_at: None,
            refresh_token_expires_at: Some(42),
        };
        let response = TokenResponse {
            access_token: Some("new".into()),
            expires_in: Some(3600),
            ..TokenResponse::default()
        };
        let next = session_from(&response, Some(&previous)).unwrap();
        assert_eq!(next.access_token, "new");
        assert_eq!(next.refresh_token.as_deref(), Some("refresh"));
        assert_eq!(next.refresh_token_expires_at, Some(42));
        assert!(!stale(&next));
        assert!(session_from(&TokenResponse::default(), None).is_none());
    }

    #[test]
    fn shapes_match_the_bridge() {
        let start = serde_json::to_value(start_failed("network")).unwrap();
        assert_eq!(
            start,
            serde_json::json!({ "ok": false, "error": "network" })
        );
        let done = serde_json::to_value(SignIn::Done {
            ok: true,
            user: None,
        })
        .unwrap();
        assert_eq!(done, serde_json::json!({ "ok": true, "user": null }));
    }
}
