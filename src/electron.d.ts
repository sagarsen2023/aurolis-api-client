import type {
  GithubAuthStatus,
  GithubDeviceFlowStart,
  GithubSignInResult,
} from "@/types/auth/auth-response.type";
import type {
  CommitFilesParams,
  PullFilesParams,
} from "@/types/github/github-params.type";
import type {
  CommitFilesResponse,
  GithubInstallation,
  GithubRepository,
  GithubResult,
  PullFilesResponse,
} from "@/types/github/github-response.type";

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
    /** Accounts the GitHub App is installed on. Empty = not installed yet. */
    installations(): Promise<GithubResult<GithubInstallation[]>>;
    /** Opens GitHub's install page for the app in the browser. */
    openInstallPage(): Promise<void>;
    /** Repositories reachable through the app, with the user's role on each. */
    repositories(): Promise<GithubResult<GithubRepository[]>>;
    /** Reads a branch, downloading only files that differ from knownFiles. */
    pull(params: PullFilesParams): Promise<GithubResult<PullFilesResponse>>;
    /** Commits all changes as one commit; "conflict" if the branch moved. */
    commit(
      params: CommitFilesParams,
    ): Promise<GithubResult<CommitFilesResponse>>;
  };
}

declare global {
  interface Window {
    /** Present only when running inside the Electron shell. */
    aurolis?: AurolisBridge;
  }
}
