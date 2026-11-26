import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  net,
  protocol,
  shell,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";
import {
  cancelDeviceFlow,
  getAuthStatus,
  signOut,
  startDeviceFlow,
  waitForAuthorization,
} from "./github-auth.ts";
import {
  commitFiles,
  createRepository,
  getEmptyRepository,
  listInstallations,
  listRepositories,
  openInstallPage,
  pullFiles,
  toResult,
} from "./github-sync.ts";
import { gitInfo } from "./git.ts";
import {
  applyOperation,
  loadEditorState,
  moveCollection,
  saveDrafts,
  saveUiState,
} from "./collection-store.ts";
import { commitAndSync, listChanges, pullWorkspace } from "./source-control.ts";
import { saveExportFile } from "./export-file.ts";
import { toEngineResult } from "./engines/engine-error.ts";
import { introspectGraphql, sendGraphql } from "./engines/graphql-engine.ts";
import { cancelRun, sendHttp } from "./engines/http-engine.ts";
import {
  connectRealtime,
  disconnectRealtime,
  sendRealtime,
} from "./engines/realtime-engine.ts";
import {
  cancelClones,
  checkStorageFolder,
  chooseStorageFolder,
  cloneWorkspace,
  createLocalWorkspace,
  initializeWorkspace,
  listWorkspaces,
  openExistingFolder,
  openWorkspace,
  publishWorkspace,
  removeCheck,
  removeWorkspace,
  revealWorkspace,
  renameWorkspace,
  setStorageFolder,
  stopSyncing,
  toWorkspaceResult,
} from "./workspace-store.ts";

const APP_SCHEME = "app";
const APP_HOST = "aurolis";

const ROOT = path.join(import.meta.dirname, "..");
const RENDERER_DIST = path.join(ROOT, "dist");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

const BG_DARK = "#0c0b0c";
const BG_LIGHT = "#f6f3f8";
const INK_DARK = "#ffffff";
const INK_LIGHT = "#151017";

const TITLEBAR_HEIGHT = 36;
const IS_MAC = process.platform === "darwin";
const APP_ICON = path.join(ROOT, "build", "icon.png");

type ThemeSource = "light" | "dark" | "system";
const THEME_SOURCES: readonly ThemeSource[] = ["light", "dark", "system"];

function themeColors() {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    background: dark ? BG_DARK : BG_LIGHT,
    symbol: dark ? INK_DARK : INK_LIGHT,
  };
}

function applyThemeToWindow(win: BrowserWindow) {
  const { background, symbol } = themeColors();
  win.setBackgroundColor(background);
  if (!IS_MAC) {
    win.setTitleBarOverlay({
      color: background,
      symbolColor: symbol,
      height: TITLEBAR_HEIGHT,
    });
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src * data: blob:",
].join("; ");

async function isFile(filePath: string) {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const requested = path.normalize(
      path.join(RENDERER_DIST, decodeURIComponent(pathname)),
    );

    if (!requested.startsWith(RENDERER_DIST)) {
      return new Response("Not found", { status: 404 });
    }

    const isKnownFile = await isFile(requested);
    const filePath = isKnownFile
      ? requested
      : path.join(RENDERER_DIST, "index.html");

    const response = await net.fetch(pathToFileURL(filePath).toString());

    if (filePath.endsWith(".html")) {
      const headers = new Headers(response.headers);
      headers.set("Content-Security-Policy", CSP);
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    return response;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    title: "Aurolis",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: themeColors().background,
    titleBarStyle: "hidden",
    ...(IS_MAC
      ? { trafficLightPosition: { x: 14, y: 11 } }
      : {
          titleBarOverlay: {
            color: themeColors().background,
            symbolColor: themeColors().symbol,
            height: TITLEBAR_HEIGHT,
          },
        }),
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
    if (!app.isPackaged) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const allowedOrigin = DEV_SERVER_URL
      ? new URL(DEV_SERVER_URL).origin
      : `${APP_SCHEME}://${APP_HOST}`;
    if (new URL(url).origin !== allowedOrigin) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL);
  } else {
    win.loadURL(`${APP_SCHEME}://${APP_HOST}/`);
  }

  return win;
}

app.setName("Aurolis");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  ipcMain.on("aurolis:set-theme", (event, theme: unknown) => {
    if (!BrowserWindow.fromWebContents(event.sender)) return;
    if (!THEME_SOURCES.includes(theme as ThemeSource)) return;
    nativeTheme.themeSource = theme as ThemeSource;
  });

  const fromAppWindow = (event: Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(event.sender) !== null;

  ipcMain.handle("aurolis:github:start", (event) =>
    fromAppWindow(event) ? startDeviceFlow() : null,
  );
  ipcMain.handle("aurolis:github:wait", (event) =>
    fromAppWindow(event) ? waitForAuthorization() : null,
  );
  ipcMain.handle("aurolis:github:cancel", (event) => {
    if (fromAppWindow(event)) cancelDeviceFlow();
  });
  ipcMain.handle("aurolis:github:status", (event) =>
    fromAppWindow(event) ? getAuthStatus() : null,
  );
  ipcMain.handle("aurolis:github:sign-out", (event) =>
    fromAppWindow(event) ? signOut() : null,
  );

  ipcMain.handle("aurolis:github:installations", (event) =>
    fromAppWindow(event) ? toResult(listInstallations) : null,
  );
  ipcMain.handle("aurolis:github:install", (event) =>
    fromAppWindow(event) ? openInstallPage() : null,
  );
  ipcMain.handle("aurolis:github:repositories", (event) =>
    fromAppWindow(event) ? toResult(listRepositories) : null,
  );
  ipcMain.handle("aurolis:github:pull", (event, params: unknown) =>
    fromAppWindow(event) ? toResult(() => pullFiles(params)) : null,
  );
  ipcMain.handle("aurolis:github:commit", (event, params: unknown) =>
    fromAppWindow(event) ? toResult(() => commitFiles(params)) : null,
  );
  ipcMain.handle(
    "aurolis:github:create-repository",
    (event, params: unknown) =>
      fromAppWindow(event) ? toResult(() => createRepository(params)) : null,
  );
  ipcMain.handle("aurolis:github:empty-repository", (event, params: unknown) =>
    fromAppWindow(event) ? toResult(() => getEmptyRepository(params)) : null,
  );

  const windowOf = (event: Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(event.sender);
  const workspaceHandlers: Record<
    string,
    (event: Electron.IpcMainInvokeEvent, params: unknown) => Promise<unknown>
  > = {
    list: () => listWorkspaces(),
    "git-info": () => gitInfo(),
    "storage-check-default": async () => {
      const view = await listWorkspaces();
      return checkStorageFolder(view.defaultStorageFolder.path);
    },
    "storage-choose": (event) => chooseStorageFolder(windowOf(event)),
    "storage-set": (_event, choice) => setStorageFolder(choice),
    create: (_event, params) => createLocalWorkspace(params),
    clone: (_event, params) => cloneWorkspace(params),
    "clone-cancel": async () => cancelClones(),
    "open-folder": (event) => openExistingFolder(windowOf(event)),
    open: (_event, id) => openWorkspace(id),
    initialize: (_event, id) => initializeWorkspace(id),
    rename: (_event, params) => renameWorkspace(params),
    publish: (_event, params) => publishWorkspace(params),
    "stop-sync": (_event, id) => stopSyncing(id),
    "remove-check": (_event, id) => removeCheck(id),
    reveal: (_event, id) => revealWorkspace(id),
    remove: (_event, params) => removeWorkspace(params),
  };
  type Handler = (
    event: Electron.IpcMainInvokeEvent,
    params: unknown,
  ) => Promise<unknown>;
  type ResultWrapper = (operation: () => Promise<unknown>) => Promise<unknown>;

  const registerHandlers = (
    area: string,
    handlers: Record<string, Handler>,
    wrap: ResultWrapper,
  ) => {
    for (const [action, handler] of Object.entries(handlers)) {
      ipcMain.handle(`aurolis:${area}:${action}`, (event, params: unknown) =>
        fromAppWindow(event) ? wrap(() => handler(event, params)) : null,
      );
    }
  };

  registerHandlers("workspace", workspaceHandlers, toWorkspaceResult);
  registerHandlers(
    "collection",
    {
      apply: (_event, params) => applyOperation(params),
      move: (_event, params) => moveCollection(params),
      "editor-load": (_event, id) => loadEditorState(id),
      "editor-save-drafts": (_event, params) => saveDrafts(params),
      "editor-save-ui": (_event, params) => saveUiState(params),
    },
    toWorkspaceResult,
  );
  registerHandlers(
    "source-control",
    {
      changes: (_event, id) => listChanges(id),
      commit: (_event, params) => commitAndSync(params),
      pull: (_event, id) => pullWorkspace(id),
    },
    toWorkspaceResult,
  );
  registerHandlers(
    "transfer",
    {
      "save-file": (event, params) => saveExportFile(windowOf(event), params),
    },
    toWorkspaceResult,
  );
  registerHandlers(
    "engine",
    {
      "http-send": (_event, params) => sendHttp(params),
      "graphql-send": (_event, params) => sendGraphql(params),
      "graphql-introspect": (_event, params) => introspectGraphql(params),
      cancel: async (_event, runId) => cancelRun(runId),
      "realtime-connect": (event, params) =>
        connectRealtime(params, event.sender),
      "realtime-send": (_event, params) => sendRealtime(params),
      "realtime-disconnect": (_event, id) => disconnectRealtime(id),
    },
    toEngineResult,
  );

  nativeTheme.on("updated", () => {
    for (const win of BrowserWindow.getAllWindows()) applyThemeToWindow(win);
  });

  app.whenReady().then(() => {
    if (IS_MAC && !app.isPackaged) app.dock?.setIcon(APP_ICON);
    if (!DEV_SERVER_URL) registerAppProtocol();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
