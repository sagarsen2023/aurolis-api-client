import { app, BrowserWindow, nativeTheme, net, protocol, shell } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";

const APP_SCHEME = "app";
const APP_HOST = "aurolis";

const ROOT = path.join(import.meta.dirname, "..");
const RENDERER_DIST = path.join(ROOT, "dist");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// Brand grounds from the design system, so the window doesn't flash white
// before the first paint.
const BG_DARK = "#0c0b0c";
const BG_LIGHT = "#f6f3f8";

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
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG_DARK : BG_LIGHT,
    icon: path.join(ROOT, "build", "icon.png"),
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

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
