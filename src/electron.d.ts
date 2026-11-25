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
import type {
  ApplyCollectionOpParams,
  CollectionOpResult,
} from "@/types/workspace/collection-ops.type";
import type {
  EditorState,
  SaveDraftsParams,
  SaveUiStateParams,
} from "@/types/workspace/editor-state.type";
import type { EngineResult } from "@/types/engine/engine.type";
import type {
  CommitParams,
  CommitResult,
  SourceControlChanges,
} from "@/types/workspace/source-control.type";
import type {
  HttpResponseData,
  HttpSendParams,
} from "@/types/engine/http-engine.type";
import type {
  GraphqlIntrospectParams,
  GraphqlResponseData,
  GraphqlSchemaResult,
  GraphqlSendParams,
} from "@/types/engine/graphql-engine.type";
import type {
  RealtimeConnectParams,
  RealtimeEvent,
  RealtimeSendParams,
} from "@/types/engine/realtime-engine.type";

interface AurolisBridge {
  readonly isElectron: true;
  readonly platform: string;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
  };
  setTheme(theme: "light" | "dark" | "system"): void;
  readonly github: {
    startSignIn(): Promise<GithubDeviceFlowStart>;
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
  readonly collection: {
    apply(
      params: ApplyCollectionOpParams,
    ): Promise<WorkspaceResult<CollectionOpResult>>;
    loadEditorState(id: string): Promise<WorkspaceResult<EditorState>>;
    saveDrafts(params: SaveDraftsParams): Promise<WorkspaceResult<void>>;
    saveUiState(params: SaveUiStateParams): Promise<WorkspaceResult<void>>;
  };
  readonly sourceControl: {
    changes(id: string): Promise<WorkspaceResult<SourceControlChanges>>;
    commit(params: CommitParams): Promise<WorkspaceResult<CommitResult>>;
  };
  readonly engine: {
    sendHttp(params: HttpSendParams): Promise<EngineResult<HttpResponseData>>;
    sendGraphql(
      params: GraphqlSendParams,
    ): Promise<EngineResult<GraphqlResponseData>>;
    introspectGraphql(
      params: GraphqlIntrospectParams,
    ): Promise<EngineResult<GraphqlSchemaResult>>;
    cancel(runId: string): Promise<EngineResult<void>>;
    connectRealtime(params: RealtimeConnectParams): Promise<EngineResult<void>>;
    sendRealtime(params: RealtimeSendParams): Promise<EngineResult<void>>;
    disconnectRealtime(id: string): Promise<EngineResult<void>>;
    onRealtimeEvent(callback: (event: RealtimeEvent) => void): () => void;
  };
}

declare global {
  interface Window {
    aurolis?: AurolisBridge;
  }
}
