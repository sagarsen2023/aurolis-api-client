use tauri::{AppHandle, State};

use crate::engines::http::{HttpResponseData, HttpSendParams};
use crate::engines::realtime::{ConnectParams, SendParams};
use crate::files::{
    FileChanges, WorkspaceFiles, apply_changes, read_state, read_workspace_files, state_file_name,
    write_state,
};
use crate::git::GitInfo;
use crate::github::auth::{AuthStatus, FlowStart, SignIn};
use crate::github::sync::{self, Installation, Repository, RepositoryName};
use crate::outcome::{AppResult, Failure, Outcome, invalid};
use crate::secrets::WorkspaceSecrets;
use crate::source_control::{self, ChangesRaw, CommitParams, CommitResult, PullResult};
use crate::state::AppState;
use crate::transfer::{SavedExportFile, save_export_file};
use crate::workspace::{
    self, CloneResult, CreateParams, OpenedRaw, PublishParams, PublishResult, RegistryView,
    RemoveCheck, StorageFolderCheck,
};

type Reply<T> = Result<Outcome<T>, String>;

fn reply<T>(result: AppResult<T>) -> Reply<T> {
    Ok(Outcome(result))
}

#[tauri::command]
pub async fn github_start(state: State<'_, AppState>) -> Result<FlowStart, String> {
    Ok(state.auth.start_device_flow().await)
}

#[tauri::command]
pub async fn github_wait(state: State<'_, AppState>) -> Result<SignIn, String> {
    Ok(state.auth.wait_for_authorization().await)
}

#[tauri::command]
pub async fn github_cancel(state: State<'_, AppState>) -> Result<(), String> {
    state.auth.cancel_device_flow().await;
    Ok(())
}

#[tauri::command]
pub async fn github_status(state: State<'_, AppState>) -> Result<AuthStatus, String> {
    Ok(state.auth.status().await)
}

#[tauri::command]
pub async fn github_sign_out(state: State<'_, AppState>) -> Result<(), String> {
    state.auth.sign_out().await;
    Ok(())
}

#[tauri::command]
pub async fn github_installations(state: State<'_, AppState>) -> Reply<Vec<Installation>> {
    reply(sync::installations(&state.github).await)
}

#[tauri::command]
pub async fn github_install_page() -> Result<(), String> {
    let _ = tauri_plugin_opener::open_url(sync::install_page_url(), None::<&str>);
    Ok(())
}

#[tauri::command]
pub async fn github_repositories(state: State<'_, AppState>) -> Reply<Vec<Repository>> {
    reply(sync::repositories(&state.github).await)
}

#[tauri::command]
pub async fn github_create_repository(
    state: State<'_, AppState>,
    params: RepositoryName,
) -> Reply<Repository> {
    reply(sync::create_repository(&state.github, &state.auth, params).await)
}

#[tauri::command]
pub async fn github_empty_repository(
    state: State<'_, AppState>,
    params: RepositoryName,
) -> Reply<Repository> {
    reply(sync::empty_repository(&state.github, params).await)
}

#[tauri::command]
pub async fn workspace_list(state: State<'_, AppState>) -> Reply<RegistryView> {
    reply(workspace::list(&state).await)
}

#[tauri::command]
pub async fn workspace_git_info(state: State<'_, AppState>) -> Reply<GitInfo> {
    reply(state.git.info().await)
}

#[tauri::command]
pub async fn workspace_storage_check_default(
    state: State<'_, AppState>,
) -> Reply<StorageFolderCheck> {
    reply(Ok(workspace::check_storage_folder(
        &state,
        &state.paths.default_storage_folder(),
    )))
}

#[tauri::command]
pub async fn workspace_storage_choose(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Reply<Option<StorageFolderCheck>> {
    reply(workspace::choose_storage(&app, &state).await)
}

#[tauri::command]
pub async fn workspace_storage_set(
    state: State<'_, AppState>,
    choice: String,
) -> Reply<RegistryView> {
    reply(workspace::set_storage(&state, &choice).await)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Created {
    workspace_id: String,
}

#[tauri::command]
pub async fn workspace_create(state: State<'_, AppState>, params: CreateParams) -> Reply<Created> {
    reply(
        workspace::create(&state, params)
            .await
            .map(|workspace_id| Created { workspace_id }),
    )
}

#[tauri::command]
pub async fn workspace_clone(state: State<'_, AppState>, url: String) -> Reply<CloneResult> {
    reply(workspace::clone(&state, &url).await)
}

#[tauri::command]
pub async fn workspace_clone_cancel(state: State<'_, AppState>) -> Reply<()> {
    workspace::cancel_clones(&state);
    reply(Ok(()))
}

#[tauri::command]
pub async fn workspace_open_folder(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Reply<CloneResult> {
    reply(workspace::open_folder(&app, &state).await)
}

#[tauri::command]
pub async fn workspace_open(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Reply<OpenedRaw> {
    reply(workspace::open(&app, &state, &id).await)
}

#[tauri::command]
pub async fn workspace_initialize(
    state: State<'_, AppState>,
    id: String,
    manifest: String,
) -> Reply<()> {
    reply(workspace::initialize(&state, &id, &manifest).await)
}

#[tauri::command]
pub async fn workspace_rename(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Reply<RegistryView> {
    reply(workspace::rename(&state, &id, &name).await)
}

#[tauri::command]
pub async fn workspace_publish(
    state: State<'_, AppState>,
    params: PublishParams,
) -> Reply<PublishResult> {
    reply(workspace::publish(&state, params).await)
}

#[tauri::command]
pub async fn workspace_stop_sync(state: State<'_, AppState>, id: String) -> Reply<()> {
    reply(workspace::stop_sync(&state, &id).await)
}

#[tauri::command]
pub async fn workspace_remove_check(state: State<'_, AppState>, id: String) -> Reply<RemoveCheck> {
    reply(workspace::remove_check(&state, &id).await)
}

#[tauri::command]
pub async fn workspace_reveal(state: State<'_, AppState>, id: String) -> Reply<()> {
    reply(workspace::reveal(&state, &id).await)
}

#[tauri::command]
pub async fn workspace_remove(
    state: State<'_, AppState>,
    id: String,
    delete_folder: bool,
) -> Reply<RegistryView> {
    reply(workspace::remove(&state, &id, delete_folder).await)
}

async fn existing_root(state: &AppState, id: &str) -> AppResult<std::path::PathBuf> {
    let entry = workspace::find_entry(state, id).await?;
    if !entry.repo_path().exists() {
        return Err(Failure::code("missing_folder"));
    }
    Ok(entry.root_path())
}

#[tauri::command]
pub async fn workspace_read_files(state: State<'_, AppState>, id: String) -> Reply<WorkspaceFiles> {
    let result = async {
        let root = existing_root(&state, &id).await?;
        Ok(read_workspace_files(root).await)
    }
    .await;
    reply(result)
}

#[tauri::command]
pub async fn workspace_write_files(
    state: State<'_, AppState>,
    id: String,
    changes: FileChanges,
) -> Reply<()> {
    let result = async {
        let root = existing_root(&state, &id).await?;
        apply_changes(&root, changes).await
    }
    .await;
    reply(result)
}

#[tauri::command]
pub async fn workspace_state_read(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Reply<Option<String>> {
    let result = async {
        let file_name = state_file_name(&name)?;
        let entry = workspace::find_entry(&state, &id).await?;
        Ok(read_state(&state.paths.state_file(&entry.id, file_name)).await)
    }
    .await;
    reply(result)
}

#[tauri::command]
pub async fn workspace_state_write(
    state: State<'_, AppState>,
    id: String,
    name: String,
    content: String,
) -> Reply<()> {
    let result = async {
        let file_name = state_file_name(&name)?;
        let entry = workspace::find_entry(&state, &id).await?;
        write_state(&state.paths.state_file(&entry.id, file_name), &content).await
    }
    .await;
    reply(result)
}

#[tauri::command]
pub async fn secrets_get(
    state: State<'_, AppState>,
    workspace_id: String,
) -> Reply<WorkspaceSecrets> {
    let result = async {
        workspace::find_entry(&state, &workspace_id).await?;
        Ok(state.secrets.get(&workspace_id).await)
    }
    .await;
    reply(result)
}

#[tauri::command]
pub async fn secrets_update(
    state: State<'_, AppState>,
    workspace_id: String,
    set: WorkspaceSecrets,
    remove: Vec<String>,
) -> Reply<()> {
    let result = async {
        workspace::find_entry(&state, &workspace_id).await?;
        state.secrets.update(&workspace_id, set, remove).await
    }
    .await;
    reply(result)
}

#[tauri::command]
pub async fn source_control_changes(state: State<'_, AppState>, id: String) -> Reply<ChangesRaw> {
    reply(source_control::changes(&state, &id).await)
}

#[tauri::command]
pub async fn source_control_commit(
    state: State<'_, AppState>,
    params: CommitParams,
) -> Reply<CommitResult> {
    reply(source_control::commit(&state, params).await)
}

#[tauri::command]
pub async fn source_control_pull(state: State<'_, AppState>, id: String) -> Reply<PullResult> {
    reply(source_control::pull(&state, &id).await)
}

#[tauri::command]
pub async fn transfer_save_file(
    app: AppHandle,
    state: State<'_, AppState>,
    request: tauri::ipc::Request<'_>,
) -> Reply<SavedExportFile> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return reply(Err(invalid("Expected the file's bytes.")));
    };
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            percent_encoding::percent_decode_str(value)
                .decode_utf8_lossy()
                .into_owned()
        })
        .unwrap_or_default();
    reply(save_export_file(&app, &state, &name, bytes).await)
}

#[tauri::command]
pub async fn engine_http_send(
    state: State<'_, AppState>,
    params: HttpSendParams,
) -> Reply<HttpResponseData> {
    reply(state.http.execute(params, true).await)
}

#[tauri::command]
pub async fn engine_http_send_untracked(
    state: State<'_, AppState>,
    params: HttpSendParams,
) -> Reply<HttpResponseData> {
    reply(state.http.execute(params, false).await)
}

#[tauri::command]
pub async fn engine_cancel(state: State<'_, AppState>, run_id: String) -> Reply<()> {
    reply(state.http.cancel(&run_id))
}

#[tauri::command]
pub async fn engine_realtime_connect(
    app: AppHandle,
    state: State<'_, AppState>,
    params: ConnectParams,
) -> Reply<()> {
    reply(state.realtime.connect(app, params).await)
}

#[tauri::command]
pub async fn engine_realtime_send(
    app: AppHandle,
    state: State<'_, AppState>,
    params: SendParams,
) -> Reply<()> {
    reply(state.realtime.send(&app, params))
}

#[tauri::command]
pub async fn engine_realtime_disconnect(state: State<'_, AppState>, id: String) -> Reply<()> {
    reply(state.realtime.disconnect(&id))
}
