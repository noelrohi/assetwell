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

export interface HiggsfieldModelDetailsRequest {
  model: string
  mediaKind?: HiggsfieldMediaKind
}

export interface HiggsfieldModelParam {
  name: string
  type: string | null
  required: boolean
  defaultValue: string | number | boolean | null
  enumValues: string[]
}

export interface HiggsfieldModelDetails {
  id: string
  label: string
  mediaKind: HiggsfieldMediaKind
  params: HiggsfieldModelParam[]
  aspectRatios: string[]
}

export interface HiggsfieldUploadAssetRequest {
  filePath: string
}

export interface HiggsfieldOutputSize {
  width: number
  height: number
}

export interface HiggsfieldGenerateRequest {
  model: string
  prompt: string
  mediaKind: HiggsfieldMediaKind
  assetPath?: string
  assetPaths?: string[]
  assetMediaKind?: Exclude<HiggsfieldMediaKind, "text">
  aspectRatio?: string
  outputDirectoryName?: string
  outputFileName?: string
  outputSize?: HiggsfieldOutputSize
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

export type KreeytsJobStatus = "pending" | "ready" | "failed"

export interface KreeytsPersistedTake {
  id: string
  url: string
  status: KreeytsJobStatus
  filePath?: string
  runId?: string
  error?: string
}

export interface KreeytsPersistedPlacement {
  size: string
  status: KreeytsJobStatus
  url?: string
  filePath?: string
  runId?: string
  error?: string
}

export interface KreeytsPersistedCreative {
  id: string
  title: string
  prompt: string
  ratioId: string
  ratioW: number
  ratioH: number
  model: string
  createdAt: string
  heroUrl: string
  status: KreeytsJobStatus
  takes: KreeytsPersistedTake[]
  selectedTakeId: string
  placements: KreeytsPersistedPlacement[]
  outputDirectoryName?: string
}

export interface KreeytsPersistedVideo {
  id: string
  size: string
  status: KreeytsJobStatus
  posterUrl: string
  prompt: string
  sourceCreativeId?: string
  sourceTitle?: string
  createdAt: string
  url?: string
  filePath?: string
  runId?: string
  error?: string
}

export interface KreeytsPersistedReferenceAsset {
  id: string
  name: string
  url: string
  filePath?: string
  sizeBytes?: number | null
  modifiedAt?: string | null
}

export interface KreeytsReferenceAsset extends KreeytsPersistedReferenceAsset {
  filePath: string
  sizeBytes: number | null
  modifiedAt: string | null
}

export interface KreeytsDeleteReferenceAssetRequest {
  id: string
}

export type KreeytsPromptKind = "image" | "video"

export interface KreeytsPromptPreset {
  id: string
  title: string
  body: string
  kind: KreeytsPromptKind
  createdAt: string
}

export interface KreeytsLibrarySnapshot {
  schemaVersion: 1
  creatives: KreeytsPersistedCreative[]
  videos: KreeytsPersistedVideo[]
  referenceLibrary: KreeytsPersistedReferenceAsset[]
  customPrompts: KreeytsPromptPreset[]
  savedAt: string
}

export interface KreeytsSettings {
  outputRoot: string
}

export interface KreeytsChooseOutputRootResult {
  outputRoot: string
}

export interface KreeytsExportZipFile {
  path: string
  name: string
}

export interface KreeytsExportCreativeZipRequest {
  title: string
  outputDirectoryName?: string
  files: KreeytsExportZipFile[]
}

export interface KreeytsExportCreativeZipResult {
  filePath: string
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
    listModels(request?: HiggsfieldModelListRequest): Promise<HiggsfieldModel[]>
    getModelDetails(
      request: HiggsfieldModelDetailsRequest,
    ): Promise<HiggsfieldModelDetails>
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
  library: {
    loadSnapshot(): Promise<KreeytsLibrarySnapshot | null>
    saveSnapshot(snapshot: KreeytsLibrarySnapshot): Promise<boolean>
    getSettings(): Promise<KreeytsSettings>
    chooseOutputRoot(): Promise<KreeytsChooseOutputRootResult | null>
    revealOutputRoot(): Promise<boolean>
    listReferenceAssets(): Promise<KreeytsReferenceAsset[]>
    importReferenceAssets(): Promise<KreeytsReferenceAsset[]>
    revealReferenceAssets(): Promise<boolean>
    deleteReferenceAsset(
      request: KreeytsDeleteReferenceAssetRequest,
    ): Promise<boolean>
    exportCreativeZip(
      request: KreeytsExportCreativeZipRequest,
    ): Promise<KreeytsExportCreativeZipResult | null>
  }
}
