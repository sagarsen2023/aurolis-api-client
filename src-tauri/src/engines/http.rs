use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use futures_util::StreamExt;
use regex::Regex;
use reqwest::header::{CONTENT_TYPE, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

use crate::engines::{
    HeaderPair, MAX_TEXT_BODY, check_fields, check_headers, check_run_id, check_timeout, check_url,
    classify_transport_error, engine_error, invalid,
};
use crate::outcome::{AppResult, Failure};

const MAX_RESPONSE_BYTES: usize = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;
const METHODS: [&str; 7] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

static TEXT_TYPE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(text/|application/([\w.+-]*\+)?(json|xml|javascript|ecmascript|graphql|x-www-form-urlencoded|x-ndjson|yaml|x-yaml|problem\+json)\b)").unwrap()
});

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum PreparedBody {
    None,
    Text { text: String },
    Urlencoded { fields: Vec<HeaderPair> },
    FormData { fields: Vec<HeaderPair> },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSendParams {
    pub run_id: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<HeaderPair>,
    pub body: PreparedBody,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timings {
    headers_ms: f64,
    total_ms: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpResponseData {
    status: u16,
    status_text: String,
    url: String,
    redirected: bool,
    headers: Vec<HeaderPair>,
    content_type: Option<String>,
    body: String,
    body_encoding: &'static str,
    size: usize,
    truncated: bool,
    timings: Timings,
}

pub struct HttpEngine {
    client: reqwest::Client,
    runs: Mutex<HashMap<String, CancellationToken>>,
}

fn format_seconds(ms: u64) -> String {
    let seconds = ms as f64 / 1000.0;
    let text = if seconds.fract() == 0.0 {
        format!("{}", seconds as u64)
    } else {
        format!("{seconds:.1}")
    };
    format!("{text} second{}", if seconds == 1.0 { "" } else { "s" })
}

pub fn validate(params: &HttpSendParams) -> AppResult<url::Url> {
    check_run_id(&params.run_id)?;
    if !METHODS.contains(&params.method.as_str()) {
        return Err(invalid("Invalid method"));
    }
    let url = check_url(&params.url, &["http:", "https:"])?;
    check_headers(&params.headers)?;
    check_timeout(params.timeout_ms)?;
    match &params.body {
        PreparedBody::Text { text } if text.len() > MAX_TEXT_BODY => {
            Err(invalid("The body is too large."))
        }
        PreparedBody::Urlencoded { fields } | PreparedBody::FormData { fields } => {
            check_fields(fields)?;
            Ok(url)
        }
        _ => Ok(url),
    }
}

fn has_header(headers: &[HeaderPair], name: &str) -> bool {
    headers
        .iter()
        .any(|(key, _)| key.eq_ignore_ascii_case(name))
}

fn response_headers(headers: &reqwest::header::HeaderMap) -> Vec<HeaderPair> {
    let mut pairs: Vec<HeaderPair> = Vec::new();
    let mut cookies: Vec<HeaderPair> = Vec::new();
    for (name, value) in headers {
        let name = name.as_str().to_string();
        let value = String::from_utf8_lossy(value.as_bytes()).into_owned();
        if name == "set-cookie" {
            cookies.push((name, value));
            continue;
        }
        match pairs.iter_mut().find(|(existing, _)| *existing == name) {
            Some((_, current)) => {
                current.push_str(", ");
                current.push_str(&value);
            }
            None => pairs.push((name, value)),
        }
    }
    pairs.sort_by(|a, b| a.0.cmp(&b.0));
    pairs.extend(cookies);
    pairs
}

pub fn decode_body(bytes: &[u8], content_type: Option<&str>) -> (String, &'static str) {
    let is_text = content_type.is_some_and(|value| TEXT_TYPE.is_match(value));
    if is_text {
        let text = String::from_utf8_lossy(bytes);
        let text = text.strip_prefix('\u{feff}').unwrap_or(&text).to_string();
        return (text, "text");
    }
    let is_image = content_type.is_some_and(|value| value.to_lowercase().starts_with("image/"));
    if is_image && bytes.len() <= MAX_IMAGE_BYTES {
        return (STANDARD.encode(bytes), "base64");
    }
    if content_type.is_none()
        && let Ok(text) = std::str::from_utf8(bytes)
    {
        return (
            text.strip_prefix('\u{feff}').unwrap_or(text).to_string(),
            "text",
        );
    }
    (String::new(), "omitted")
}

fn milliseconds(duration: Duration) -> f64 {
    (duration.as_secs_f64() * 1_000_000.0).round() / 1000.0
}

pub fn build_request(
    client: &reqwest::Client,
    params: &HttpSendParams,
    url: url::Url,
) -> AppResult<reqwest::RequestBuilder> {
    let method = reqwest::Method::from_bytes(params.method.as_bytes())
        .map_err(|_| invalid("Invalid method"))?;
    let sends_body = !matches!(params.method.as_str(), "GET" | "HEAD");
    let mut request = client.request(method, url);
    for (name, value) in &params.headers {
        let name =
            HeaderName::from_bytes(name.as_bytes()).map_err(|_| invalid("Invalid header name"))?;
        let value = HeaderValue::from_str(value).map_err(|_| invalid("Invalid header value"))?;
        request = request.header(name, value);
    }
    if !sends_body {
        return Ok(request);
    }
    Ok(match &params.body {
        PreparedBody::None => request,
        PreparedBody::Text { text } => request.body(text.clone()),
        PreparedBody::Urlencoded { fields } => {
            let encoded = url::form_urlencoded::Serializer::new(String::new())
                .extend_pairs(fields.iter())
                .finish();
            if !has_header(&params.headers, "content-type") {
                request = request.header(
                    CONTENT_TYPE,
                    "application/x-www-form-urlencoded;charset=UTF-8",
                );
            }
            request.body(encoded)
        }
        PreparedBody::FormData { fields } => {
            let form = fields
                .iter()
                .fold(reqwest::multipart::Form::new(), |form, (name, value)| {
                    form.text(name.clone(), value.clone())
                });
            request.multipart(form)
        }
    })
}

impl HttpEngine {
    pub fn new(user_agent: &str) -> Self {
        let client = reqwest::Client::builder()
            .user_agent(user_agent)
            .redirect(reqwest::redirect::Policy::limited(20))
            .build()
            .expect("http client");
        Self {
            client,
            runs: Mutex::new(HashMap::new()),
        }
    }

    pub fn client(&self) -> reqwest::Client {
        self.client.clone()
    }

    async fn exchange(
        &self,
        params: &HttpSendParams,
        url: url::Url,
    ) -> AppResult<HttpResponseData> {
        let request_url = url.clone();
        let request = build_request(&self.client, params, url)?;
        let started = Instant::now();
        let response = request
            .send()
            .await
            .map_err(|error| classify_transport_error(&error))?;
        let headers_ms = milliseconds(started.elapsed());
        let status = response.status();
        let final_url = response.url().clone();
        let headers = response.headers().clone();
        let content_type = headers
            .get(CONTENT_TYPE)
            .map(|value| String::from_utf8_lossy(value.as_bytes()).into_owned());
        let mut stream = response.bytes_stream();
        let mut bytes: Vec<u8> = Vec::new();
        let mut size = 0usize;
        let mut truncated = false;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| classify_transport_error(&error))?;
            size += chunk.len();
            if bytes.len() + chunk.len() > MAX_RESPONSE_BYTES {
                let room = MAX_RESPONSE_BYTES - bytes.len();
                bytes.extend_from_slice(&chunk[..room]);
                truncated = true;
                break;
            }
            bytes.extend_from_slice(&chunk);
        }
        let total_ms = milliseconds(started.elapsed());
        let (body, body_encoding) = decode_body(&bytes, content_type.as_deref());
        Ok(HttpResponseData {
            status: status.as_u16(),
            status_text: status.canonical_reason().unwrap_or_default().to_string(),
            url: final_url.to_string(),
            redirected: final_url != request_url,
            headers: response_headers(&headers),
            content_type,
            body,
            body_encoding,
            size,
            truncated,
            timings: Timings {
                headers_ms,
                total_ms,
            },
        })
    }

    pub async fn execute(
        &self,
        params: HttpSendParams,
        track: bool,
    ) -> AppResult<HttpResponseData> {
        let url = validate(&params)?;
        let token = CancellationToken::new();
        if track && let Ok(mut runs) = self.runs.lock() {
            runs.insert(params.run_id.clone(), token.clone());
        }
        let timeout = Duration::from_millis(params.timeout_ms);
        let result = tokio::select! {
            result = tokio::time::timeout(timeout, self.exchange(&params, url)) => match result {
                Ok(result) => result,
                Err(_) => Err(engine_error(
                    "timeout",
                    format!("No response within {}.", format_seconds(params.timeout_ms)),
                )),
            },
            _ = token.cancelled() => Err(engine_error("aborted", "The request was cancelled.")),
        };
        if track && let Ok(mut runs) = self.runs.lock() {
            runs.remove(&params.run_id);
        }
        result
    }

    pub fn cancel(&self, run_id: &str) -> Result<(), Failure> {
        check_run_id(run_id)?;
        if let Some(token) = self
            .runs
            .lock()
            .ok()
            .and_then(|runs| runs.get(run_id).cloned())
        {
            token.cancel();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_bodies() {
        assert_eq!(
            decode_body(b"{\"a\":1}", Some("application/json; charset=utf-8")),
            ("{\"a\":1}".to_string(), "text")
        );
        assert_eq!(
            decode_body(b"x", Some("application/problem+json")).1,
            "text"
        );
        assert_eq!(
            decode_body(b"x", Some("application/vnd.api+json")).1,
            "text"
        );
        assert_eq!(
            decode_body(&[0x89, 0x50], Some("image/png")),
            ("iVA=".to_string(), "base64")
        );
        assert_eq!(decode_body(&[0xff, 0xfe], None).1, "omitted");
        assert_eq!(decode_body(b"plain", None), ("plain".to_string(), "text"));
        assert_eq!(decode_body(b"%PDF", Some("application/pdf")).1, "omitted");
        assert_eq!(
            decode_body("\u{feff}hi".as_bytes(), Some("text/plain")).0,
            "hi"
        );
    }

    #[test]
    fn formats_timeouts() {
        assert_eq!(format_seconds(30_000), "30 seconds");
        assert_eq!(format_seconds(1_000), "1 second");
        assert_eq!(format_seconds(1_500), "1.5 seconds");
    }

    #[test]
    fn parses_bodies_from_the_bridge() {
        let body: PreparedBody = serde_json::from_value(
            serde_json::json!({"kind": "form-data", "fields": [["a", "1"]]}),
        )
        .unwrap();
        assert!(matches!(body, PreparedBody::FormData { .. }));
        let body: PreparedBody =
            serde_json::from_value(serde_json::json!({"kind": "none"})).unwrap();
        assert!(matches!(body, PreparedBody::None));
    }
}
