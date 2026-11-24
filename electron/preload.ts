import { contextBridge, ipcRenderer } from "electron";

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
  },
} as const;

contextBridge.exposeInMainWorld("aurolis", aurolis);
