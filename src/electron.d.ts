import type {
  GithubAuthStatus,
  GithubDeviceFlowStart,
  GithubSignInResult,
} from "@/types/auth/auth-response.type";

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
    startSignIn(): Promise<GithubDeviceFlowStart>;
    /** Resolves once the user approves, denies, cancels or the code expires. */
    waitForSignIn(): Promise<GithubSignInResult>;
    cancelSignIn(): Promise<void>;
    getStatus(): Promise<GithubAuthStatus>;
    signOut(): Promise<void>;
  };
}

declare global {
  interface Window {
    /** Present only when running inside the Electron shell. */
    aurolis?: AurolisBridge;
  }
}
