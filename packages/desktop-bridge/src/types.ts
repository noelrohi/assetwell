export interface HostAppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  isPackaged: boolean
}

export const HIGGSFIELD_COMMAND_AREAS = [
  "auth",
  "account",
  "workspace",
  "model",
  "generate",
  "upload",
  "soul-id",
  "marketing-studio",
  "version",
] as const

export type HiggsfieldCommandArea = (typeof HIGGSFIELD_COMMAND_AREAS)[number]

export type HiggsfieldAuthStatus =
  | "authenticated"
  | "unauthenticated"
  | "unknown"

export type HiggsfieldWorkspaceStatus = "verified" | "unknown"

export type HiggsfieldExecutableSource = "bundled" | "global" | "missing"

export interface HiggsfieldCliStatus {
  installed: boolean
  version: string | null
  executableSource: HiggsfieldExecutableSource
  bundledVersion: string | null
  authStatus: HiggsfieldAuthStatus
  workspaceStatus: HiggsfieldWorkspaceStatus
  detail: string | null
  checkedAt: string
}

export type HiggsfieldMediaKind = "image" | "video" | "audio" | "text"

export type HiggsfieldProductAction =
  | "sign-in"
  | "check-credits"
  | "check-workspace"
  | "list-models"
  | "upload-asset"
  | "generate"

export interface HiggsfieldCommandRun {
  runId: string
  action: HiggsfieldProductAction
  title: string
  startedAt: string
}

export interface HiggsfieldAssetSelection {
  filePath: string
  fileName: string
  mediaKind: Exclude<HiggsfieldMediaKind, "text">
  sizeBytes: number | null
}

export interface HiggsfieldAccountStatus {
  email: string | null
  plan: string | null
  credits: number | null
  checkedAt: string
}

export interface HiggsfieldWorkspaceSummary {
  id: string
  name: string | null
  plan: string | null
  credits: number | null
  isSelected: boolean
  userRole: string | null
}

export interface HiggsfieldWorkspaceContext {
  selected: HiggsfieldWorkspaceSummary | null
  workspaces: HiggsfieldWorkspaceSummary[]
  checkedAt: string
}

export interface HiggsfieldModel {
  id: string
  label: string
  mediaKind: HiggsfieldMediaKind
  hint: string | null
}

export interface HiggsfieldModelListRequest {
  mediaKind?: HiggsfieldMediaKind
}

export interface HiggsfieldUploadAssetRequest {
  filePath: string
}

export interface HiggsfieldGenerateRequest {
  model: string
  prompt: string
  mediaKind: HiggsfieldMediaKind
  assetPath?: string
  assetMediaKind?: Exclude<HiggsfieldMediaKind, "text">
  aspectRatio?: string
  outputDirectoryName?: string
  outputFileName?: string
  waitForResult?: boolean
}

export interface HiggsfieldOpenOutputRequest {
  target: string
}

export type HiggsfieldCommandOutputKind =
  | "stdout"
  | "stderr"
  | "system"
  | "result"
  | "exit"

export interface HiggsfieldGeneratedArtifact {
  url: string | null
  filePath: string | null
  id: string | null
  mediaKind: HiggsfieldMediaKind | null
}

export interface HiggsfieldCommandResult {
  artifacts: HiggsfieldGeneratedArtifact[]
}

export interface HiggsfieldCommandOutputEvent {
  runId: string
  kind: HiggsfieldCommandOutputKind
  text: string
  timestamp: string
  result?: HiggsfieldCommandResult
  exitCode?: number | null
  signal?: string | null
}

export interface DesktopBridge {
  app: {
    getInfo(): Promise<HostAppInfo>
  }
  higgsfield: {
    getStatus(): Promise<HiggsfieldCliStatus>
    signIn(): Promise<HiggsfieldCommandRun>
    checkCredits(): Promise<HiggsfieldAccountStatus>
    checkWorkspace(): Promise<HiggsfieldWorkspaceContext>
    listModels(
      request?: HiggsfieldModelListRequest,
    ): Promise<HiggsfieldModel[]>
    chooseAsset(
      mediaKind?: Exclude<HiggsfieldMediaKind, "text">,
    ): Promise<HiggsfieldAssetSelection | null>
    uploadAsset(
      request: HiggsfieldUploadAssetRequest,
    ): Promise<HiggsfieldCommandRun>
    generate(request: HiggsfieldGenerateRequest): Promise<HiggsfieldCommandRun>
    openOutput(request: HiggsfieldOpenOutputRequest): Promise<boolean>
    cancelCommand(runId: string): Promise<boolean>
    onCommandOutput(
      listener: (event: HiggsfieldCommandOutputEvent) => void,
    ): () => void
  }
}
