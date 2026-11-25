import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const workspaceCall = (action: string, params?: unknown) =>
  ipcRenderer.invoke(`aurolis:workspace:${action}`, params);

const collectionCall = (action: string, params?: unknown) =>
  ipcRenderer.invoke(`aurolis:collection:${action}`, params);

const engineCall = (action: string, params?: unknown) =>
  ipcRenderer.invoke(`aurolis:engine:${action}`, params);

const aurolis = {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  setTheme: (theme: "light" | "dark" | "system") =>
    ipcRenderer.send("aurolis:set-theme", theme),
  github: {
    startSignIn: () => ipcRenderer.invoke("aurolis:github:start"),
    waitForSignIn: () => ipcRenderer.invoke("aurolis:github:wait"),
    cancelSignIn: () => ipcRenderer.invoke("aurolis:github:cancel"),
    getStatus: () => ipcRenderer.invoke("aurolis:github:status"),
    signOut: () => ipcRenderer.invoke("aurolis:github:sign-out"),
    installations: () => ipcRenderer.invoke("aurolis:github:installations"),
    openInstallPage: () => ipcRenderer.invoke("aurolis:github:install"),
    repositories: () => ipcRenderer.invoke("aurolis:github:repositories"),
    pull: (params: unknown) =>
      ipcRenderer.invoke("aurolis:github:pull", params),
    commit: (params: unknown) =>
      ipcRenderer.invoke("aurolis:github:commit", params),
    createRepository: (params: unknown) =>
      ipcRenderer.invoke("aurolis:github:create-repository", params),
    emptyRepository: (params: unknown) =>
      ipcRenderer.invoke("aurolis:github:empty-repository", params),
  },
  workspace: {
    list: () => workspaceCall("list"),
    gitInfo: () => workspaceCall("git-info"),
    checkDefaultStorage: () => workspaceCall("storage-check-default"),
    chooseStorage: () => workspaceCall("storage-choose"),
    setStorage: (choice: "default" | "chosen") =>
      workspaceCall("storage-set", choice),
    create: (params: unknown) => workspaceCall("create", params),
    clone: (params: unknown) => workspaceCall("clone", params),
    cancelClone: () => workspaceCall("clone-cancel"),
    openFolder: () => workspaceCall("open-folder"),
    open: (id: string) => workspaceCall("open", id),
    initialize: (id: string) => workspaceCall("initialize", id),
    rename: (params: unknown) => workspaceCall("rename", params),
    publish: (params: unknown) => workspaceCall("publish", params),
    removeCheck: (id: string) => workspaceCall("remove-check", id),
    reveal: (id: string) => workspaceCall("reveal", id),
    remove: (params: unknown) => workspaceCall("remove", params),
    onChanged: (callback: (id: string) => void) => {
      const listener = (_event: IpcRendererEvent, id: string) => callback(id);
      ipcRenderer.on("aurolis:workspace:changed", listener);
      return () => {
        ipcRenderer.removeListener("aurolis:workspace:changed", listener);
      };
    },
  },
  collection: {
    apply: (params: unknown) => collectionCall("apply", params),
    loadEditorState: (id: string) => collectionCall("editor-load", id),
    saveDrafts: (params: unknown) =>
      collectionCall("editor-save-drafts", params),
    saveUiState: (params: unknown) => collectionCall("editor-save-ui", params),
  },
  sourceControl: {
    changes: (id: string) =>
      ipcRenderer.invoke("aurolis:source-control:changes", id),
    commit: (params: unknown) =>
      ipcRenderer.invoke("aurolis:source-control:commit", params),
  },
  engine: {
    sendHttp: (params: unknown) => engineCall("http-send", params),
    sendGraphql: (params: unknown) => engineCall("graphql-send", params),
    introspectGraphql: (params: unknown) =>
      engineCall("graphql-introspect", params),
    cancel: (runId: string) => engineCall("cancel", runId),
    connectRealtime: (params: unknown) =>
      engineCall("realtime-connect", params),
    sendRealtime: (params: unknown) => engineCall("realtime-send", params),
    disconnectRealtime: (id: string) => engineCall("realtime-disconnect", id),
    onRealtimeEvent: (callback: (event: unknown) => void) => {
      const listener = (_event: IpcRendererEvent, payload: unknown) =>
        callback(payload);
      ipcRenderer.on("aurolis:engine:realtime-event", listener);
      return () => {
        ipcRenderer.removeListener("aurolis:engine:realtime-event", listener);
      };
    },
  },
} as const;

contextBridge.exposeInMainWorld("aurolis", aurolis);
