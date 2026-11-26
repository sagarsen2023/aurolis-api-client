use serde_json::Value;

#[derive(Debug, Clone, PartialEq)]
pub enum Packet {
    Open {
        sid: Option<String>,
    },
    Close,
    Ping,
    Pong,
    Noop,
    Connect {
        namespace: String,
        sid: Option<String>,
    },
    ConnectError {
        namespace: String,
        message: String,
    },
    Disconnect {
        namespace: String,
    },
    Event {
        namespace: String,
        name: String,
        args: Vec<Value>,
    },
    BinaryEvent {
        namespace: String,
        attachments: usize,
    },
    Other,
}

pub fn engine_url(user_url: &url::Url, path: &str) -> (url::Url, String) {
    let namespace = match user_url.path().trim_end_matches('/') {
        "" => "/".to_string(),
        path => path.to_string(),
    };
    let mut url = user_url.clone();
    let scheme = match user_url.scheme() {
        "https" | "wss" => "wss",
        _ => "ws",
    };
    let _ = url.set_scheme(scheme);
    let path = if path.ends_with('/') {
        path.to_string()
    } else {
        format!("{path}/")
    };
    url.set_path(&path);
    url.set_fragment(None);
    let pairs: Vec<(String, String)> = user_url
        .query_pairs()
        .filter(|(key, _)| key != "EIO" && key != "transport")
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect();
    {
        let mut query = url.query_pairs_mut();
        query.clear();
        for (key, value) in &pairs {
            query.append_pair(key, value);
        }
        query.append_pair("EIO", "4");
        query.append_pair("transport", "websocket");
    }
    (url, namespace)
}

fn prefix(namespace: &str) -> String {
    if namespace == "/" {
        String::new()
    } else {
        format!("{namespace},")
    }
}

pub fn connect_packet(namespace: &str) -> String {
    format!("40{}", prefix(namespace))
}

pub fn disconnect_packet(namespace: &str) -> String {
    format!("41{}", prefix(namespace))
}

pub fn event_packet(namespace: &str, event: &str, payload: Value) -> String {
    let body = Value::Array(vec![Value::String(event.to_string()), payload]);
    format!("42{}{}", prefix(namespace), body)
}

fn split_namespace(rest: &str) -> (String, &str) {
    if let Some(stripped) = rest.strip_prefix('/') {
        match stripped.find(',') {
            Some(index) => (format!("/{}", &stripped[..index]), &stripped[index + 1..]),
            None => (format!("/{stripped}"), ""),
        }
    } else {
        ("/".to_string(), rest)
    }
}

fn skip_ack_id(rest: &str) -> &str {
    rest.trim_start_matches(|ch: char| ch.is_ascii_digit())
}

fn sid_of(data: &str) -> Option<String> {
    serde_json::from_str::<Value>(data)
        .ok()?
        .get("sid")?
        .as_str()
        .map(String::from)
}

pub fn parse(text: &str) -> Packet {
    let mut chars = text.chars();
    match chars.next() {
        Some('0') => Packet::Open {
            sid: sid_of(chars.as_str()),
        },
        Some('1') => Packet::Close,
        Some('2') => Packet::Ping,
        Some('3') => Packet::Pong,
        Some('6') => Packet::Noop,
        Some('4') => parse_message(chars.as_str()),
        _ => Packet::Other,
    }
}

fn parse_message(text: &str) -> Packet {
    let mut chars = text.chars();
    let kind = chars.next();
    let rest = chars.as_str();
    match kind {
        Some('0') => {
            let (namespace, data) = split_namespace(rest);
            Packet::Connect {
                namespace,
                sid: sid_of(data),
            }
        }
        Some('1') => Packet::Disconnect {
            namespace: split_namespace(rest).0,
        },
        Some('2') => {
            let (namespace, data) = split_namespace(rest);
            let data = skip_ack_id(data);
            let Ok(Value::Array(mut items)) = serde_json::from_str::<Value>(data) else {
                return Packet::Other;
            };
            if items.is_empty() {
                return Packet::Other;
            }
            let name = match items.remove(0) {
                Value::String(name) => name,
                other => other.to_string(),
            };
            Packet::Event {
                namespace,
                name,
                args: items,
            }
        }
        Some('4') => {
            let (namespace, data) = split_namespace(rest);
            let message = serde_json::from_str::<Value>(data)
                .ok()
                .and_then(|value| match value {
                    Value::String(text) => Some(text),
                    other => other
                        .get("message")
                        .and_then(Value::as_str)
                        .map(String::from),
                })
                .unwrap_or_else(|| "The server refused the connection.".to_string());
            Packet::ConnectError { namespace, message }
        }
        Some('5') => {
            let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
            let after = rest[digits.len()..].strip_prefix('-').unwrap_or("");
            let (namespace, _) = split_namespace(after);
            Packet::BinaryEvent {
                namespace,
                attachments: digits.parse().unwrap_or(0),
            }
        }
        _ => Packet::Other,
    }
}

pub fn stringify_args(args: &[Value]) -> String {
    let value = if args.len() == 1 {
        args[0].clone()
    } else {
        Value::Array(args.to_vec())
    };
    match value {
        Value::String(text) => text,
        other => serde_json::to_string_pretty(&other).unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn builds_engine_urls() {
        let user = url::Url::parse("https://api.example.com/admin?token=abc").unwrap();
        let (url, namespace) = engine_url(&user, "/socket.io");
        assert_eq!(
            url.as_str(),
            "wss://api.example.com/socket.io/?token=abc&EIO=4&transport=websocket"
        );
        assert_eq!(namespace, "/admin");
        let user = url::Url::parse("ws://localhost:3000").unwrap();
        let (url, namespace) = engine_url(&user, "/socket.io/");
        assert_eq!(
            url.as_str(),
            "ws://localhost:3000/socket.io/?EIO=4&transport=websocket"
        );
        assert_eq!(namespace, "/");
    }

    #[test]
    fn writes_packets() {
        assert_eq!(connect_packet("/"), "40");
        assert_eq!(connect_packet("/admin"), "40/admin,");
        assert_eq!(
            event_packet("/", "hello", json!({"a": 1})),
            r#"42["hello",{"a":1}]"#
        );
        assert_eq!(
            event_packet("/admin", "x", json!("y")),
            r#"42/admin,["x","y"]"#
        );
        assert_eq!(disconnect_packet("/admin"), "41/admin,");
    }

    #[test]
    fn reads_packets() {
        assert_eq!(
            parse(r#"0{"sid":"abc","pingInterval":25000}"#),
            Packet::Open {
                sid: Some("abc".into())
            }
        );
        assert_eq!(parse("2"), Packet::Ping);
        assert_eq!(
            parse(r#"40{"sid":"s1"}"#),
            Packet::Connect {
                namespace: "/".into(),
                sid: Some("s1".into())
            }
        );
        assert_eq!(
            parse(r#"40/admin,{"sid":"s2"}"#),
            Packet::Connect {
                namespace: "/admin".into(),
                sid: Some("s2".into())
            }
        );
        assert_eq!(
            parse(r#"42/admin,12["news",{"id":1},"x"]"#),
            Packet::Event {
                namespace: "/admin".into(),
                name: "news".into(),
                args: vec![json!({"id":1}), json!("x")]
            }
        );
        assert_eq!(
            parse(r#"44{"message":"not authorized"}"#),
            Packet::ConnectError {
                namespace: "/".into(),
                message: "not authorized".into()
            }
        );
        assert_eq!(
            parse("41"),
            Packet::Disconnect {
                namespace: "/".into()
            }
        );
        assert_eq!(
            parse(r#"451-["file",{"_placeholder":true,"num":0}]"#),
            Packet::BinaryEvent {
                namespace: "/".into(),
                attachments: 1
            }
        );
    }

    #[test]
    fn stringifies_like_the_old_engine() {
        assert_eq!(stringify_args(&[json!("hi")]), "hi");
        assert_eq!(stringify_args(&[json!({"a": 1})]), "{\n  \"a\": 1\n}");
        assert_eq!(stringify_args(&[json!(1), json!(2)]), "[\n  1,\n  2\n]");
    }
}
