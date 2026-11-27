use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, LazyLock};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use regex::Regex;
use serde::Serialize;
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

use crate::github::auth::{GithubAuth, TokenState};
use crate::outcome::{AppResult, Failure};
use crate::paths::resolve;

const MIN_SYSTEM_GIT: (u32, u32) = (2, 31);
const GITHUB_HTTPS: &str = "https://github.com/";

#[derive(Debug, Clone, Serialize)]
pub struct GitInfo {
    pub version: String,
    pub path: String,
}

#[derive(Debug, Clone)]
pub struct RunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Default)]
pub struct RunOptions<'a> {
    pub network: bool,
    pub allow_failure: bool,
    pub input: Option<&'a str>,
    pub cancel: Option<CancellationToken>,
}

impl RunOptions<'_> {
    pub fn lenient() -> Self {
        Self {
            allow_failure: true,
            ..Self::default()
        }
    }

    pub fn network() -> Self {
        Self {
            network: true,
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone)]
pub struct StatusEntry {
    pub code: String,
    pub path: String,
    pub old_path: Option<String>,
}

pub struct Git {
    auth: Arc<GithubAuth>,
    binary: tokio::sync::Mutex<Option<GitInfo>>,
    queues: std::sync::Mutex<HashMap<PathBuf, Arc<tokio::sync::Mutex<()>>>>,
}

pub fn command(program: &str) -> tokio::process::Command {
    let mut command = tokio::process::Command::new(program);
    #[cfg(windows)]
    command.creation_flags(0x0800_0000);
    command.kill_on_drop(true);
    command
}

async fn run_plain(program: &str, args: &[&str]) -> Option<String> {
    let output = command(program)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .await
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

fn parse_version(output: &str) -> Option<(u32, u32, u32)> {
    static VERSION: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"git version (\d+)\.(\d+)(?:\.(\d+))?").unwrap());
    let captures = VERSION.captures(output)?;
    let part = |index: usize| {
        captures
            .get(index)
            .and_then(|value| value.as_str().parse().ok())
            .unwrap_or(0)
    };
    Some((part(1), part(2), part(3)))
}

fn is_executable(file: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(file) else {
        return false;
    };
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.is_file() && metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        metadata.is_file()
    }
}

fn candidates() -> Vec<String> {
    if cfg!(windows) {
        let mut list = vec!["git".to_string()];
        let dirs = [
            std::env::var("ProgramFiles").ok(),
            std::env::var("ProgramFiles(x86)").ok(),
            std::env::var("LOCALAPPDATA")
                .ok()
                .map(|dir| format!("{dir}\\Programs")),
        ];
        for dir in dirs.into_iter().flatten() {
            list.push(format!("{dir}\\Git\\cmd\\git.exe"));
        }
        list
    } else if cfg!(target_os = "macos") {
        ["/opt/homebrew/bin/git", "/usr/local/bin/git", "git"]
            .map(String::from)
            .to_vec()
    } else {
        ["git", "/usr/bin/git", "/usr/local/bin/git"]
            .map(String::from)
            .to_vec()
    }
}

async fn usable(candidate: &str) -> bool {
    if candidate != "git" {
        return is_executable(Path::new(candidate));
    }
    if !cfg!(target_os = "macos") {
        return true;
    }
    run_plain("/usr/bin/xcode-select", &["-p"]).await.is_some()
}

async fn find_system_git() -> Option<GitInfo> {
    for candidate in candidates() {
        if !usable(&candidate).await {
            continue;
        }
        let Some(output) = run_plain(&candidate, &["--version"]).await else {
            continue;
        };
        let Some((major, minor, patch)) = parse_version(&output) else {
            continue;
        };
        if (major, minor) < MIN_SYSTEM_GIT {
            continue;
        }
        return Some(GitInfo {
            version: format!("{major}.{minor}.{patch}"),
            path: candidate,
        });
    }
    None
}

fn contains_any(text: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| text.contains(needle))
}

pub fn classify_git_error(stderr: &str) -> &'static str {
    let text = stderr.to_lowercase();
    if text.contains("not a git repository") {
        return "not_a_repository";
    }
    if contains_any(&text, &["protected branch", "gh006"]) {
        return "protected_branch";
    }
    if text.contains("[rejected]") && contains_any(&text, &["non-fast-forward", "fetch first"]) {
        return "push_rejected";
    }
    if contains_any(
        &text,
        &[
            "would be overwritten by merge",
            "commit your changes or stash them",
        ],
    ) {
        return "local_changes";
    }
    if contains_any(&text, &["automatic merge failed", "conflict ("]) {
        return "merge_conflict";
    }
    if text.contains("repository not found")
        || (text.contains("remote:") && text.contains("not found"))
        || text.contains("could not read username for 'https://github.com'")
    {
        return "repository_not_found";
    }
    if contains_any(
        &text,
        &[
            "authentication failed",
            "could not read username",
            "could not read password",
            "terminal prompts disabled",
            "permission denied",
            "the requested url returned error: 403",
        ],
    ) {
        return "auth_failed";
    }
    if contains_any(
        &text,
        &[
            "could not resolve host",
            "failed to connect",
            "connection timed out",
            "network is unreachable",
            "operation timed out",
        ],
    ) {
        return "network";
    }
    if text.contains("already exists and is not an empty directory") {
        return "folder_exists";
    }
    if text.contains("index.lock") {
        return "locked";
    }
    "git_failed"
}

pub fn git_failure(code: &str, output: &str) -> Failure {
    let message = output
        .trim()
        .lines()
        .last()
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    Failure::new(code, message)
}

static CLONE_URL_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    [
        r"^https://[^\s/@]+(?::\d+)?/\S+$",
        r"^ssh://\S+$",
        r"^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:\S+$",
    ]
    .iter()
    .map(|pattern| Regex::new(pattern).unwrap())
    .collect()
});

static GITHUB_SHORTHAND: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)^(?:https?://)?(?:www\.)?github\.com/([^/\s]+)/([^/\s#?]+?)(?:\.git)?/?(?:[#?].*)?$",
    )
    .unwrap()
});

static OWNER_REPO: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/([A-Za-z0-9._-]{1,100})$").unwrap()
});

pub fn normalize_clone_url(input: &str) -> Option<String> {
    static TRAILING_GIT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\.git/?$").unwrap());
    let value = TRAILING_GIT.replace(input.trim(), ".git").into_owned();
    if let Some(captures) = OWNER_REPO.captures(&value) {
        let repo = captures[2].trim_end_matches(".git");
        return Some(format!("https://github.com/{}/{}.git", &captures[1], repo));
    }
    if let Some(captures) = GITHUB_SHORTHAND.captures(&value) {
        return Some(format!(
            "https://github.com/{}/{}.git",
            &captures[1], &captures[2]
        ));
    }
    CLONE_URL_PATTERNS
        .iter()
        .any(|pattern| pattern.is_match(&value))
        .then_some(value)
}

#[derive(Debug, Clone, PartialEq, Serialize, serde::Deserialize)]
pub struct GithubRef {
    pub owner: String,
    pub repo: String,
}

pub fn parse_github_remote(url: &str) -> Option<GithubRef> {
    static PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
        [
            r"(?i)^https://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$",
            r"(?i)^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$",
            r"(?i)^ssh://git@github\.com/([^/]+)/([^/]+?)(?:\.git)?$",
        ]
        .iter()
        .map(|pattern| Regex::new(pattern).unwrap())
        .collect()
    });
    PATTERNS.iter().find_map(|pattern| {
        pattern.captures(url).map(|captures| GithubRef {
            owner: captures[1].to_string(),
            repo: captures[2].to_string(),
        })
    })
}

pub fn repo_name_from_url(url: &str) -> String {
    let trimmed = url.trim_end_matches(['/', '\\']);
    let last = trimmed.rsplit(['/', ':']).next().unwrap_or_default();
    let name = if last.to_lowercase().ends_with(".git") {
        &last[..last.len() - 4]
    } else {
        last
    };
    if name.is_empty() {
        "workspace".to_string()
    } else {
        name.to_string()
    }
}

pub fn same_remote(a: &str, b: &str) -> bool {
    let key = |url: &str| match parse_github_remote(url) {
        Some(github) => format!("github.com/{}/{}", github.owner, github.repo).to_lowercase(),
        None => {
            let lower = url.to_lowercase();
            let trimmed = lower.strip_suffix(".git").unwrap_or(&lower);
            trimmed.trim_end_matches('/').to_string()
        }
    };
    key(a) == key(b)
}

pub fn changed_paths(entries: &[StatusEntry]) -> Vec<String> {
    entries
        .iter()
        .flat_map(|entry| {
            let mut paths = vec![entry.path.clone()];
            if let Some(old) = &entry.old_path {
                paths.push(old.clone());
            }
            paths
        })
        .collect()
}

fn parse_status(stdout: &str) -> Vec<StatusEntry> {
    let parts: Vec<&str> = stdout.split('\0').collect();
    let mut entries = Vec::new();
    let mut index = 0;
    while index < parts.len() {
        let part = parts[index];
        index += 1;
        if part.len() < 4 {
            continue;
        }
        let code = part[..2].to_string();
        let path = part[3..].to_string();
        let renamed = code.starts_with('R') || code.starts_with('C');
        let old_path = if renamed {
            let old = parts.get(index).map(|value| value.to_string());
            index += 1;
            old
        } else {
            None
        };
        entries.push(StatusEntry {
            code,
            path,
            old_path,
        });
    }
    entries
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct BranchRefs {
    pub local: Vec<String>,
    pub remote: Vec<String>,
}

pub fn parse_branch_refs(output: &str) -> BranchRefs {
    let mut refs = BranchRefs::default();
    for line in output.lines().map(str::trim) {
        if let Some(name) = line.strip_prefix("refs/heads/") {
            refs.local.push(name.to_string());
        } else if let Some(name) = line.strip_prefix("refs/remotes/origin/")
            && name != "HEAD"
        {
            refs.remote.push(name.to_string());
        }
    }
    refs.local.sort();
    refs.remote.sort();
    refs.remote.retain(|name| !refs.local.contains(name));
    refs
}

fn strings(args: &[&str]) -> Vec<String> {
    args.iter().map(|arg| arg.to_string()).collect()
}

const PATHSPEC_FROM_STDIN: [&str; 2] = ["--pathspec-from-file=-", "--pathspec-file-nul"];

impl Git {
    pub fn new(auth: Arc<GithubAuth>) -> Self {
        Self {
            auth,
            binary: tokio::sync::Mutex::new(None),
            queues: std::sync::Mutex::new(HashMap::new()),
        }
    }

    pub async fn info(&self) -> AppResult<GitInfo> {
        let mut binary = self.binary.lock().await;
        if let Some(found) = binary.as_ref() {
            return Ok(found.clone());
        }
        let found = find_system_git().await.ok_or_else(|| {
            Failure::new(
                "git_unavailable",
                format!(
                    "Git {}.{} or newer isn't installed.",
                    MIN_SYSTEM_GIT.0, MIN_SYSTEM_GIT.1
                ),
            )
        })?;
        *binary = Some(found.clone());
        Ok(found)
    }

    fn queue(&self, repo_dir: &Path) -> Arc<tokio::sync::Mutex<()>> {
        let key = resolve(repo_dir);
        let mut queues = self
            .queues
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        queues
            .entry(key)
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .clone()
    }

    async fn network_env(&self) -> Vec<(String, String)> {
        let TokenState::Ready(token) = self.auth.access_token().await else {
            return Vec::new();
        };
        let basic = STANDARD.encode(format!("x-access-token:{token}"));
        vec![
            ("GIT_CONFIG_COUNT".into(), "1".into()),
            (
                "GIT_CONFIG_KEY_0".into(),
                format!("http.{GITHUB_HTTPS}.extraheader"),
            ),
            (
                "GIT_CONFIG_VALUE_0".into(),
                format!("AUTHORIZATION: basic {basic}"),
            ),
        ]
    }

    pub async fn run(
        &self,
        repo_dir: &Path,
        args: &[String],
        options: RunOptions<'_>,
    ) -> AppResult<RunResult> {
        let git = self.info().await?;
        let lock = self.queue(repo_dir);
        let _guard = lock.lock().await;
        let mut child_command = command(&git.path);
        child_command
            .args(args)
            .current_dir(repo_dir)
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GCM_INTERACTIVE", "never")
            .stdin(if options.input.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if options.network {
            for (key, value) in self.network_env().await {
                child_command.env(key, value);
            }
        }
        let mut child = match child_command.spawn() {
            Ok(child) => child,
            Err(error) => {
                let result = RunResult {
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: error.to_string(),
                };
                if options.allow_failure {
                    return Ok(result);
                }
                return Err(git_failure(
                    classify_git_error(&result.stderr),
                    &result.stderr,
                ));
            }
        };
        if let (Some(input), Some(mut stdin)) = (options.input, child.stdin.take()) {
            let input = input.to_string();
            tokio::spawn(async move {
                let _ = stdin.write_all(input.as_bytes()).await;
            });
        }
        let cancel = options.cancel.clone().unwrap_or_default();
        let output = tokio::select! {
            output = child.wait_with_output() => output?,
            _ = cancel.cancelled() => return Err(Failure::new("cancelled", "Cancelled.")),
        };
        let result = RunResult {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        };
        if result.exit_code != 0 && !options.allow_failure {
            return Err(git_failure(
                classify_git_error(&result.stderr),
                &result.stderr,
            ));
        }
        Ok(result)
    }

    async fn run_args(
        &self,
        repo_dir: &Path,
        args: &[&str],
        options: RunOptions<'_>,
    ) -> AppResult<RunResult> {
        self.run(repo_dir, &strings(args), options).await
    }

    async fn trimmed_or_none(&self, repo_dir: &Path, args: &[&str]) -> AppResult<Option<String>> {
        let result = self.run_args(repo_dir, args, RunOptions::lenient()).await?;
        let value = result.stdout.trim().to_string();
        Ok((result.exit_code == 0 && !value.is_empty()).then_some(value))
    }

    async fn count(&self, repo_dir: &Path, args: &[&str]) -> AppResult<Option<u64>> {
        let result = self.run_args(repo_dir, args, RunOptions::lenient()).await?;
        Ok((result.exit_code == 0).then(|| result.stdout.trim().parse().unwrap_or(0)))
    }

    pub async fn clone_repository(
        &self,
        url: &str,
        target_dir: &Path,
        cancel: CancellationToken,
    ) -> AppResult<()> {
        let parent = target_dir.parent().unwrap_or(target_dir);
        let args = vec![
            "clone".to_string(),
            "--filter=blob:none".to_string(),
            "--".to_string(),
            url.to_string(),
            target_dir.display().to_string(),
        ];
        self.run(
            parent,
            &args,
            RunOptions {
                network: true,
                cancel: Some(cancel),
                ..RunOptions::default()
            },
        )
        .await?;
        Ok(())
    }

    pub async fn top_level(&self, dir: &Path) -> AppResult<Option<PathBuf>> {
        Ok(self
            .trimmed_or_none(dir, &["rev-parse", "--show-toplevel"])
            .await?
            .map(|path| resolve(Path::new(&path))))
    }

    pub async fn init_repository(&self, dir: &Path) -> AppResult<()> {
        self.run_args(
            dir,
            &["init", "--initial-branch=main"],
            RunOptions::default(),
        )
        .await?;
        Ok(())
    }

    pub async fn configure_managed_repository(&self, dir: &Path) -> AppResult<()> {
        self.run_args(
            dir,
            &["config", "core.autocrlf", "false"],
            RunOptions::default(),
        )
        .await?;
        if cfg!(windows) {
            self.run_args(
                dir,
                &["config", "core.longpaths", "true"],
                RunOptions::default(),
            )
            .await?;
        }
        Ok(())
    }

    pub async fn remote_url(&self, dir: &Path) -> AppResult<Option<String>> {
        self.trimmed_or_none(dir, &["config", "--get", "remote.origin.url"])
            .await
    }

    pub async fn current_branch(&self, dir: &Path) -> AppResult<Option<String>> {
        self.trimmed_or_none(dir, &["symbolic-ref", "--short", "-q", "HEAD"])
            .await
    }

    pub async fn changed_file_count(&self, dir: &Path, pathspecs: &[String]) -> AppResult<u64> {
        let mut args = strings(&[
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--",
        ]);
        args.extend(pathspecs.iter().cloned());
        let result = self.run(dir, &args, RunOptions::lenient()).await?;
        if result.exit_code != 0 {
            return Ok(0);
        }
        Ok(result
            .stdout
            .split('\0')
            .filter(|part| !part.is_empty())
            .count() as u64)
    }

    pub async fn unpushed_commit_count(&self, dir: &Path) -> AppResult<u64> {
        if let Some(count) = self
            .count(dir, &["rev-list", "--count", "@{upstream}..HEAD"])
            .await?
        {
            return Ok(count);
        }
        Ok(self
            .count(dir, &["rev-list", "--count", "HEAD"])
            .await?
            .unwrap_or(0))
    }

    async fn commit_identity(&self, dir: &Path) -> AppResult<Vec<String>> {
        let name = self
            .trimmed_or_none(dir, &["config", "--get", "user.name"])
            .await?;
        let email = self
            .trimmed_or_none(dir, &["config", "--get", "user.email"])
            .await?;
        if name.is_some() && email.is_some() {
            return Ok(Vec::new());
        }
        let status = self.auth.status().await;
        let user = status.user;
        let fallback_name = user
            .as_ref()
            .map(|user| user.name.clone().unwrap_or_else(|| user.login.clone()))
            .unwrap_or_else(|| "Aurolis".to_string());
        let fallback_email = user
            .as_ref()
            .map(|user| format!("{}+{}@users.noreply.github.com", user.id, user.login))
            .unwrap_or_else(|| "aurolis@users.noreply.localhost".to_string());
        Ok(vec![
            "-c".to_string(),
            format!("user.name={}", name.unwrap_or(fallback_name)),
            "-c".to_string(),
            format!("user.email={}", email.unwrap_or(fallback_email)),
        ])
    }

    pub async fn commit_paths(&self, dir: &Path, message: &str, paths: &[String]) -> AppResult<()> {
        let input = format!("{}\0", paths.join("\0"));
        let mut add = strings(&["--literal-pathspecs", "add", "--all"]);
        add.extend(PATHSPEC_FROM_STDIN.map(String::from));
        self.run(
            dir,
            &add,
            RunOptions {
                input: Some(&input),
                ..RunOptions::default()
            },
        )
        .await?;
        let mut commit = self.commit_identity(dir).await?;
        commit.extend(strings(&["--literal-pathspecs", "commit", "-m", message]));
        commit.extend(PATHSPEC_FROM_STDIN.map(String::from));
        self.run(
            dir,
            &commit,
            RunOptions {
                input: Some(&input),
                ..RunOptions::default()
            },
        )
        .await?;
        Ok(())
    }

    pub async fn status_entries(
        &self,
        dir: &Path,
        pathspecs: &[String],
    ) -> AppResult<Vec<StatusEntry>> {
        let mut args = strings(&[
            "-c",
            "core.quotePath=false",
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--",
        ]);
        args.extend(pathspecs.iter().cloned());
        let result = self.run(dir, &args, RunOptions::default()).await?;
        Ok(parse_status(&result.stdout))
    }

    pub async fn show_head_file(&self, dir: &Path, repo_path: &str) -> AppResult<Option<String>> {
        let spec = format!("HEAD:{repo_path}");
        let result = self
            .run_args(dir, &["show", &spec], RunOptions::lenient())
            .await?;
        Ok((result.exit_code == 0).then_some(result.stdout))
    }

    pub async fn has_upstream(&self, dir: &Path) -> AppResult<bool> {
        let result = self
            .run_args(
                dir,
                &[
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ],
                RunOptions::lenient(),
            )
            .await?;
        Ok(result.exit_code == 0)
    }

    pub async fn fetch_origin(&self, dir: &Path) -> AppResult<()> {
        self.run_args(dir, &["fetch", "--prune", "origin"], RunOptions::network())
            .await?;
        Ok(())
    }

    pub async fn remote_branch_exists(&self, dir: &Path, branch: &str) -> AppResult<bool> {
        let reference = format!("refs/remotes/origin/{branch}");
        let result = self
            .run_args(
                dir,
                &["rev-parse", "--verify", "-q", &reference],
                RunOptions::lenient(),
            )
            .await?;
        Ok(result.exit_code == 0)
    }

    pub async fn commits_behind(&self, dir: &Path, reference: &str) -> AppResult<u64> {
        let range = format!("HEAD..{reference}");
        Ok(self
            .count(dir, &["rev-list", "--count", &range])
            .await?
            .unwrap_or(0))
    }

    pub async fn merge_ref(&self, dir: &Path, reference: &str) -> AppResult<()> {
        let mut args = self.commit_identity(dir).await?;
        args.extend(strings(&["merge", "--no-edit", reference]));
        let result = self.run(dir, &args, RunOptions::lenient()).await?;
        if result.exit_code == 0 {
            return Ok(());
        }
        self.run_args(dir, &["merge", "--abort"], RunOptions::lenient())
            .await?;
        let output = format!("{}\n{}", result.stdout, result.stderr);
        Err(git_failure(classify_git_error(&output), output.trim()))
    }

    pub async fn push_branch(&self, dir: &Path, branch: &str) -> AppResult<()> {
        let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
        self.run_args(
            dir,
            &["push", "--set-upstream", "origin", &refspec],
            RunOptions::network(),
        )
        .await?;
        Ok(())
    }

    pub async fn has_commits(&self, dir: &Path) -> AppResult<bool> {
        let result = self
            .run_args(
                dir,
                &["rev-parse", "--verify", "-q", "HEAD"],
                RunOptions::lenient(),
            )
            .await?;
        Ok(result.exit_code == 0)
    }

    pub async fn add_remote(&self, dir: &Path, url: &str) -> AppResult<()> {
        self.run_args(
            dir,
            &["remote", "add", "origin", url],
            RunOptions::default(),
        )
        .await?;
        Ok(())
    }

    pub async fn remove_remote(&self, dir: &Path) -> AppResult<()> {
        self.run_args(dir, &["remote", "remove", "origin"], RunOptions::lenient())
            .await?;
        Ok(())
    }

    pub async fn branch_refs(&self, dir: &Path) -> AppResult<BranchRefs> {
        let result = self
            .run_args(
                dir,
                &[
                    "for-each-ref",
                    "--format=%(refname)",
                    "refs/heads",
                    "refs/remotes/origin",
                ],
                RunOptions::lenient(),
            )
            .await?;
        if result.exit_code != 0 {
            return Ok(BranchRefs::default());
        }
        Ok(parse_branch_refs(&result.stdout))
    }

    pub async fn is_valid_branch_name(&self, dir: &Path, name: &str) -> AppResult<bool> {
        let result = self
            .run_args(
                dir,
                &["check-ref-format", "--branch", name],
                RunOptions::lenient(),
            )
            .await?;
        Ok(result.exit_code == 0)
    }

    pub async fn switch_branch(&self, dir: &Path, branch: &str) -> AppResult<()> {
        self.run_args(dir, &["switch", "--no-guess", branch], RunOptions::default())
            .await?;
        Ok(())
    }

    pub async fn switch_tracking_branch(&self, dir: &Path, branch: &str) -> AppResult<()> {
        let upstream = format!("origin/{branch}");
        self.run_args(
            dir,
            &["switch", "--create", branch, "--track", &upstream],
            RunOptions::default(),
        )
        .await?;
        Ok(())
    }

    pub async fn create_branch(&self, dir: &Path, branch: &str) -> AppResult<()> {
        self.run_args(dir, &["switch", "--create", branch], RunOptions::default())
            .await?;
        Ok(())
    }

    pub async fn push_new_branch(&self, dir: &Path, branch: &str) -> AppResult<()> {
        let reference = format!("refs/heads/{branch}");
        self.run_args(
            dir,
            &["push", "--set-upstream", "origin", &reference],
            RunOptions::network(),
        )
        .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn branch_refs_split_local_and_remote_only() {
        let refs = parse_branch_refs(
            "refs/heads/main
refs/heads/feat/a
refs/remotes/origin/HEAD
refs/remotes/origin/main
refs/remotes/origin/release
",
        );
        assert_eq!(refs.local, vec!["feat/a", "main"]);
        assert_eq!(refs.remote, vec!["release"]);
    }

    #[test]
    fn clone_urls() {
        assert_eq!(
            normalize_clone_url("acme/payments").as_deref(),
            Some("https://github.com/acme/payments.git")
        );
        assert_eq!(
            normalize_clone_url("https://github.com/acme/payments/").as_deref(),
            Some("https://github.com/acme/payments.git")
        );
        assert_eq!(
            normalize_clone_url("github.com/acme/payments.git").as_deref(),
            Some("https://github.com/acme/payments.git")
        );
        assert_eq!(
            normalize_clone_url("git@gitlab.com:team/api.git").as_deref(),
            Some("git@gitlab.com:team/api.git")
        );
        assert_eq!(
            normalize_clone_url("https://gitlab.com/team/api").as_deref(),
            Some("https://gitlab.com/team/api")
        );
        assert_eq!(normalize_clone_url("file:///tmp/repo"), None);
        assert_eq!(normalize_clone_url("not a url"), None);
    }

    #[test]
    fn github_remotes() {
        let expected = Some(GithubRef {
            owner: "acme".into(),
            repo: "api".into(),
        });
        assert_eq!(
            parse_github_remote("https://github.com/acme/api.git"),
            expected
        );
        assert_eq!(parse_github_remote("git@github.com:acme/api.git"), expected);
        assert_eq!(
            parse_github_remote("ssh://git@github.com/acme/api"),
            expected
        );
        assert_eq!(parse_github_remote("https://gitlab.com/acme/api"), None);
        assert!(same_remote(
            "https://github.com/Acme/API.git",
            "git@github.com:acme/api"
        ));
        assert!(same_remote(
            "https://gitlab.com/a/b.git",
            "https://gitlab.com/a/b/"
        ));
        assert_eq!(repo_name_from_url("https://github.com/acme/api.git"), "api");
        assert_eq!(repo_name_from_url("git@host:team/tool.git/"), "tool");
    }

    #[test]
    fn classifies_errors() {
        assert_eq!(
            classify_git_error("fatal: not a git repository"),
            "not_a_repository"
        );
        assert_eq!(
            classify_git_error(" ! [rejected] main -> main (fetch first)"),
            "push_rejected"
        );
        assert_eq!(
            classify_git_error("error: Your local changes would be overwritten by merge"),
            "local_changes"
        );
        assert_eq!(
            classify_git_error("Automatic merge failed; fix conflicts"),
            "merge_conflict"
        );
        assert_eq!(
            classify_git_error("remote: Repository not found."),
            "repository_not_found"
        );
        assert_eq!(
            classify_git_error("fatal: Authentication failed"),
            "auth_failed"
        );
        assert_eq!(
            classify_git_error("Could not resolve host: github.com"),
            "network"
        );
        assert_eq!(
            classify_git_error("Unable to create '.git/index.lock'"),
            "locked"
        );
        assert_eq!(classify_git_error("something else"), "git_failed");
    }

    #[test]
    fn status_parsing() {
        let entries = parse_status("?? a.json\0R  new.json\0old.json\0 M b.json\0");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[1].path, "new.json");
        assert_eq!(entries[1].old_path.as_deref(), Some("old.json"));
        assert_eq!(
            changed_paths(&entries),
            vec!["a.json", "new.json", "old.json", "b.json"]
        );
    }

    #[test]
    fn versions() {
        assert_eq!(parse_version("git version 2.43.0\n"), Some((2, 43, 0)));
        assert_eq!(
            parse_version("git version 2.39.3 (Apple Git-146)"),
            Some((2, 39, 3))
        );
        assert_eq!(parse_version("nope"), None);
    }

    #[test]
    fn failure_message_is_last_line() {
        let failure = git_failure("network", "fatal: one\nfatal: two\n");
        assert_eq!(failure.message.as_deref(), Some("fatal: two"));
    }
}
