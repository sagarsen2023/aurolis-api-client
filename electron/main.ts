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
  listInstallations,
  listRepositories,
  openInstallPage,
  pullFiles,
  toResult,
} from "./github-sync.ts";

const APP_SCHEME = "app";
const APP_HOST = "aurolis";

const ROOT = path.join(import.meta.dirname, "..");
const RENDERER_DIST = path.join(ROOT, "dist");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Brand grounds from the design system, so the window doesn't flash white
// before the first paint.
const BG_DARK = "#0c0b0c";
const BG_LIGHT = "#f6f3f8";
const INK_DARK = "#ffffff";
const INK_LIGHT = "#151017";

// Must match the height of the renderer's <TitleBar /> strip.
const TITLEBAR_HEIGHT = 36;
const IS_MAC = process.platform === "darwin";

type ThemeSource = "light" | "dark" | "system";
const THEME_SOURCES: readonly ThemeSource[] = ["light", "dark", "system"];

function themeColors() {
  const dark = nativeTheme.shouldUseDarkColors;
  return {
    background: dark ? BG_DARK : BG_LIGHT,
    symbol: dark ? INK_DARK : INK_LIGHT,
  };
}

// Repaint the native parts of a window (background, and the caption buttons
// drawn over the app on Windows/Linux) in the current theme.
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

// In production the renderer is served from app://aurolis/ instead of file://
// so absolute asset paths and history-based routing work exactly like in dev.
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
    return (await stat(filePath)).isFile();
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

    // Block path traversal outside the renderer bundle.
    if (!requested.startsWith(RENDERER_DIST)) {
      return new Response("Not found", { status: 404 });
    }

    // Unknown paths fall back to index.html (SPA routing).
    const filePath = (await isFile(requested))
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
    icon: path.join(ROOT, "build", "icon.png"),
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => {
    win.show();
    // Packaged builds stay closed. `electron .` and `npm run dev` are unpackaged,
    // so the console opens in its own window instead of docking under the hidden title bar.
    if (!app.isPackaged) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  });

  // Open external links in the user's browser, never inside the app.
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

// Single instance: focus the existing window instead of opening a second app.
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

  // The renderer reports the theme picked in the app ("system" follows the OS).
  ipcMain.on("aurolis:set-theme", (event, theme: unknown) => {
    if (!BrowserWindow.fromWebContents(event.sender)) return;
    if (!THEME_SOURCES.includes(theme as ThemeSource)) return;
    nativeTheme.themeSource = theme as ThemeSource;
  });

  // GitHub sign-in (device flow). The token stays in this process.
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

  // Fires for in-app theme changes and for OS changes while on "system".
  nativeTheme.on("updated", () => {
    for (const win of BrowserWindow.getAllWindows()) applyThemeToWindow(win);
  });

  app.whenReady().then(() => {
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
