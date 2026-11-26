pub mod http;
pub mod realtime;
pub mod socketio;

use std::sync::LazyLock;

use regex::Regex;

use crate::outcome::Failure;

pub const MAX_URL_LENGTH: usize = 16_384;
pub const MAX_HEADERS: usize = 200;
pub const MAX_TEXT_BODY: usize = 50 * 1024 * 1024;
pub const MAX_FIELDS: usize = 1_000;
pub const MIN_TIMEOUT_MS: u64 = 1_000;
pub const MAX_TIMEOUT_MS: u64 = 10 * 60 * 1_000;

pub type HeaderPair = (String, String);

pub fn engine_error(code: &str, message: impl Into<String>) -> Failure {
    Failure::new(code, message)
}

pub fn invalid(message: impl Into<String>) -> Failure {
    engine_error("invalid_input", message)
}

pub fn check_run_id(id: &str) -> Result<(), Failure> {
    static RUN_ID: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_-]{1,100}$").unwrap());
    if RUN_ID.is_match(id) {
        Ok(())
    } else {
        Err(invalid("Invalid id."))
    }
}

pub fn check_headers(headers: &[HeaderPair]) -> Result<(), Failure> {
    static NAME: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,1024}$").unwrap());
    if headers.len() > MAX_HEADERS {
        return Err(invalid(format!("Use {MAX_HEADERS} headers or fewer.")));
    }
    for (name, value) in headers {
        if !NAME.is_match(name) {
            return Err(invalid("Invalid header name"));
        }
        if value.len() > 65_536 || value.contains(['\r', '\n', '\0']) {
            return Err(invalid("Invalid header value"));
        }
    }
    Ok(())
}

pub fn check_fields(fields: &[HeaderPair]) -> Result<(), Failure> {
    if fields.len() > MAX_FIELDS
        || fields
            .iter()
            .any(|(name, value)| name.len() > 10_000 || value.len() > MAX_TEXT_BODY)
    {
        return Err(invalid("Too many or too large form fields."));
    }
    Ok(())
}

pub fn check_timeout(timeout_ms: u64) -> Result<(), Failure> {
    if (MIN_TIMEOUT_MS..=MAX_TIMEOUT_MS).contains(&timeout_ms) {
        Ok(())
    } else {
        Err(invalid("Choose a timeout between 1 second and 10 minutes."))
    }
}

fn list_protocols(protocols: &[&str]) -> String {
    let items: Vec<String> = protocols
        .iter()
        .map(|protocol| format!("{protocol}//"))
        .collect();
    match items.len() {
        0 => String::new(),
        1 => items[0].clone(),
        2 => format!("{} or {}", items[0], items[1]),
        n => format!("{}, or {}", items[..n - 1].join(", "), items[n - 1]),
    }
}

pub fn check_url(value: &str, protocols: &[&str]) -> Result<url::Url, Failure> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(invalid("Enter a URL"));
    }
    if trimmed.len() > MAX_URL_LENGTH {
        return Err(invalid("The URL is too long."));
    }
    let message = format!(
        "Enter a URL that starts with {}.",
        list_protocols(protocols)
    );
    let parsed = url::Url::parse(trimmed).map_err(|_| invalid(message.clone()))?;
    let scheme = format!("{}:", parsed.scheme());
    if !protocols.contains(&scheme.as_str()) {
        return Err(invalid(message));
    }
    Ok(parsed)
}

pub fn clip(text: &str, limit: usize) -> String {
    if text.len() <= limit {
        return text.to_string();
    }
    let mut end = limit;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n… (truncated)", &text[..end])
}

pub fn header_map(headers: &[HeaderPair]) -> Vec<(String, String)> {
    let mut merged: Vec<(String, String)> = Vec::new();
    for (name, value) in headers {
        let key = name.to_lowercase();
        match merged.iter_mut().find(|(existing, _)| *existing == key) {
            Some((_, current)) => {
                current.push_str(", ");
                current.push_str(value);
            }
            None => merged.push((key, value.clone())),
        }
    }
    merged
}

pub fn classify_transport_error(error: &(dyn std::error::Error + 'static)) -> Failure {
    let mut deepest = error.to_string();
    let mut chain = Vec::new();
    let mut current: Option<&(dyn std::error::Error + 'static)> = Some(error);
    while let Some(item) = current {
        chain.push(item.to_string().to_lowercase());
        if let Some(io) = item.downcast_ref::<std::io::Error>()
            && io.kind() == std::io::ErrorKind::ConnectionRefused
        {
            return engine_error("refused", item.to_string());
        }
        deepest = item.to_string();
        current = item.source();
    }
    let text = chain.join(" | ");
    let code = if text.contains("dns error")
        || text.contains("failed to lookup address")
        || text.contains("name or service not known")
        || text.contains("nodename nor servname")
        || text.contains("no such host")
    {
        "dns"
    } else if text.contains("connection refused") {
        "refused"
    } else if text.contains("certificate") || text.contains("tls") || text.contains("ssl") {
        "tls"
    } else {
        "network"
    };
    engine_error(code, deepest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_urls() {
        assert!(check_url(" https://api.example.com/v1 ", &["http:", "https:"]).is_ok());
        let error = check_url("ftp://x", &["http:", "https:"]).unwrap_err();
        assert_eq!(
            error.message.as_deref(),
            Some("Enter a URL that starts with http:// or https://.")
        );
        let error = check_url("nope", &["ws:", "wss:", "http:", "https:"]).unwrap_err();
        assert_eq!(
            error.message.as_deref(),
            Some("Enter a URL that starts with ws://, wss://, http://, or https://.")
        );
    }

    #[test]
    fn validates_headers() {
        assert!(check_headers(&[("Content-Type".into(), "application/json".into())]).is_ok());
        assert!(check_headers(&[("Bad Name".into(), "x".into())]).is_err());
        assert!(check_headers(&[("X".into(), "a\r\nb".into())]).is_err());
        assert!(check_run_id("run_1-a").is_ok());
        assert!(check_run_id("bad id").is_err());
        assert!(check_timeout(30_000).is_ok());
        assert!(check_timeout(10).is_err());
    }

    #[test]
    fn merges_headers() {
        let merged = header_map(&[
            ("Accept".into(), "a".into()),
            ("accept".into(), "b".into()),
            ("X-Id".into(), "1".into()),
        ]);
        assert_eq!(
            merged,
            vec![
                ("accept".into(), "a, b".into()),
                ("x-id".into(), "1".into())
            ]
        );
        assert_eq!(clip("héllo", 2), "h\n… (truncated)");
    }
}
