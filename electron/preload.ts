import { contextBridge } from "electron";

// Minimal, read-only bridge. Add IPC calls here as the app needs them;
// never expose ipcRenderer or Node APIs directly.
const aurolis = {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
} as const;

contextBridge.exposeInMainWorld("aurolis", aurolis);
