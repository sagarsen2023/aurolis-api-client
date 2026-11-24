// Mirrors the object exposed in electron/preload.ts.
interface AurolisBridge {
  readonly isElectron: true;
  readonly platform: string;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
  };
  /** Sync the native window chrome (title bar, menus, dialogs) with the app theme. */
  setTheme(theme: "light" | "dark" | "system"): void;
}

interface Window {
  /** Present only when running inside the Electron shell. */
  aurolis?: AurolisBridge;
}
