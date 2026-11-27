use std::collections::BTreeMap;
use std::path::Path;

use crate::outcome::{AppResult, Failure, invalid};
use crate::paths::write_atomic;
use crate::state::AppState;
use crate::workspace::find_entry;

pub const SKILL_DIR: &str = ".claude/skills/aurolis-workspace";
pub const CURSOR_RULE: &str = ".cursor/rules/aurolis-workspace.mdc";
pub const ASSISTANT_FILES: [&str; 4] = [
    ".claude/skills/aurolis-workspace/SKILL.md",
    ".claude/skills/aurolis-workspace/reference.md",
    ".claude/skills/aurolis-workspace/workspace-map.md",
    CURSOR_RULE,
];
pub const ASSISTANT_PATHSPECS: [&str; 2] = [SKILL_DIR, CURSOR_RULE];
const MAX_FILE_BYTES: usize = 512 * 1024;

fn absolute(repo: &Path, relative: &str) -> std::path::PathBuf {
    relative
        .split('/')
        .fold(repo.to_path_buf(), |path, part| path.join(part))
}

pub fn check_files(files: &BTreeMap<String, String>) -> AppResult<()> {
    if files.is_empty() {
        return Err(invalid("Nothing to write."));
    }
    for (path, content) in files {
        if !ASSISTANT_FILES.contains(&path.as_str()) {
            return Err(invalid("Aurolis only writes its own assistant files."));
        }
        if content.len() > MAX_FILE_BYTES {
            return Err(invalid("An assistant file is too large."));
        }
    }
    Ok(())
}

async fn repo_dir(state: &AppState, workspace_id: &str) -> AppResult<std::path::PathBuf> {
    let entry = find_entry(state, workspace_id).await?;
    let dir = entry.repo_path().to_path_buf();
    if dir.exists() {
        Ok(dir)
    } else {
        Err(Failure::code("missing_folder"))
    }
}

pub async fn installed(state: &AppState, workspace_id: &str) -> AppResult<Vec<String>> {
    let dir = repo_dir(state, workspace_id).await?;
    Ok(ASSISTANT_FILES
        .iter()
        .filter(|path| absolute(&dir, path).is_file())
        .map(|path| path.to_string())
        .collect())
}

pub async fn install(
    state: &AppState,
    workspace_id: &str,
    files: BTreeMap<String, String>,
) -> AppResult<Vec<String>> {
    check_files(&files)?;
    let dir = repo_dir(state, workspace_id).await?;
    for (path, content) in &files {
        write_atomic(&absolute(&dir, path), content.as_bytes()).await?;
    }
    Ok(files.into_keys().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_only_assistant_files() {
        let ok = BTreeMap::from([(ASSISTANT_FILES[0].to_string(), "x".to_string())]);
        assert!(check_files(&ok).is_ok());
        for bad in [
            "../outside.md",
            ".claude/settings.json",
            ".claude/skills/aurolis-workspace/../../settings.json",
            "collections/a.req.json",
        ] {
            let files = BTreeMap::from([(bad.to_string(), "x".to_string())]);
            assert!(check_files(&files).is_err(), "{bad}");
        }
        assert!(check_files(&BTreeMap::new()).is_err());
        let huge = BTreeMap::from([(
            ASSISTANT_FILES[1].to_string(),
            "x".repeat(MAX_FILE_BYTES + 1),
        )]);
        assert!(check_files(&huge).is_err());
    }

    #[test]
    fn pathspecs_cover_every_file() {
        for file in ASSISTANT_FILES {
            assert!(
                ASSISTANT_PATHSPECS
                    .iter()
                    .any(|spec| file == *spec || file.starts_with(&format!("{spec}/")))
            );
        }
    }
}
