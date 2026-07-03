import type {
  AssetwellBrand,
  AssetwellBrandView,
  AssetwellUploadFolder,
  AssetwellUploadFolderAssignment,
  DesktopBridge,
  HiggsfieldAccountStatus,
  HiggsfieldCliStatus,
  HiggsfieldMediaKind,
  HiggsfieldWorkspaceContext,
  AssetwellPromptKind,
  AssetwellPromptPreset,
  AssetwellSettings,
  AssetwellUploadWorkspace,
} from "@assetwell/desktop-bridge"

import type { ImagePlacement, VideoPlacement } from "@/lib/placements"
import type {
  Creative as SeedCreative,
  PlacementResult as SeedPlacementResult,
  ReferenceAsset as SeedReferenceAsset,
  Take as SeedTake,
  VideoResult as SeedVideoResult,
} from "@/lib/mock-data"

export type { JobStatus } from "@/lib/mock-data"

export type HiggsfieldBridge = DesktopBridge["higgsfield"]
export type LibraryBridge = DesktopBridge["library"]

export interface Take extends SeedTake {
  filePath?: string
  runId?: string
  error?: string
}

export interface PlacementResult extends SeedPlacementResult {
  filePath?: string
  runId?: string
  error?: string
}

export interface Creative extends Omit<SeedCreative, "takes" | "placements"> {
  takes: Take[]
  placements: PlacementResult[]
  referenceAssets?: ReferenceAsset[]
  uploadWorkspaceId?: string
  outputDirectoryName?: string
}

export interface VideoResult extends SeedVideoResult {
  uploadWorkspaceId?: string
  url?: string
  filePath?: string
  runId?: string
  error?: string
}

export interface ReferenceAsset extends SeedReferenceAsset {
  filePath?: string
  uploadId?: string
  mediaKind?: Exclude<HiggsfieldMediaKind, "text">
  createdAt?: string | null
  source?: "higgsfield" | "local"
  sizeBytes?: number | null
  modifiedAt?: string | null
  brandId?: string | null
  folderId?: string | null
}

export type PromptPreset = AssetwellPromptPreset
export type UploadWorkspace = AssetwellUploadWorkspace
export type BrandView = AssetwellBrandView
export type Brand = AssetwellBrand
export type UploadFolder = AssetwellUploadFolder

export interface ModelOption {
  id: string
  label: string
  hint: string | null
  badges?: string[]
}

export interface VideoSource {
  url: string
  filePath?: string
  label: string
  creativeId?: string
}

export interface PendingRun {
  kind: "take" | "placement" | "video"
  creativeId?: string
  takeId?: string
  placement?: ImagePlacement
  videoId?: string
}

export interface MakeCreativeRequest {
  prompt: string
  ratioId: string
  ratioW: number
  ratioH: number
  model: string
  referenceIds: string[]
}

export interface MakeVideosRequest {
  prompt: string
  model: string
  sizes: VideoPlacement[]
  source: VideoSource
  durationSeconds: number
}

export interface BrandsDomain {
  brands: Brand[]
  activeBrand: Brand | null
  activeBrandId: string | null
  view: BrandView
  activeLabel: string
  setActiveBrand: (view: BrandView, id?: string | null) => Promise<boolean>
  createBrand: (name: string) => Promise<boolean>
  updateBrand: (id: string, name: string) => Promise<boolean>
  assignUploads: (
    uploadIds: string[],
    brandId: string | null,
  ) => Promise<boolean>
}

export interface UploadFoldersDomain {
  folders: UploadFolder[]
  assignments: AssetwellUploadFolderAssignment[]
  createFolder: (name: string) => Promise<string | null>
  renameFolder: (id: string, name: string) => Promise<boolean>
  deleteFolder: (id: string) => Promise<boolean>
  assignUploads: (
    uploadIds: string[],
    folderId: string | null,
  ) => Promise<boolean>
}

export interface UploadsDomain {
  workspaces: UploadWorkspace[]
  activeWorkspace: UploadWorkspace
  activeWorkspaceId: string
  references: ReferenceAsset[]
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  reveal: () => Promise<void>
  importFiles: () => Promise<void>
  hasMore: boolean
  loadingMore: boolean
  canRevealReferences: boolean
  isRemote: boolean
  switchWorkspace: (id: string) => Promise<boolean>
  createWorkspace: (name: string) => Promise<boolean>
  updateWorkspace: (id: string, name: string) => Promise<boolean>
  deleteWorkspace: (id: string) => Promise<boolean>
}

export interface HiggsfieldAppValue {
  account: HiggsfieldAccountStatus | null
  cliStatus: HiggsfieldCliStatus | null
  workspace: HiggsfieldWorkspaceContext | null
  imageModels: ModelOption[]
  videoModels: ModelOption[]
  creatives: Creative[]
  videos: VideoResult[]
  uploads: UploadsDomain
  brands: BrandsDomain
  imagePrompts: PromptPreset[]
  videoPrompts: PromptPreset[]
  settings: AssetwellSettings | null
  runningJobs: number
  videoDraftSource: VideoSource | null
  refreshAccount: () => Promise<void>
  refreshSession: () => Promise<void>
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  chooseVideoSource: () => Promise<VideoSource | null>
  chooseOutputRoot: () => Promise<void>
  revealOutputRoot: () => Promise<void>
  savePromptPreset: (
    kind: AssetwellPromptKind,
    body: string,
    title?: string,
  ) => void
  deletePromptPreset: (id: string) => void
  getModelAspectRatios: (
    model: string,
    mediaKind: HiggsfieldMediaKind,
  ) => Promise<string[]>
  setVideoDraftSource: (source: VideoSource | null) => void
  makeCreative: (request: MakeCreativeRequest) => Promise<string | null>
  deleteCreative: (creativeId: string) => void
  selectTake: (creativeId: string, takeId: string) => void
  generateAllPlacements: (creativeId: string) => Promise<void>
  regeneratePlacement: (
    creativeId: string,
    placement: ImagePlacement,
  ) => Promise<void>
  openOutput: (target?: string | null) => Promise<void>
  exportCreativeZip: (creativeId: string) => Promise<void>
  exportVideo: (videoId: string) => Promise<void>
  makeVideos: (request: MakeVideosRequest) => Promise<void>
  creativeById: (id: string) => Creative | undefined
}
