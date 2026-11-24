import type {
  GithubAuthStatus,
  GithubDeviceFlowStart,
  GithubSignInResult,
} from "@/types/auth/auth-response.type";
import type {
  CommitFilesParams,
  CreateRepositoryParams,
  PullFilesParams,
  RepositoryNameParams,
} from "@/types/github/github-params.type";
import type {
  CommitFilesResponse,
  GithubInstallation,
  GithubRepository,
  GithubResult,
  PullFilesResponse,
} from "@/types/github/github-response.type";
import type {
  CloneResult,
  CloneWorkspaceParams,
  CreateWorkspaceParams,
  GitInfo,
  OpenedWorkspace,
  PublishResult,
  PublishWorkspaceParams,
  RemoveCheck,
  RemoveWorkspaceParams,
  RenameWorkspaceParams,
  StorageFolderCheck,
  WorkspaceRegistryView,
  WorkspaceResult,
} from "@/types/workspace/workspace-store.type";

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
    installations(): Promise<GithubResult<GithubInstallation[]>>;
    openInstallPage(): Promise<void>;
    repositories(): Promise<GithubResult<GithubRepository[]>>;
    pull(params: PullFilesParams): Promise<GithubResult<PullFilesResponse>>;
    commit(
      params: CommitFilesParams,
    ): Promise<GithubResult<CommitFilesResponse>>;
    createRepository(
      params: CreateRepositoryParams,
    ): Promise<GithubResult<GithubRepository>>;
    emptyRepository(
      params: RepositoryNameParams,
    ): Promise<GithubResult<GithubRepository>>;
  };
  readonly workspace: {
    list(): Promise<WorkspaceResult<WorkspaceRegistryView>>;
    gitInfo(): Promise<WorkspaceResult<GitInfo>>;
    checkDefaultStorage(): Promise<WorkspaceResult<StorageFolderCheck>>;
    chooseStorage(): Promise<WorkspaceResult<StorageFolderCheck | null>>;
    setStorage(
      choice: "default" | "chosen",
    ): Promise<WorkspaceResult<WorkspaceRegistryView>>;
    create(
      params: CreateWorkspaceParams,
    ): Promise<WorkspaceResult<{ workspaceId: string }>>;
    clone(params: CloneWorkspaceParams): Promise<WorkspaceResult<CloneResult>>;
    cancelClone(): Promise<WorkspaceResult<void>>;
    openFolder(): Promise<WorkspaceResult<CloneResult>>;
    open(id: string): Promise<WorkspaceResult<OpenedWorkspace>>;
    initialize(id: string): Promise<WorkspaceResult<OpenedWorkspace>>;
    rename(
      params: RenameWorkspaceParams,
    ): Promise<WorkspaceResult<WorkspaceRegistryView>>;
    publish(
      params: PublishWorkspaceParams,
    ): Promise<WorkspaceResult<PublishResult>>;
    removeCheck(id: string): Promise<WorkspaceResult<RemoveCheck>>;
    reveal(id: string): Promise<WorkspaceResult<void>>;
    remove(
      params: RemoveWorkspaceParams,
    ): Promise<WorkspaceResult<WorkspaceRegistryView>>;
    onChanged(callback: (id: string) => void): () => void;
  };
}

declare global {
  interface Window {
    /** Present only when running inside the Electron shell. */
    aurolis?: AurolisBridge;
  }
}
