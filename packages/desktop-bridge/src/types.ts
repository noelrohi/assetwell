export interface HostAppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  isPackaged: boolean
}

export interface AssetwellReleaseNotes {
  /** The app version these notes describe, e.g. "0.0.5". */
  version: string
  /** Release title from GitHub (may be empty). */
  title: string
  /** Raw markdown body of the GitHub Release. */
  body: string
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
export type HiggsfieldUploadMediaKind = Exclude<HiggsfieldMediaKind, "text">

export type HiggsfieldProductAction =
  | "sign-in"
  | "sign-out"
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
  mediaKind: HiggsfieldUploadMediaKind
  sizeBytes: number | null
}

export interface HiggsfieldUploadedAsset {
  id: string
  uploadId: string
  name: string
  url: string
  mediaKind: HiggsfieldUploadMediaKind
  createdAt: string | null
  sizeBytes?: number | null
}

export interface HiggsfieldUploadListRequest {
  mediaKind?: HiggsfieldUploadMediaKind
  size?: number
  cursor?: string
}

export interface HiggsfieldUploadListResult {
  items: HiggsfieldUploadedAsset[]
  cursor: string | null
  checkedAt: string
}

export type AssetwellBrandView = "all" | "unsorted" | "brand"

export interface AssetwellBrand {
  id: string
  name: string
  isDefault?: boolean
}

export interface AssetwellBrandAssignment {
  uploadId: string
  brandId: string | null
}

export interface AssetwellBrandState {
  brands: AssetwellBrand[]
  activeBrandId: string | null
  activeBrandView: AssetwellBrandView
  assignments: AssetwellBrandAssignment[]
}

export interface AssetwellSetActiveBrandRequest {
  view: AssetwellBrandView
  id?: string | null
}

export interface AssetwellCreateBrandRequest {
  name: string
}

export interface AssetwellUpdateBrandRequest {
  id: string
  name: string
}

export interface AssetwellAssignUploadsToBrandRequest {
  uploadIds: string[]
  brandId: string | null
}

export interface AssetwellUploadFolder {
  id: string
  name: string
}

export interface AssetwellUploadFolderAssignment {
  uploadId: string
  folderId: string | null
}

export interface AssetwellUploadFolderState {
  folders: AssetwellUploadFolder[]
  assignments: AssetwellUploadFolderAssignment[]
}

export interface AssetwellCreateUploadFolderRequest {
  name: string
}

export interface AssetwellUpdateUploadFolderRequest {
  id: string
  name: string
}

export interface AssetwellDeleteUploadFolderRequest {
  id: string
}

export interface AssetwellAssignUploadsToFolderRequest {
  uploadIds: string[]
  folderId: string | null
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

export interface HiggsfieldSetWorkspaceRequest {
  id: string
}

export interface HiggsfieldModel {
  id: string
  label: string
  mediaKind: HiggsfieldMediaKind
  hint: string | null
  badges?: string[]
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
  durationSeconds?: number
  uploadWorkspaceId?: string
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

export type AssetwellJobStatus = "pending" | "ready" | "failed"

export interface AssetwellPersistedTake {
  id: string
  url: string
  status: AssetwellJobStatus
  filePath?: string
  runId?: string
  error?: string
}

export interface AssetwellPersistedPlacement {
  size: string
  status: AssetwellJobStatus
  url?: string
  filePath?: string
  runId?: string
  error?: string
}

export interface AssetwellPersistedCreative {
  id: string
  title: string
  prompt: string
  ratioId: string
  ratioW: number
  ratioH: number
  model: string
  createdAt: string
  heroUrl: string
  status: AssetwellJobStatus
  takes: AssetwellPersistedTake[]
  selectedTakeId: string
  placements: AssetwellPersistedPlacement[]
  referenceAssets?: AssetwellPersistedReferenceAsset[]
  uploadWorkspaceId?: string
  outputDirectoryName?: string
}

export interface AssetwellPersistedVideo {
  id: string
  size: string
  status: AssetwellJobStatus
  posterUrl: string
  prompt: string
  sourceCreativeId?: string
  sourceTitle?: string
  createdAt: string
  durationSeconds?: number
  uploadWorkspaceId?: string
  url?: string
  filePath?: string
  runId?: string
  error?: string
}

export interface AssetwellPersistedReferenceAsset {
  id: string
  name: string
  url: string
  filePath?: string
  uploadId?: string
  mediaKind?: HiggsfieldUploadMediaKind
  createdAt?: string | null
  source?: "higgsfield" | "local"
  sizeBytes?: number | null
  modifiedAt?: string | null
  brandId?: string | null
  folderId?: string | null
}

export interface AssetwellReferenceAsset extends AssetwellPersistedReferenceAsset {
  filePath: string
  sizeBytes: number | null
  modifiedAt: string | null
}

export interface AssetwellUploadWorkspace {
  /** Workspace scope id; currently a Higgsfield workspace id in the renderer. */
  id: string
  /** User-facing label; falls back to the id when Higgsfield has no name. */
  name: string
  isDefault: boolean
}

export interface AssetwellUploadWorkspaceState {
  workspaces: AssetwellUploadWorkspace[]
  activeWorkspaceId: string
}

export interface AssetwellUploadsSnapshot {
  workspaceState: AssetwellUploadWorkspaceState
  references: AssetwellReferenceAsset[]
}

export interface AssetwellSetActiveUploadWorkspaceRequest {
  id: string
  /** Optional display name used for the temporary local compatibility folder. */
  name?: string
}

export interface AssetwellCreateUploadWorkspaceRequest {
  name: string
}

export interface AssetwellUpdateUploadWorkspaceRequest {
  id: string
  name: string
}

export interface AssetwellDeleteUploadWorkspaceRequest {
  id: string
}

export interface AssetwellDeleteReferenceAssetRequest {
  id: string
}

export type AssetwellPromptKind = "image" | "video"

export interface AssetwellPromptPreset {
  id: string
  title: string
  body: string
  kind: AssetwellPromptKind
  createdAt: string
}

export interface AssetwellLibrarySnapshot {
  schemaVersion: 1
  creatives: AssetwellPersistedCreative[]
  videos: AssetwellPersistedVideo[]
  referenceLibrary: AssetwellPersistedReferenceAsset[]
  customPrompts: AssetwellPromptPreset[]
  savedAt: string
}

export interface AssetwellSettings {
  outputRoot: string
}

export interface AssetwellChooseOutputRootResult {
  outputRoot: string
}

export interface AssetwellExportZipFile {
  path: string
  name: string
}

export interface AssetwellExportCreativeZipRequest {
  title: string
  uploadWorkspaceId?: string
  outputDirectoryName?: string
  files: AssetwellExportZipFile[]
}

export interface AssetwellExportCreativeZipResult {
  filePath: string
}

export interface AssetwellExportVideoRequest {
  path: string
  title: string
  uploadWorkspaceId?: string
}

export interface AssetwellExportVideoResult {
  filePath: string
}

export interface AssetwellUpdateInfo {
  version: string
  currentVersion: string
  releaseDate?: string
  releaseNotes?: string
}

export interface DesktopBridge {
  app: {
    getInfo(): Promise<HostAppInfo>
    /**
     * Fetches the GitHub Release notes for the currently running app version
     * (host-owned `app.getVersion()`, tag `v<version>`). Returns null when there
     * is no matching release, when the notes are empty, or when the network/API
     * is unavailable — callers must treat null as "nothing to show", never as an
     * error to surface. The renderer does not supply the version.
     */
    getCurrentReleaseNotes(): Promise<AssetwellReleaseNotes | null>
  }
  higgsfield: {
    getStatus(): Promise<HiggsfieldCliStatus>
    signIn(): Promise<HiggsfieldCommandRun>
    signOut(): Promise<HiggsfieldCommandRun>
    checkCredits(): Promise<HiggsfieldAccountStatus>
    checkWorkspace(): Promise<HiggsfieldWorkspaceContext>
    setWorkspace(
      request: HiggsfieldSetWorkspaceRequest,
    ): Promise<HiggsfieldWorkspaceContext>
    listModels(request?: HiggsfieldModelListRequest): Promise<HiggsfieldModel[]>
    getModelDetails(
      request: HiggsfieldModelDetailsRequest,
    ): Promise<HiggsfieldModelDetails>
    listUploads(
      request?: HiggsfieldUploadListRequest,
    ): Promise<HiggsfieldUploadListResult>
    chooseAsset(
      mediaKind?: HiggsfieldUploadMediaKind,
    ): Promise<HiggsfieldAssetSelection | null>
    chooseAssets(
      mediaKind?: HiggsfieldUploadMediaKind,
    ): Promise<HiggsfieldAssetSelection[]>
    createUpload(
      request: HiggsfieldUploadAssetRequest,
    ): Promise<HiggsfieldUploadedAsset>
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
    loadSnapshot(): Promise<AssetwellLibrarySnapshot | null>
    saveSnapshot(snapshot: AssetwellLibrarySnapshot): Promise<boolean>
    getSettings(): Promise<AssetwellSettings>
    chooseOutputRoot(): Promise<AssetwellChooseOutputRootResult | null>
    revealOutputRoot(): Promise<boolean>
    loadBrandState(): Promise<AssetwellBrandState>
    setActiveBrand(
      request: AssetwellSetActiveBrandRequest,
    ): Promise<AssetwellBrandState>
    createBrand(
      request: AssetwellCreateBrandRequest,
    ): Promise<AssetwellBrandState>
    updateBrand(
      request: AssetwellUpdateBrandRequest,
    ): Promise<AssetwellBrandState>
    assignUploadsToBrand(
      request: AssetwellAssignUploadsToBrandRequest,
    ): Promise<AssetwellBrandState>
    loadUploadFolderState(): Promise<AssetwellUploadFolderState>
    createUploadFolder(
      request: AssetwellCreateUploadFolderRequest,
    ): Promise<AssetwellUploadFolderState>
    updateUploadFolder(
      request: AssetwellUpdateUploadFolderRequest,
    ): Promise<AssetwellUploadFolderState>
    deleteUploadFolder(
      request: AssetwellDeleteUploadFolderRequest,
    ): Promise<AssetwellUploadFolderState>
    assignUploadsToFolder(
      request: AssetwellAssignUploadsToFolderRequest,
    ): Promise<AssetwellUploadFolderState>
    loadUploadsSnapshot(): Promise<AssetwellUploadsSnapshot>
    setActiveUploadWorkspace(
      request: AssetwellSetActiveUploadWorkspaceRequest,
    ): Promise<AssetwellUploadsSnapshot>
    createUploadWorkspace(
      request: AssetwellCreateUploadWorkspaceRequest,
    ): Promise<AssetwellUploadsSnapshot>
    updateUploadWorkspace(
      request: AssetwellUpdateUploadWorkspaceRequest,
    ): Promise<AssetwellUploadsSnapshot>
    deleteUploadWorkspace(
      request: AssetwellDeleteUploadWorkspaceRequest,
    ): Promise<AssetwellUploadsSnapshot>
    importReferenceAssets(): Promise<AssetwellUploadsSnapshot>
    revealReferenceAssets(): Promise<boolean>
    exportCreativeZip(
      request: AssetwellExportCreativeZipRequest,
    ): Promise<AssetwellExportCreativeZipResult | null>
    exportVideo(
      request: AssetwellExportVideoRequest,
    ): Promise<AssetwellExportVideoResult | null>
  }
  updater: {
    getDownloadedUpdate(): Promise<AssetwellUpdateInfo | null>
    installDownloadedUpdate(): Promise<boolean>
    onDownloadedUpdate(
      listener: (update: AssetwellUpdateInfo) => void,
    ): () => void
  }
}
