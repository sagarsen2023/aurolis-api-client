// Mirrors the object exposed in electron/preload.ts.

type GithubUser = { login: string; name: string | null; avatarUrl: string };

type GithubSignInError =
  | "cancelled"
  | "expired"
  | "access_denied"
  | "device_flow_disabled"
  | "not_configured"
  | "network"
  | "unknown";

type GithubDeviceCodePrompt = {
  userCode: string;
  verificationUri: string;
  /** Seconds until the code expires. */
  expiresIn: number;
};

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
  readonly github: {
    /** Gets a device code from GitHub and opens the verification page. */
    startSignIn(): Promise<
      | { ok: true; prompt: GithubDeviceCodePrompt }
      | { ok: false; error: GithubSignInError }
    >;
    /** Resolves once the user approves, denies, cancels or the code expires. */
    waitForSignIn(): Promise<
      | { ok: true; user: GithubUser | null }
      | { ok: false; error: GithubSignInError }
    >;
    cancelSignIn(): Promise<void>;
    getStatus(): Promise<{ signedIn: boolean; user: GithubUser | null }>;
    signOut(): Promise<void>;
  };
}

interface Window {
  /** Present only when running inside the Electron shell. */
  aurolis?: AurolisBridge;
}
