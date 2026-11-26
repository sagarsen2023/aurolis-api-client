use std::path::{Component, Path, PathBuf};

use crate::outcome::AppResult;

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub user_data: PathBuf,
    pub home: PathBuf,
    pub downloads: Option<PathBuf>,
}

impl AppPaths {
    pub fn registry_file(&self) -> PathBuf {
        self.user_data.join("workspaces.json")
    }

    pub fn state_dir(&self, workspace_id: &str) -> PathBuf {
        self.user_data.join("workspaces").join(workspace_id)
    }

    pub fn state_file(&self, workspace_id: &str, name: &str) -> PathBuf {
        self.state_dir(workspace_id).join("state").join(name)
    }

    pub fn session_file(&self) -> PathBuf {
        self.user_data.join("github-session.bin")
    }

    pub fn default_storage_folder(&self) -> PathBuf {
        self.home.join("Aurolis")
    }

    pub fn display(&self, target: &Path) -> String {
        if cfg!(windows) {
            return target.display().to_string();
        }
        match target.strip_prefix(&self.home) {
            Ok(rest) if is_inside(target, &self.home) => {
                let rest = rest.display().to_string();
                if rest.is_empty() {
                    "~".to_string()
                } else {
                    format!("~/{rest}")
                }
            }
            _ => target.display().to_string(),
        }
    }
}

pub fn normalize(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !result.pop() {
                    result.push(component);
                }
            }
            other => result.push(other),
        }
    }
    result
}

pub fn resolve(path: &Path) -> PathBuf {
    if path.is_absolute() {
        return normalize(path);
    }
    let base = std::env::current_dir().unwrap_or_default();
    normalize(&base.join(path))
}

pub fn is_inside(child: &Path, parent: &Path) -> bool {
    normalize(child).starts_with(normalize(parent))
}

pub fn to_posix(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

pub async fn write_atomic(file: &Path, content: &[u8]) -> AppResult<()> {
    if let Some(parent) = file.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let name = file
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let temp = file.with_file_name(format!(
        ".{name}.{}.{}.tmp",
        std::process::id(),
        uuid::Uuid::new_v4().simple()
    ));
    tokio::fs::write(&temp, content).await?;
    if let Err(error) = tokio::fs::rename(&temp, file).await {
        let _ = tokio::fs::remove_file(&temp).await;
        return Err(error.into());
    }
    Ok(())
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inside_checks_are_lexical() {
        assert!(is_inside(Path::new("/a/b/c"), Path::new("/a/b")));
        assert!(is_inside(Path::new("/a/b"), Path::new("/a/b")));
        assert!(!is_inside(Path::new("/a/bc"), Path::new("/a/b")));
        assert!(!is_inside(Path::new("/a/b/../c"), Path::new("/a/b")));
    }

    #[test]
    fn posix_paths() {
        assert_eq!(to_posix(Path::new("a/b/c.json")), "a/b/c.json");
        assert_eq!(to_posix(Path::new("")), "");
    }

    #[test]
    fn display_uses_tilde() {
        let paths = AppPaths {
            user_data: PathBuf::from("/data"),
            home: PathBuf::from("/home/me"),
            downloads: None,
        };
        if !cfg!(windows) {
            assert_eq!(paths.display(Path::new("/home/me/Aurolis")), "~/Aurolis");
            assert_eq!(paths.display(Path::new("/home/me")), "~");
            assert_eq!(paths.display(Path::new("/home/meow")), "/home/meow");
        }
    }
}
