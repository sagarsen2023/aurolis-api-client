use std::collections::{BTreeMap, HashMap};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;

use crate::engines::http::{HttpSendParams, build_request, validate};
use crate::engines::{check_run_id, classify_transport_error, engine_error, invalid};
use crate::outcome::{AppResult, Failure};

pub const LOAD_EVENT: &str = "aurolis:load-event";
pub const MAX_VIRTUAL_USERS: u32 = 500;
pub const MAX_DURATION_SECONDS: u64 = 60 * 60;
pub const MAX_REQUESTS: u64 = 1_000_000;
pub const MAX_THINK_TIME_MS: u64 = 60_000;
const REPORT_INTERVAL: Duration = Duration::from_millis(250);
const MAX_ERROR_KINDS: usize = 20;

const BUCKETS: usize = 800;
const BASE_MS: f64 = 0.1;
const GROWTH: f64 = 1.02;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum LoadLimit {
    Duration { seconds: u64 },
    Requests { count: u64 },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadStartParams {
    pub run_id: String,
    pub request: HttpSendParams,
    pub virtual_users: u32,
    pub limit: LoadLimit,
    pub ramp_up_seconds: u64,
    pub think_time_ms: u64,
}

#[derive(Clone)]
struct Histogram {
    counts: Vec<u64>,
    total: u64,
    sum: f64,
    min: f64,
    max: f64,
}

impl Histogram {
    fn new() -> Self {
        Self {
            counts: vec![0; BUCKETS],
            total: 0,
            sum: 0.0,
            min: f64::INFINITY,
            max: 0.0,
        }
    }

    fn bucket(ms: f64) -> usize {
        if ms <= BASE_MS {
            return 0;
        }
        let index = ((ms / BASE_MS).ln() / GROWTH.ln()).floor() as usize + 1;
        index.min(BUCKETS - 1)
    }

    fn bucket_value(index: usize) -> f64 {
        if index == 0 {
            BASE_MS
        } else {
            BASE_MS * GROWTH.powf(index as f64 - 0.5)
        }
    }

    fn record(&mut self, ms: f64) {
        self.counts[Self::bucket(ms)] += 1;
        self.total += 1;
        self.sum += ms;
        self.min = self.min.min(ms);
        self.max = self.max.max(ms);
    }

    fn clear(&mut self) {
        self.counts.iter_mut().for_each(|count| *count = 0);
        self.total = 0;
        self.sum = 0.0;
        self.min = f64::INFINITY;
        self.max = 0.0;
    }

    fn percentile(&self, quantile: f64) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        let target = ((quantile * self.total as f64).ceil() as u64).max(1);
        let mut seen = 0;
        for (index, count) in self.counts.iter().enumerate() {
            seen += count;
            if seen >= target {
                return Self::bucket_value(index).clamp(self.min, self.max);
            }
        }
        self.max
    }

    fn summary(&self) -> Option<LatencySummary> {
        (self.total > 0).then(|| LatencySummary {
            min: round(self.min),
            mean: round(self.sum / self.total as f64),
            p50: round(self.percentile(0.5)),
            p90: round(self.percentile(0.9)),
            p95: round(self.percentile(0.95)),
            p99: round(self.percentile(0.99)),
            max: round(self.max),
        })
    }
}

fn round(ms: f64) -> f64 {
    (ms * 100.0).round() / 100.0
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LatencySummary {
    min: f64,
    mean: f64,
    p50: f64,
    p90: f64,
    p95: f64,
    p99: f64,
    max: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SecondPoint {
    second: u64,
    requests: u64,
    failed: u64,
    p50: f64,
    p95: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorCount {
    code: String,
    message: Option<String>,
    count: u64,
}

struct CurrentSecond {
    index: u64,
    requests: u64,
    failed: u64,
    latency: Histogram,
}

impl CurrentSecond {
    fn point(&self) -> SecondPoint {
        SecondPoint {
            second: self.index,
            requests: self.requests,
            failed: self.failed,
            p50: round(self.latency.percentile(0.5)),
            p95: round(self.latency.percentile(0.95)),
        }
    }
}

struct Stats {
    latency: Histogram,
    statuses: BTreeMap<u16, u64>,
    errors: Vec<ErrorCount>,
    total: u64,
    failed: u64,
    bytes: u64,
    points: Vec<SecondPoint>,
    current: CurrentSecond,
}

enum Sample {
    Response { status: u16, ms: f64, bytes: u64 },
    Error(Failure),
}

fn is_failure_status(status: u16) -> bool {
    !(200..400).contains(&status)
}

impl Stats {
    fn new() -> Self {
        Self {
            latency: Histogram::new(),
            statuses: BTreeMap::new(),
            errors: Vec::new(),
            total: 0,
            failed: 0,
            bytes: 0,
            points: Vec::new(),
            current: CurrentSecond {
                index: 0,
                requests: 0,
                failed: 0,
                latency: Histogram::new(),
            },
        }
    }

    fn advance(&mut self, second: u64) {
        while self.current.index < second {
            self.points.push(self.current.point());
            self.current.index += 1;
            self.current.requests = 0;
            self.current.failed = 0;
            self.current.latency.clear();
        }
    }

    fn record(&mut self, second: u64, sample: Sample) {
        self.advance(second);
        self.total += 1;
        self.current.requests += 1;
        match sample {
            Sample::Response { status, ms, bytes } => {
                self.latency.record(ms);
                self.current.latency.record(ms);
                *self.statuses.entry(status).or_default() += 1;
                self.bytes += bytes;
                if is_failure_status(status) {
                    self.failed += 1;
                    self.current.failed += 1;
                }
            }
            Sample::Error(failure) => {
                self.failed += 1;
                self.current.failed += 1;
                if let Some(entry) = self
                    .errors
                    .iter_mut()
                    .find(|entry| entry.code == failure.code)
                {
                    entry.count += 1;
                } else if self.errors.len() < MAX_ERROR_KINDS {
                    self.errors.push(ErrorCount {
                        code: failure.code,
                        message: failure.message,
                        count: 1,
                    });
                }
            }
        }
    }

    fn points(&self, elapsed_second: u64) -> Vec<SecondPoint> {
        let mut points = self.points.clone();
        points.push(self.current.point());
        let mut next = self.current.index + 1;
        while next < elapsed_second {
            points.push(SecondPoint {
                second: next,
                requests: 0,
                failed: 0,
                p50: 0.0,
                p95: 0.0,
            });
            next += 1;
        }
        points
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadSnapshot {
    run_id: String,
    state: &'static str,
    elapsed_ms: u64,
    active_users: u32,
    total: u64,
    failed: u64,
    bytes: u64,
    requests_per_second: f64,
    latency: Option<LatencySummary>,
    statuses: Vec<(u16, u64)>,
    errors: Vec<ErrorCount>,
    points: Vec<SecondPoint>,
}

struct Run {
    run_id: String,
    request: HttpSendParams,
    url: url::Url,
    client: reqwest::Client,
    virtual_users: u32,
    ramp_up: Duration,
    think_time: Duration,
    timeout: Duration,
    deadline: Option<Instant>,
    remaining: Option<AtomicU64>,
    started: Instant,
    active: AtomicU32,
    stats: Mutex<Stats>,
    cancel: CancellationToken,
}

impl Run {
    fn take_slot(&self) -> bool {
        if self.cancel.is_cancelled() {
            return false;
        }
        if self
            .deadline
            .is_some_and(|deadline| Instant::now() >= deadline)
        {
            return false;
        }
        match &self.remaining {
            Some(remaining) => remaining
                .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |left| {
                    left.checked_sub(1)
                })
                .is_ok(),
            None => true,
        }
    }

    async fn send_once(&self) -> Result<(u16, u64), Failure> {
        let request = build_request(&self.client, &self.request, self.url.clone())?;
        let response = request
            .send()
            .await
            .map_err(|error| classify_transport_error(&error))?;
        let status = response.status().as_u16();
        let mut stream = response.bytes_stream();
        let mut bytes = 0u64;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|error| classify_transport_error(&error))?;
            bytes += chunk.len() as u64;
        }
        Ok((status, bytes))
    }

    async fn pause(&self, duration: Duration) -> bool {
        if duration.is_zero() {
            return !self.cancel.is_cancelled();
        }
        tokio::select! {
            _ = tokio::time::sleep(duration) => true,
            _ = self.cancel.cancelled() => false,
        }
    }

    async fn worker(self: Arc<Self>, index: u32) {
        let delay = self
            .ramp_up
            .mul_f64(f64::from(index) / f64::from(self.virtual_users));
        if !self.pause(delay).await {
            return;
        }
        self.active.fetch_add(1, Ordering::SeqCst);
        while self.take_slot() {
            let started = Instant::now();
            let outcome = tokio::select! {
                outcome = tokio::time::timeout(self.timeout, self.send_once()) => outcome,
                _ = self.cancel.cancelled() => break,
            };
            let ms = started.elapsed().as_secs_f64() * 1000.0;
            let sample = match outcome {
                Ok(Ok((status, bytes))) => Sample::Response { status, ms, bytes },
                Ok(Err(failure)) => Sample::Error(failure),
                Err(_) => Sample::Error(engine_error("timeout", "No response in time.")),
            };
            let second = self.started.elapsed().as_secs();
            if let Ok(mut stats) = self.stats.lock() {
                stats.record(second, sample);
            }
            if !self.pause(self.think_time).await {
                break;
            }
        }
        self.active.fetch_sub(1, Ordering::SeqCst);
    }

    fn snapshot(&self, state: &'static str) -> LoadSnapshot {
        let elapsed = self.started.elapsed();
        let elapsed_ms = elapsed.as_millis() as u64;
        let stats = self
            .stats
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let seconds = elapsed.as_secs_f64();
        LoadSnapshot {
            run_id: self.run_id.clone(),
            state,
            elapsed_ms,
            active_users: self.active.load(Ordering::SeqCst),
            total: stats.total,
            failed: stats.failed,
            bytes: stats.bytes,
            requests_per_second: if seconds > 0.0 {
                round(stats.total as f64 / seconds)
            } else {
                0.0
            },
            latency: stats.latency.summary(),
            statuses: stats
                .statuses
                .iter()
                .map(|(code, count)| (*code, *count))
                .collect(),
            errors: stats.errors.clone(),
            points: stats.points(elapsed.as_secs()),
        }
    }
}

fn check_params(params: &LoadStartParams) -> AppResult<url::Url> {
    check_run_id(&params.run_id)?;
    let url = validate(&params.request)?;
    if !(1..=MAX_VIRTUAL_USERS).contains(&params.virtual_users) {
        return Err(invalid(format!(
            "Use between 1 and {MAX_VIRTUAL_USERS} virtual users."
        )));
    }
    match params.limit {
        LoadLimit::Duration { seconds } if !(1..=MAX_DURATION_SECONDS).contains(&seconds) => {
            return Err(invalid("Run for between 1 second and 1 hour."));
        }
        LoadLimit::Requests { count } if !(1..=MAX_REQUESTS).contains(&count) => {
            return Err(invalid(format!(
                "Send between 1 and {MAX_REQUESTS} requests."
            )));
        }
        _ => {}
    }
    if params.ramp_up_seconds > MAX_DURATION_SECONDS {
        return Err(invalid("Ramp up for 1 hour or less."));
    }
    if params.think_time_ms > MAX_THINK_TIME_MS {
        return Err(invalid("Pause for 60 seconds or less between requests."));
    }
    Ok(url)
}

#[derive(Default)]
pub struct LoadEngine {
    runs: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl LoadEngine {
    pub fn start(
        &self,
        app: AppHandle,
        client: reqwest::Client,
        params: LoadStartParams,
    ) -> AppResult<()> {
        let url = check_params(&params)?;
        let cancel = CancellationToken::new();
        {
            let mut runs = self
                .runs
                .lock()
                .map_err(|_| engine_error("unknown", "The load runner is unavailable."))?;
            if !runs.is_empty() {
                return Err(invalid("A load test is already running. Stop it first."));
            }
            runs.insert(params.run_id.clone(), cancel.clone());
        }
        let started = Instant::now();
        let (deadline, remaining) = match params.limit {
            LoadLimit::Duration { seconds } => (Some(started + Duration::from_secs(seconds)), None),
            LoadLimit::Requests { count } => (None, Some(AtomicU64::new(count))),
        };
        let run = Arc::new(Run {
            run_id: params.run_id.clone(),
            timeout: Duration::from_millis(params.request.timeout_ms),
            request: params.request,
            url,
            client,
            virtual_users: params.virtual_users,
            ramp_up: Duration::from_secs(params.ramp_up_seconds),
            think_time: Duration::from_millis(params.think_time_ms),
            deadline,
            remaining,
            started,
            active: AtomicU32::new(0),
            stats: Mutex::new(Stats::new()),
            cancel,
        });
        let runs = self.runs.clone();
        tauri::async_runtime::spawn(async move {
            let mut workers = JoinSet::new();
            for index in 0..run.virtual_users {
                workers.spawn(run.clone().worker(index));
            }
            let mut ticker = tokio::time::interval(REPORT_INTERVAL);
            loop {
                tokio::select! {
                    joined = workers.join_next() => {
                        if joined.is_none() {
                            break;
                        }
                    }
                    _ = ticker.tick() => {
                        let _ = app.emit(LOAD_EVENT, run.snapshot("running"));
                    }
                }
            }
            let state = if run.cancel.is_cancelled() {
                "stopped"
            } else {
                "completed"
            };
            if let Ok(mut runs) = runs.lock() {
                runs.remove(&run.run_id);
            }
            let _ = app.emit(LOAD_EVENT, run.snapshot(state));
        });
        Ok(())
    }

    pub fn stop(&self, run_id: &str) -> AppResult<()> {
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
    use crate::engines::http::PreparedBody;

    fn params(limit: LoadLimit, virtual_users: u32) -> LoadStartParams {
        LoadStartParams {
            run_id: "load-1".into(),
            request: HttpSendParams {
                run_id: "load-1".into(),
                method: "GET".into(),
                url: "https://api.example.com/health".into(),
                headers: vec![],
                body: PreparedBody::None,
                timeout_ms: 30_000,
            },
            virtual_users,
            limit,
            ramp_up_seconds: 0,
            think_time_ms: 0,
        }
    }

    #[test]
    fn computes_percentiles_within_two_percent() {
        let mut histogram = Histogram::new();
        for ms in 1..=1000 {
            histogram.record(f64::from(ms));
        }
        let summary = histogram.summary().unwrap();
        assert_eq!(summary.min, 1.0);
        assert_eq!(summary.max, 1000.0);
        assert_eq!(summary.mean, 500.5);
        for (value, expected) in [
            (summary.p50, 500.0),
            (summary.p95, 950.0),
            (summary.p99, 990.0),
        ] {
            assert!(
                (value - expected).abs() / expected < 0.02,
                "{value} vs {expected}"
            );
        }
        assert!(Histogram::new().summary().is_none());
    }

    #[test]
    fn groups_samples_by_second() {
        let mut stats = Stats::new();
        stats.record(
            0,
            Sample::Response {
                status: 200,
                ms: 10.0,
                bytes: 5,
            },
        );
        stats.record(
            2,
            Sample::Response {
                status: 503,
                ms: 20.0,
                bytes: 5,
            },
        );
        stats.record(2, Sample::Error(engine_error("timeout", "late")));
        stats.record(2, Sample::Error(engine_error("timeout", "late")));
        assert_eq!(stats.total, 4);
        assert_eq!(stats.failed, 3);
        assert_eq!(stats.bytes, 10);
        assert_eq!(stats.errors.len(), 1);
        assert_eq!(stats.errors[0].count, 2);
        let points = stats.points(4);
        let requests: Vec<u64> = points.iter().map(|point| point.requests).collect();
        assert_eq!(requests, vec![1, 0, 3, 0]);
        assert_eq!(points[2].failed, 3);
    }

    #[test]
    fn validates_limits() {
        assert!(check_params(&params(LoadLimit::Duration { seconds: 30 }, 10)).is_ok());
        assert!(check_params(&params(LoadLimit::Requests { count: 100 }, 1)).is_ok());
        assert!(check_params(&params(LoadLimit::Duration { seconds: 0 }, 10)).is_err());
        assert!(check_params(&params(LoadLimit::Requests { count: 0 }, 10)).is_err());
        assert!(check_params(&params(LoadLimit::Duration { seconds: 30 }, 0)).is_err());
        assert!(check_params(&params(LoadLimit::Duration { seconds: 30 }, 501)).is_err());
        let limit: LoadLimit =
            serde_json::from_value(serde_json::json!({"kind": "requests", "count": 5})).unwrap();
        assert!(matches!(limit, LoadLimit::Requests { count: 5 }));
    }

    #[test]
    fn treats_4xx_and_5xx_as_failures() {
        assert!(!is_failure_status(200));
        assert!(!is_failure_status(304));
        assert!(is_failure_status(404));
        assert!(is_failure_status(500));
    }
}
