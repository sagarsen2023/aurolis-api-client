use std::path::Path;

const PUBLIC_VARIABLES: [&str; 2] = [
    "VITE_PUBLIC_GITHUB_CLIENT_ID",
    "VITE_PUBLIC_GITHUB_APP_SLUG",
];

fn from_env_files(name: &str) -> Option<String> {
    for file in ["../.env.local", "../.env"] {
        println!("cargo:rerun-if-changed={file}");
        let Ok(content) = std::fs::read_to_string(Path::new(file)) else {
            continue;
        };
        for line in content.lines() {
            let Some((key, value)) = line.split_once('=') else {
                continue;
            };
            if key.trim() == name {
                let value = value.trim().trim_matches('"').trim_matches('\'');
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

fn main() {
    for name in PUBLIC_VARIABLES {
        println!("cargo:rerun-if-env-changed={name}");
        let value = std::env::var(name)
            .ok()
            .filter(|value| !value.is_empty())
            .or_else(|| from_env_files(name));
        if let Some(value) = value {
            println!("cargo:rustc-env={name}={value}");
        }
    }
    tauri_build::build();
}
