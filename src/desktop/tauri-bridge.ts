import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AurolisBridge } from "@/aurolis-bridge";
import type {
  GithubAuthStatus,
  GithubDeviceFlowStart,
  GithubSignInResult,
} from "@/types/auth/auth-response.type";
import type { EngineResult } from "@/types/engine/engine.type";
import type {
  LoadSnapshot,
  LoadStartParams,
} from "@/types/engine/load-engine.type";
import type { RealtimeEvent } from "@/types/engine/realtime-engine.type";
import type { SavedExportFile } from "@/types/transfer/transfer.type";
import type { WorkspaceResult } from "@/types/workspace/workspace-store.type";
import * as collections from "./collection-store";
import { graphqlLoadRequest, introspectGraphql, sendGraphql } from "./graphql";
import { call, plain, run } from "./invoke";
import {
  asEngineResult,
  asWorkspaceResult,
  type Outcome,
  unwrap,
} from "./results";
import { listChanges } from "./source-control";
import {
  createWorkspace,
  initializeWorkspace,
  openWorkspace,
} from "./workspace-data";

const WORKSPACE_CHANGED_EVENT = "aurolis:workspace-changed";
const REALTIME_EVENT = "aurolis:realtime-event";
const LOAD_EVENT = "aurolis:load-event";

function subscribe<T>(event: string, callback: (payload: T) => void) {
  let unlisten: UnlistenFn | null = null;
  let active = true;
  void listen<T>(event, (message) => callback(message.payload)).then((stop) => {
    if (active) unlisten = stop;
    else stop();
  });
  return () => {
    active = false;
    unlisten?.();
  };
}

function detectPlatform() {
  const injected = window.__AUROLIS_PLATFORM__;
  if (injected) return injected;
  const agent = navigator.userAgent;
  if (/Macintosh|Mac OS X/i.test(agent)) return "darwin";
  if (/Windows/i.test(agent)) return "win32";
  return "linux";
}

function startLoad(params: LoadStartParams): Promise<EngineResult<void>> {
  return asEngineResult(async () => {
    const { target, ...rest } = params;
    const request =
      target.kind === "graphql"
        ? graphqlLoadRequest(target, params.runId)
        : {
            runId: params.runId,
            method: target.method,
            url: target.url,
            headers: target.headers,
            body: target.body,
            timeoutMs: target.timeoutMs,
          };
    unwrap(
      await call<Outcome<null>>("engine_load_start", {
        params: { ...rest, request },
      }),
    );
  });
}

async function saveFile(
  name: string,
  bytes: Uint8Array,
): Promise<WorkspaceResult<SavedExportFile>> {
  try {
    return await invoke<WorkspaceResult<SavedExportFile>>(
      "transfer_save_file",
      bytes,
      {
        headers: { "x-file-name": encodeURIComponent(name) },
      },
    );
  } catch (error) {
    return { ok: false, error: { code: "unknown", message: String(error) } };
  }
}

export function createTauriBridge(): AurolisBridge {
  const bridge: AurolisBridge = {
    platform: detectPlatform(),
    setTheme: (theme) => {
      void getCurrentWindow()
        .setTheme(theme === "system" ? null : theme)
        .catch(() => undefined);
    },
    github: {
      startSignIn: () => plain<GithubDeviceFlowStart>("github_start"),
      waitForSignIn: () => plain<GithubSignInResult>("github_wait"),
      cancelSignIn: () => plain<void>("github_cancel"),
      getStatus: () => plain<GithubAuthStatus>("github_status"),
      signOut: () => plain<void>("github_sign_out"),
      installations: () => call("github_installations"),
      openInstallPage: () => plain<void>("github_install_page"),
      repositories: () => call("github_repositories"),
      createRepository: (params) =>
        call("github_create_repository", { params }),
      emptyRepository: (params) => call("github_empty_repository", { params }),
    },
    workspace: {
      list: () => call("workspace_list"),
      gitInfo: () => call("workspace_git_info"),
      checkDefaultStorage: () => call("workspace_storage_check_default"),
      chooseStorage: () => call("workspace_storage_choose"),
      setStorage: (choice) => call("workspace_storage_set", { choice }),
      create: (params) => asWorkspaceResult(() => createWorkspace(params.name)),
      clone: (params) => call("workspace_clone", { url: params.url }),
      cancelClone: () => call("workspace_clone_cancel"),
      openFolder: () => call("workspace_open_folder"),
      open: (id) => asWorkspaceResult(() => openWorkspace(id)),
      initialize: (id) => asWorkspaceResult(() => initializeWorkspace(id)),
      rename: (params) =>
        call("workspace_rename", { id: params.id, name: params.name }),
      publish: (params) => call("workspace_publish", { params }),
      stopSync: (id) =>
        asWorkspaceResult(async () => {
          await run<null>("workspace_stop_sync", { id });
          return openWorkspace(id);
        }),
      removeCheck: (id) => call("workspace_remove_check", { id }),
      reveal: (id) => call("workspace_reveal", { id }),
      remove: (params) =>
        call("workspace_remove", {
          id: params.id,
          deleteFolder: params.deleteFolder,
        }),
      onChanged: (callback) =>
        subscribe<string>(WORKSPACE_CHANGED_EVENT, callback),
    },
    collection: {
      apply: (params) =>
        asWorkspaceResult(() => collections.applyOperation(params)),
      move: (params) =>
        asWorkspaceResult(() => collections.moveCollection(params)),
      loadEditorState: (id) =>
        asWorkspaceResult(() => collections.loadEditorState(id)),
      saveDrafts: (params) =>
        asWorkspaceResult(() => collections.saveDrafts(params)),
      saveUiState: (params) =>
        asWorkspaceResult(() => collections.saveUiState(params)),
    },
    sourceControl: {
      changes: (id) => asWorkspaceResult(() => listChanges(id)),
      commit: (params) => call("source_control_commit", { params }),
      pull: (id) => call("source_control_pull", { id }),
    },
    transfer: {
      saveFile: (params) => saveFile(params.name, params.bytes),
    },
    engine: {
      sendHttp: (params) => call("engine_http_send", { params }),
      sendGraphql: (params) => sendGraphql(params),
      introspectGraphql: (params) => introspectGraphql(params),
      cancel: (runId) => call("engine_cancel", { runId }),
      connectRealtime: (params) => call("engine_realtime_connect", { params }),
      sendRealtime: (params) => call("engine_realtime_send", { params }),
      disconnectRealtime: (id) => call("engine_realtime_disconnect", { id }),
      onRealtimeEvent: (callback) =>
        subscribe<RealtimeEvent>(REALTIME_EVENT, callback),
      startLoad: (params) => startLoad(params),
      stopLoad: (runId) => call("engine_load_stop", { runId }),
      onLoadEvent: (callback) => subscribe<LoadSnapshot>(LOAD_EVENT, callback),
    },
  };
  return bridge;
}
