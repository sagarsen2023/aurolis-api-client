use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::stream::{SplitSink, SplitStream};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpStream;
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::{HeaderName, HeaderValue};
use tokio_tungstenite::tungstenite::protocol::CloseFrame;
use tokio_tungstenite::tungstenite::protocol::frame::coding::CloseCode;
use tokio_tungstenite::tungstenite::{Error as WsError, Message};
use tokio_tungstenite::{Connector, MaybeTlsStream, WebSocketStream};

use crate::engines::socketio::{self, Packet};
use crate::engines::{
    HeaderPair, MAX_TEXT_BODY, check_headers, check_run_id, check_timeout, check_url,
    classify_transport_error, clip, engine_error, header_map, invalid,
};
use crate::outcome::{AppResult, Failure};

pub const REALTIME_EVENT: &str = "aurolis:realtime-event";
const MAX_LOGGED_BYTES: usize = 1024 * 1024;

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;
type Sink = SplitSink<Socket, Message>;
type Stream = SplitStream<Socket>;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectParams {
    pub connection_id: String,
    pub protocol: String,
    pub url: String,
    pub headers: Vec<HeaderPair>,
    pub socketio_path: String,
    pub socketio_events: Vec<String>,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendParams {
    pub connection_id: String,
    pub event: String,
    pub body: String,
    pub format: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RealtimeEvent {
    connection_id: String,
    id: String,
    kind: &'static str,
    at: i64,
    event: Option<String>,
    data: String,
}

enum Command {
    Send(String),
    Close,
}

#[derive(Clone)]
struct Connection {
    generation: uuid::Uuid,
    protocol: String,
    namespace: String,
    sender: UnboundedSender<Command>,
    closing: Arc<AtomicBool>,
}

#[derive(Clone)]
struct EventSink {
    app: AppHandle,
    connection_id: String,
}

impl EventSink {
    fn emit(&self, kind: &'static str, data: String, event: Option<String>) {
        let _ = self.app.emit(
            REALTIME_EVENT,
            RealtimeEvent {
                connection_id: self.connection_id.clone(),
                id: uuid::Uuid::new_v4().to_string(),
                kind,
                at: chrono::Utc::now().timestamp_millis(),
                event,
                data,
            },
        );
    }
}

pub struct RealtimeEngine {
    connections: Arc<Mutex<HashMap<String, Connection>>>,
    tls: Arc<rustls::ClientConfig>,
}

fn validate(params: &ConnectParams) -> AppResult<url::Url> {
    check_run_id(&params.connection_id)?;
    if params.protocol != "websocket" && params.protocol != "socketio" {
        return Err(invalid("Unknown protocol."));
    }
    let url = check_url(&params.url, &["ws:", "wss:", "http:", "https:"])?;
    check_headers(&params.headers)?;
    check_timeout(params.timeout_ms)?;
    let path = &params.socketio_path;
    if path.len() > 1_000
        || !path.starts_with('/')
        || path.contains(|ch: char| ch.is_whitespace() || ch == '?' || ch == '#')
    {
        return Err(invalid("The path must start with /"));
    }
    if params.socketio_events.len() > 100
        || params
            .socketio_events
            .iter()
            .any(|event| event.is_empty() || event.len() > 200)
    {
        return Err(invalid("Too many or invalid event names."));
    }
    Ok(url)
}

fn parse_json(body: &str) -> AppResult<Value> {
    serde_json::from_str(body).map_err(|error| {
        invalid(
            format!("The message isn't valid JSON. {error}")
                .trim()
                .to_string(),
        )
    })
}

fn ws_failure(error: WsError) -> Failure {
    match error {
        WsError::Http(response) => engine_error(
            "refused",
            format!(
                "The server answered HTTP {} instead of upgrading to a WebSocket.",
                response.status().as_u16()
            ),
        ),
        WsError::Url(error) => engine_error("invalid_url", error.to_string()),
        WsError::Io(error) => classify_transport_error(&error),
        WsError::Tls(error) => engine_error("tls", error.to_string()),
        other => engine_error("network", other.to_string()),
    }
}

fn to_websocket(url: &url::Url) -> url::Url {
    let mut next = url.clone();
    let scheme = match url.scheme() {
        "http" => "ws",
        "https" => "wss",
        other => other,
    }
    .to_string();
    let _ = next.set_scheme(&scheme);
    next
}

fn close_detail(frame: Option<&CloseFrame>, fallback: u16) -> String {
    match frame {
        Some(frame) => {
            let code = u16::from(frame.code);
            let reason = frame.reason.as_str();
            if reason.is_empty() {
                code.to_string()
            } else {
                format!("{code} {reason}")
            }
        }
        None => fallback.to_string(),
    }
}

async fn write_loop(
    mut sink: Sink,
    mut commands: UnboundedReceiver<Command>,
    close_message: Option<String>,
) {
    while let Some(command) = commands.recv().await {
        match command {
            Command::Send(text) => {
                if sink.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
            Command::Close => {
                if let Some(message) = &close_message {
                    let _ = sink.send(Message::Text(message.clone().into())).await;
                }
                let _ = sink
                    .send(Message::Close(Some(CloseFrame {
                        code: CloseCode::Normal,
                        reason: "Closed by Aurolis".into(),
                    })))
                    .await;
                break;
            }
        }
    }
    let _ = sink.close().await;
}

impl RealtimeEngine {
    pub fn new(tls: Arc<rustls::ClientConfig>) -> Self {
        Self {
            connections: Arc::new(Mutex::new(HashMap::new())),
            tls,
        }
    }

    fn take(&self, id: &str) -> Option<Connection> {
        self.connections.lock().ok()?.remove(id)
    }

    fn forget(
        connections: &Arc<Mutex<HashMap<String, Connection>>>,
        id: &str,
        generation: uuid::Uuid,
    ) {
        if let Ok(mut map) = connections.lock()
            && map
                .get(id)
                .is_some_and(|connection| connection.generation == generation)
        {
            map.remove(id);
        }
    }

    async fn open_socket(&self, url: &url::Url, headers: &[HeaderPair]) -> AppResult<Socket> {
        let mut request = url
            .as_str()
            .into_client_request()
            .map_err(|error| engine_error("invalid_url", error.to_string()))?;
        for (name, value) in header_map(headers) {
            let name = HeaderName::from_bytes(name.as_bytes())
                .map_err(|_| invalid("Invalid header name"))?;
            let value =
                HeaderValue::from_str(&value).map_err(|_| invalid("Invalid header value"))?;
            request.headers_mut().insert(name, value);
        }
        let connector = Connector::Rustls(self.tls.clone());
        let (socket, _) =
            tokio_tungstenite::connect_async_tls_with_config(request, None, false, Some(connector))
                .await
                .map_err(ws_failure)?;
        Ok(socket)
    }

    pub async fn connect(&self, app: AppHandle, params: ConnectParams) -> AppResult<()> {
        let url = validate(&params)?;
        if let Some(previous) = self.take(&params.connection_id) {
            let _ = previous.sender.send(Command::Close);
        }
        let emitter = EventSink {
            app,
            connection_id: params.connection_id.clone(),
        };
        let timeout = Duration::from_millis(params.timeout_ms);
        if params.protocol == "socketio" {
            let path = params.socketio_path.clone();
            return match tokio::time::timeout(timeout, self.handshake_socketio(&params, &url)).await
            {
                Ok(Ok((socket, namespace, sid))) => {
                    self.start_socketio(emitter, &params, socket, namespace, sid);
                    Ok(())
                }
                Ok(Err(error)) => Err(error),
                Err(_) => Err(engine_error(
                    "timeout",
                    format!("No Socket.IO handshake. Check the URL and the path ({path})."),
                )),
            };
        }
        let target = to_websocket(&url);
        let socket =
            match tokio::time::timeout(timeout, self.open_socket(&target, &params.headers)).await {
                Ok(result) => result?,
                Err(_) => return Err(engine_error("timeout", "Opening handshake has timed out")),
            };
        self.start_websocket(emitter, &params, socket);
        Ok(())
    }

    fn register(
        &self,
        params: &ConnectParams,
        namespace: String,
        sender: UnboundedSender<Command>,
    ) -> (uuid::Uuid, Arc<AtomicBool>) {
        let generation = uuid::Uuid::new_v4();
        let closing = Arc::new(AtomicBool::new(false));
        if let Ok(mut map) = self.connections.lock() {
            map.insert(
                params.connection_id.clone(),
                Connection {
                    generation,
                    protocol: params.protocol.clone(),
                    namespace,
                    sender,
                    closing: closing.clone(),
                },
            );
        }
        (generation, closing)
    }

    fn start_websocket(&self, emitter: EventSink, params: &ConnectParams, socket: Socket) {
        let (sink, stream) = socket.split();
        let (sender, commands) = unbounded_channel();
        let (generation, _) = self.register(params, "/".into(), sender);
        emitter.emit("open", format!("Connected to {}", params.url), None);
        tauri::async_runtime::spawn(write_loop(sink, commands, None));
        let connections = self.connections.clone();
        let id = params.connection_id.clone();
        tauri::async_runtime::spawn(async move {
            let detail = read_websocket(&emitter, stream).await;
            Self::forget(&connections, &id, generation);
            emitter.emit("close", format!("Disconnected ({detail})"), None);
        });
    }

    async fn handshake_socketio(
        &self,
        params: &ConnectParams,
        url: &url::Url,
    ) -> AppResult<(Socket, String, Option<String>)> {
        let (target, namespace) = socketio::engine_url(url, &params.socketio_path);
        let mut socket = self
            .open_socket(&target, &params.headers)
            .await
            .map_err(|error| {
                if error.code == "refused" {
                    engine_error(
                        "network",
                        format!(
                            "Socket.IO handshake failed. {}",
                            error.message.unwrap_or_default()
                        ),
                    )
                } else {
                    error
                }
            })?;
        let mut opened = false;
        while let Some(message) = socket.next().await {
            let message = message.map_err(ws_failure)?;
            let Message::Text(text) = message else {
                continue;
            };
            match socketio::parse(text.as_str()) {
                Packet::Open { .. } if !opened => {
                    opened = true;
                    socket
                        .send(Message::Text(socketio::connect_packet(&namespace).into()))
                        .await
                        .map_err(ws_failure)?;
                }
                Packet::Ping => {
                    socket
                        .send(Message::Text("3".into()))
                        .await
                        .map_err(ws_failure)?;
                }
                Packet::Connect {
                    namespace: connected,
                    sid,
                } if connected == namespace => {
                    return Ok((socket, namespace, sid));
                }
                Packet::ConnectError {
                    namespace: failed,
                    message,
                } if failed == namespace => {
                    return Err(engine_error("refused", message));
                }
                Packet::Close => break,
                _ => {}
            }
        }
        Err(engine_error(
            "network",
            "The Socket.IO server closed the connection.",
        ))
    }

    fn start_socketio(
        &self,
        emitter: EventSink,
        params: &ConnectParams,
        socket: Socket,
        namespace: String,
        sid: Option<String>,
    ) {
        let (sink, stream) = socket.split();
        let (sender, commands) = unbounded_channel();
        let (generation, closing) = self.register(params, namespace.clone(), sender.clone());
        emitter.emit(
            "open",
            format!(
                "Connected to {} (id {})",
                params.url,
                sid.unwrap_or_else(|| "unknown".into())
            ),
            None,
        );
        let close_message = socketio::disconnect_packet(&namespace);
        tauri::async_runtime::spawn(write_loop(sink, commands, Some(close_message)));
        let connections = self.connections.clone();
        let id = params.connection_id.clone();
        let events = params.socketio_events.clone();
        tauri::async_runtime::spawn(async move {
            let reason = read_socketio(&emitter, stream, &sender, &namespace, &events).await;
            let reason = if closing.load(Ordering::SeqCst) {
                "io client disconnect".to_string()
            } else {
                reason
            };
            Self::forget(&connections, &id, generation);
            emitter.emit("close", format!("Disconnected ({reason})"), None);
        });
    }

    pub fn send(&self, app: &AppHandle, params: SendParams) -> AppResult<()> {
        check_run_id(&params.connection_id)?;
        if params.event.len() > 200
            || params.body.len() > MAX_TEXT_BODY
            || (params.format != "json" && params.format != "text")
        {
            return Err(invalid("Check the message and try again."));
        }
        let connection = self
            .connections
            .lock()
            .ok()
            .and_then(|map| map.get(&params.connection_id).cloned())
            .ok_or_else(|| engine_error("not_connected", "Connect before sending."))?;
        let json = params.format == "json";
        let socketio = connection.protocol == "socketio";
        let text = if socketio {
            if params.event.trim().is_empty() {
                return Err(invalid("Enter an event name."));
            }
            let payload = if json {
                parse_json(&params.body)?
            } else {
                Value::String(params.body.clone())
            };
            socketio::event_packet(&connection.namespace, &params.event, payload)
        } else {
            if json {
                parse_json(&params.body)?;
            }
            params.body.clone()
        };
        connection
            .sender
            .send(Command::Send(text))
            .map_err(|_| engine_error("not_connected", "The connection is closed."))?;
        EventSink {
            app: app.clone(),
            connection_id: params.connection_id.clone(),
        }
        .emit(
            "outgoing",
            clip(&params.body, MAX_LOGGED_BYTES),
            socketio.then(|| params.event.clone()),
        );
        Ok(())
    }

    pub fn disconnect(&self, id: &str) -> AppResult<()> {
        check_run_id(id)?;
        if let Some(connection) = self
            .connections
            .lock()
            .ok()
            .and_then(|map| map.get(id).cloned())
        {
            connection.closing.store(true, Ordering::SeqCst);
            let _ = connection.sender.send(Command::Close);
        }
        Ok(())
    }
}

async fn read_websocket(emitter: &EventSink, mut stream: Stream) -> String {
    while let Some(message) = stream.next().await {
        match message {
            Ok(Message::Text(text)) => {
                emitter.emit("incoming", clip(text.as_str(), MAX_LOGGED_BYTES), None)
            }
            Ok(Message::Binary(bytes)) => emitter.emit(
                "incoming",
                format!("[binary message, {} bytes]", bytes.len()),
                None,
            ),
            Ok(Message::Close(frame)) => return close_detail(frame.as_ref(), 1005),
            Ok(_) => {}
            Err(WsError::ConnectionClosed) => return "1000".into(),
            Err(error) => {
                emitter.emit("error", ws_failure(error).message.unwrap_or_default(), None);
                return "1006".into();
            }
        }
    }
    "1006".into()
}

async fn read_socketio(
    emitter: &EventSink,
    mut stream: Stream,
    sender: &UnboundedSender<Command>,
    namespace: &str,
    events: &[String],
) -> String {
    while let Some(message) = stream.next().await {
        let text = match message {
            Ok(Message::Text(text)) => text,
            Ok(Message::Binary(_)) => continue,
            Ok(Message::Close(_)) => return "transport close".into(),
            Ok(_) => continue,
            Err(WsError::ConnectionClosed) => return "transport close".into(),
            Err(error) => {
                emitter.emit("error", ws_failure(error).message.unwrap_or_default(), None);
                return "transport error".into();
            }
        };
        match socketio::parse(text.as_str()) {
            Packet::Ping => {
                let _ = sender.send(Command::Send("3".into()));
            }
            Packet::Close => return "transport close".into(),
            Packet::Disconnect { namespace: closed } if closed == namespace => {
                return "io server disconnect".into();
            }
            Packet::Event {
                namespace: target,
                name,
                args,
            } if target == namespace => {
                if events.is_empty() || events.contains(&name) {
                    emitter.emit(
                        "incoming",
                        clip(&socketio::stringify_args(&args), MAX_LOGGED_BYTES),
                        Some(name),
                    );
                }
            }
            Packet::BinaryEvent {
                namespace: target,
                attachments,
            } if target == namespace => {
                emitter.emit(
                    "incoming",
                    format!("[binary event, {attachments} attachment(s)]"),
                    None,
                );
            }
            _ => {}
        }
    }
    "transport close".into()
}
