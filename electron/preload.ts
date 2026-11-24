import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

const workspaceCall = (action: string, params?: unknown) =>
  ipcRenderer.invoke(`aurolis:workspace:${action}`, params);

// Minimal bridge. Add IPC calls here as the app needs them;
// never expose ipcRenderer or Node APIs directly.
const aurolis = {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  /** Sync the native window chrome (title bar, menus, dialogs) with the app theme. */
  setTheme: (theme: "light" | "dark" | "system") =>
    ipcRenderer.send("aurolis:set-theme", theme),
  /** GitHub sign-in. The access token never leaves the main process. */
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
} as const;

contextBridge.exposeInMainWorld("aurolis", aurolis);
