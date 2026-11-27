use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::assistants::ASSISTANT_PATHSPECS;
use crate::outcome::{AppResult, Failure, invalid};
use crate::paths::{is_inside, to_posix, write_atomic};

pub const MANIFEST_PATH: &str = "aurolis.json";
pub const COLLECTIONS_DIR: &str = "collections";
pub const ENVIRONMENTS_DIR: &str = "environments";
pub const AREAS: [&str; 2] = [COLLECTIONS_DIR, ENVIRONMENTS_DIR];
pub const WORKSPACE_PATHS: [&str; 3] = [MANIFEST_PATH, COLLECTIONS_DIR, ENVIRONMENTS_DIR];

const MAX_FILE_BYTES: u64 = 5 * 1024 * 1024;
const MAX_STATE_BYTES: usize = 5 * 1024 * 1024;
const MAX_MANIFEST_BYTES: usize = 1024 * 1024;
const MAX_CHANGES: usize = 5_000;
const MAX_PATH_LENGTH: usize = 400;

#[derive(Debug, Default, Serialize)]
pub struct WorkspaceFiles {
    pub files: BTreeMap<String, String>,
    pub oversized: Vec<String>,
}

fn walk(root: &Path, dir: &Path, result: &mut WorkspaceFiles) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        let path = entry.path();
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            walk(root, &path, result);
        } else if kind.is_file() {
            read_one(root, &path, result);
        }
    }
}

fn read_one(root: &Path, file: &Path, result: &mut WorkspaceFiles) {
    let Ok(metadata) = std::fs::symlink_metadata(file) else {
        return;
    };
    if !metadata.is_file() {
        return;
    }
    let relative = to_posix(file.strip_prefix(root).unwrap_or(file));
    if metadata.len() > MAX_FILE_BYTES {
        result.oversized.push(relative);
        return;
    }
    if let Ok(bytes) = std::fs::read(file) {
        result
            .files
            .insert(relative, String::from_utf8_lossy(&bytes).into_owned());
    }
}

pub async fn read_workspace_files(root: PathBuf) -> WorkspaceFiles {
    tokio::task::spawn_blocking(move || {
        let mut result = WorkspaceFiles::default();
        let manifest = root.join(MANIFEST_PATH);
        if manifest.exists() {
            read_one(&root, &manifest, &mut result);
        }
        for area in AREAS {
            walk(&root, &root.join(area), &mut result);
        }
        result
    })
    .await
    .unwrap_or_default()
}

pub fn workspace_pathspecs(root: &str) -> Vec<String> {
    WORKSPACE_PATHS
        .iter()
        .map(|file| {
            if root.is_empty() {
                file.to_string()
            } else {
                format!("{root}/{file}")
            }
        })
        .chain(ASSISTANT_PATHSPECS.iter().map(|spec| spec.to_string()))
        .collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChanges {
    pub area: String,
    #[serde(default)]
    pub writes: BTreeMap<String, String>,
    #[serde(default)]
    pub deletes: Vec<String>,
    #[serde(default)]
    pub manifest: Option<String>,
}

fn check_relative(relative: &str, area: &str) -> AppResult<()> {
    let segments: Vec<&str> = relative.split('/').collect();
    let valid = relative.len() <= MAX_PATH_LENGTH
        && !relative.contains('\\')
        && !relative.contains('\0')
        && !relative.contains(':')
        && segments.len() >= 2
        && segments[0] == area
        && segments
            .iter()
            .all(|segment| !segment.is_empty() && *segment != "." && *segment != "..")
        && relative.ends_with(".json");
    if valid {
        Ok(())
    } else {
        Err(invalid(format!("Refused to touch {relative}.")))
    }
}

fn resolve_inside(root: &Path, area: &str, relative: &str) -> AppResult<PathBuf> {
    check_relative(relative, area)?;
    let mut absolute = root.to_path_buf();
    for segment in relative.split('/') {
        absolute.push(segment);
    }
    let area_dir = root.join(area);
    if !is_inside(&absolute, &area_dir) || absolute == area_dir {
        return Err(invalid(format!("Refused to touch {relative}.")));
    }
    Ok(absolute)
}

fn validate(changes: &FileChanges) -> AppResult<()> {
    if !AREAS.contains(&changes.area.as_str()) {
        return Err(invalid("Unknown workspace area."));
    }
    if changes.writes.len() + changes.deletes.len() > MAX_CHANGES {
        return Err(invalid("Too many changes at once."));
    }
    if changes
        .writes
        .values()
        .any(|content| content.len() as u64 > MAX_FILE_BYTES)
    {
        return Err(Failure::new("invalid_input", "A file is larger than 5 MB."));
    }
    if let Some(manifest) = &changes.manifest
        && (manifest.len() > MAX_MANIFEST_BYTES
            || !serde_json::from_str::<serde_json::Value>(manifest)
                .is_ok_and(|value| value.is_object()))
    {
        return Err(invalid("The workspace manifest isn't valid."));
    }
    Ok(())
}

fn remove_empty_parents(file: &Path, area_dir: &Path) {
    let mut dir = file.parent().map(Path::to_path_buf);
    while let Some(current) = dir {
        if !is_inside(&current, area_dir) || current == area_dir {
            return;
        }
        let empty = std::fs::read_dir(&current)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);
        if !empty || std::fs::remove_dir(&current).is_err() {
            return;
        }
        dir = current.parent().map(Path::to_path_buf);
    }
}

pub async fn apply_changes(root: &Path, changes: FileChanges) -> AppResult<()> {
    validate(&changes)?;
    let area = changes.area.as_str();
    let mut writes = Vec::with_capacity(changes.writes.len());
    for (relative, content) in &changes.writes {
        writes.push((resolve_inside(root, area, relative)?, content));
    }
    let mut deletes = Vec::with_capacity(changes.deletes.len());
    for relative in &changes.deletes {
        deletes.push(resolve_inside(root, area, relative)?);
    }
    if let Some(manifest) = &changes.manifest {
        write_atomic(&root.join(MANIFEST_PATH), manifest.as_bytes()).await?;
    }
    for (file, content) in writes {
        write_atomic(&file, content.as_bytes()).await?;
    }
    for file in &deletes {
        match tokio::fs::remove_file(file).await {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    let area_dir = root.join(area);
    for file in &deletes {
        remove_empty_parents(file, &area_dir);
    }
    Ok(())
}

pub fn state_file_name(name: &str) -> AppResult<&'static str> {
    match name {
        "drafts" => Ok("drafts.json"),
        "ui" => Ok("ui.json"),
        _ => Err(invalid("Unknown editor state.")),
    }
}

pub async fn read_state(file: &Path) -> Option<String> {
    let content = tokio::fs::read_to_string(file).await.ok()?;
    (content.len() <= MAX_STATE_BYTES).then_some(content)
}

pub async fn write_state(file: &Path, content: &str) -> AppResult<()> {
    if content.len() > MAX_STATE_BYTES {
        return Err(invalid("Too many unsaved changes."));
    }
    write_atomic(file, content.as_bytes()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_paths_stay_in_their_area() {
        assert!(check_relative("collections/payments/_collection.json", "collections").is_ok());
        assert!(check_relative("collections/a.req.json", "collections").is_ok());
        assert!(check_relative("environments/prod.env.json", "collections").is_err());
        assert!(check_relative("collections/../aurolis.json", "collections").is_err());
        assert!(check_relative("collections//a.json", "collections").is_err());
        assert!(check_relative("collections/a.txt", "collections").is_err());
        assert!(check_relative("collections", "collections").is_err());
        assert!(check_relative("collections/a\\b.json", "collections").is_err());
        assert!(check_relative("collections/C:/x.json", "collections").is_err());
    }

    #[tokio::test]
    async fn writes_deletes_and_prunes() {
        let root = std::env::temp_dir().join(format!("aurolis-files-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(root.join("collections/payments")).unwrap();
        std::fs::write(root.join("collections/payments/old.req.json"), "{}").unwrap();
        let mut writes = BTreeMap::new();
        writes.insert(
            "collections/new/_collection.json".to_string(),
            "{\"a\":1}".to_string(),
        );
        apply_changes(
            &root,
            FileChanges {
                area: "collections".into(),
                writes,
                deletes: vec!["collections/payments/old.req.json".into()],
                manifest: Some("{\"format\":1}".into()),
            },
        )
        .await
        .unwrap();
        assert!(root.join("collections/new/_collection.json").exists());
        assert!(!root.join("collections/payments").exists());
        assert!(root.join("collections").exists());
        assert_eq!(
            std::fs::read_to_string(root.join("aurolis.json")).unwrap(),
            "{\"format\":1}"
        );
        let files = read_workspace_files(root.clone()).await;
        assert_eq!(
            files.files.keys().cloned().collect::<Vec<_>>(),
            vec!["aurolis.json", "collections/new/_collection.json"]
        );
        let refused = apply_changes(
            &root,
            FileChanges {
                area: "collections".into(),
                writes: BTreeMap::new(),
                deletes: vec!["environments/x.env.json".into()],
                manifest: None,
            },
        )
        .await;
        assert!(refused.is_err());
        let bad_manifest = apply_changes(
            &root,
            FileChanges {
                area: "collections".into(),
                writes: BTreeMap::new(),
                deletes: vec![],
                manifest: Some("[]".into()),
            },
        )
        .await;
        assert!(bad_manifest.is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
