use std::sync::{Arc, LazyLock};

use regex::Regex;
use reqwest::header::HeaderMap;
use reqwest::{Method, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::github::API_VERSION;
use crate::github::auth::{GithubAuth, TokenState};
use crate::outcome::{AppResult, Failure};

const API_ORIGIN: &str = "https://api.github.com";
const MAX_PAGES: usize = 20;

pub struct GithubApi {
    http: reqwest::Client,
    auth: Arc<GithubAuth>,
}

fn api_url(endpoint: &str) -> AppResult<url::Url> {
    let base = url::Url::parse(API_ORIGIN).expect("valid origin");
    let url = base
        .join(endpoint)
        .map_err(|error| Failure::new("invalid_input", error.to_string()))?;
    if url.origin() != base.origin() {
        return Err(Failure::new(
            "invalid_input",
            format!("Refusing to call {}", url.origin().ascii_serialization()),
        ));
    }
    Ok(url)
}

fn message_of(body: &Value) -> Option<String> {
    match body {
        Value::Object(map) => map.get("message").and_then(Value::as_str).map(String::from),
        Value::String(text) => Some(text.chars().take(300).collect()),
        _ => None,
    }
}

pub fn to_failure(status: StatusCode, headers: &HeaderMap, body: &Value) -> Failure {
    let status = status.as_u16();
    let message = message_of(body);
    let lower = message.clone().unwrap_or_default().to_lowercase();
    let header = |name: &str| {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(String::from)
    };
    let remaining = header("x-ratelimit-remaining");
    let reset: Option<i64> = header("x-ratelimit-reset").and_then(|value| value.parse().ok());
    let retry_after: Option<i64> = header("retry-after").and_then(|value| value.parse().ok());
    if (status == 403 || status == 429)
        && (remaining.as_deref() == Some("0") || retry_after.is_some_and(|value| value > 0))
    {
        let reset_at = match retry_after {
            Some(seconds) if seconds > 0 => {
                Some(chrono::Utc::now().timestamp_millis() + seconds * 1000)
            }
            _ => reset.map(|seconds| seconds * 1000),
        };
        let mut failure =
            Failure::new("rate_limited", message.unwrap_or_default()).with_status(status);
        failure.reset_at = reset_at;
        return failure;
    }
    let code = match status {
        401 => "signed_out",
        403 => "forbidden",
        404 => "not_found",
        409 if lower.contains("empty") => "empty_repository",
        409 => "conflict",
        422 if lower.contains("fast forward") => "conflict",
        422 => "validation",
        413 => "too_large",
        500.. => "server",
        _ => "unknown",
    };
    let mut failure = Failure::code(code).with_status(status);
    failure.message = message;
    failure
}

async fn read_body(response: reqwest::Response) -> (StatusCode, HeaderMap, Value) {
    let status = response.status();
    let headers = response.headers().clone();
    let text = response.text().await.unwrap_or_default();
    let body = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text))
    };
    (status, headers, body)
}

fn next_page(headers: &HeaderMap) -> Option<String> {
    static NEXT: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r#"<([^>]+)>;\s*rel="next""#).unwrap());
    let link = headers.get("link")?.to_str().ok()?;
    NEXT.captures(link).map(|captures| captures[1].to_string())
}

impl GithubApi {
    pub fn new(http: reqwest::Client, auth: Arc<GithubAuth>) -> Self {
        Self { http, auth }
    }

    async fn fetch(
        &self,
        method: &Method,
        url: &url::Url,
        body: Option<&Value>,
        token: Option<&str>,
    ) -> AppResult<reqwest::Response> {
        let mut request = self
            .http
            .request(method.clone(), url.clone())
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", API_VERSION);
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.json(body);
        }
        request.send().await.map_err(|_| Failure::code("offline"))
    }

    async fn send(
        &self,
        method: Method,
        endpoint: &str,
        body: Option<Value>,
        anonymous: bool,
    ) -> AppResult<(Value, HeaderMap)> {
        let url = api_url(endpoint)?;
        if anonymous {
            let response = self.fetch(&method, &url, body.as_ref(), None).await?;
            return Self::finish(response).await;
        }
        let mut auth = self.auth.access_token().await;
        for attempt in 0.. {
            let token = match auth {
                TokenState::Ready(token) => token,
                TokenState::Offline => return Err(Failure::code("offline")),
                TokenState::SignedOut => return Err(Failure::code("signed_out")),
            };
            let response = self
                .fetch(&method, &url, body.as_ref(), Some(&token))
                .await?;
            if response.status() == StatusCode::UNAUTHORIZED && attempt == 0 {
                auth = self.auth.recover_from_unauthorized(&token).await;
                continue;
            }
            return Self::finish(response).await;
        }
        unreachable!()
    }

    async fn finish(response: reqwest::Response) -> AppResult<(Value, HeaderMap)> {
        let (status, headers, body) = read_body(response).await;
        if !status.is_success() {
            return Err(to_failure(status, &headers, &body));
        }
        Ok((body, headers))
    }

    pub async fn get<T: DeserializeOwned>(&self, endpoint: &str) -> AppResult<T> {
        let (body, _) = self.send(Method::GET, endpoint, None, false).await?;
        serde_json::from_value(body).map_err(|error| Failure::new("unknown", error.to_string()))
    }

    pub async fn post<T: DeserializeOwned>(&self, endpoint: &str, body: Value) -> AppResult<T> {
        let (body, _) = self.send(Method::POST, endpoint, Some(body), false).await?;
        serde_json::from_value(body).map_err(|error| Failure::new("unknown", error.to_string()))
    }

    pub async fn get_all<T: DeserializeOwned>(
        &self,
        endpoint: &str,
        key: &str,
    ) -> AppResult<Vec<T>> {
        let mut items = Vec::new();
        let mut next = Some(endpoint.to_string());
        let mut pages = 0;
        while let Some(current) = next.take() {
            if pages >= MAX_PAGES {
                break;
            }
            pages += 1;
            let (body, headers) = self.send(Method::GET, &current, None, false).await?;
            let page = body.get(key).cloned().unwrap_or(Value::Array(Vec::new()));
            let parsed: Vec<T> = serde_json::from_value(page)
                .map_err(|error| Failure::new("unknown", error.to_string()))?;
            items.extend(parsed);
            next = next_page(&headers);
        }
        Ok(items)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use reqwest::header::HeaderValue;

    #[test]
    fn refuses_other_hosts() {
        assert!(api_url("/user").is_ok());
        assert_eq!(
            api_url("https://evil.example/x").unwrap_err().code,
            "invalid_input"
        );
    }

    #[test]
    fn maps_errors() {
        let empty = HeaderMap::new();
        let body = serde_json::json!({ "message": "Git Repository is empty." });
        assert_eq!(
            to_failure(StatusCode::CONFLICT, &empty, &body).code,
            "empty_repository"
        );
        assert_eq!(
            to_failure(StatusCode::NOT_FOUND, &empty, &Value::Null).code,
            "not_found"
        );
        assert_eq!(
            to_failure(
                StatusCode::UNPROCESSABLE_ENTITY,
                &empty,
                &serde_json::json!({"message": "Update is not a fast forward"})
            )
            .code,
            "conflict"
        );
        let mut limited = HeaderMap::new();
        limited.insert("x-ratelimit-remaining", HeaderValue::from_static("0"));
        limited.insert("x-ratelimit-reset", HeaderValue::from_static("1700000000"));
        let failure = to_failure(StatusCode::FORBIDDEN, &limited, &Value::Null);
        assert_eq!(failure.code, "rate_limited");
        assert_eq!(failure.reset_at, Some(1_700_000_000_000));
        assert_eq!(
            to_failure(StatusCode::FORBIDDEN, &empty, &Value::Null).code,
            "forbidden"
        );
    }

    #[test]
    fn finds_next_page() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "link",
            HeaderValue::from_static(r#"<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=5>; rel="last""#),
        );
        assert_eq!(
            next_page(&headers).as_deref(),
            Some("https://api.github.com/x?page=2")
        );
    }
}
