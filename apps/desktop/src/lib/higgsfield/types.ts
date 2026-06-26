import type {
  DesktopBridge,
  HiggsfieldAccountStatus,
  HiggsfieldCliStatus,
  HiggsfieldMediaKind,
  HiggsfieldWorkspaceContext,
  AssetwellPromptKind,
  AssetwellPromptPreset,
  AssetwellSettings,
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
  outputDirectoryName?: string
}

export interface VideoResult extends SeedVideoResult {
  url?: string
  filePath?: string
  runId?: string
  error?: string
}

export interface ReferenceAsset extends SeedReferenceAsset {
  filePath?: string
  sizeBytes?: number | null
  modifiedAt?: string | null
}

export type PromptPreset = AssetwellPromptPreset

export interface ModelOption {
  id: string
  label: string
  hint: string | null
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

export interface HiggsfieldAppValue {
  account: HiggsfieldAccountStatus | null
  cliStatus: HiggsfieldCliStatus | null
  workspace: HiggsfieldWorkspaceContext | null
  imageModels: ModelOption[]
  videoModels: ModelOption[]
  creatives: Creative[]
  videos: VideoResult[]
  referenceLibrary: ReferenceAsset[]
  imagePrompts: PromptPreset[]
  videoPrompts: PromptPreset[]
  settings: AssetwellSettings | null
  runningJobs: number
  videoDraftSource: VideoSource | null
  refreshAccount: () => Promise<void>
  signIn: () => Promise<void>
  chooseReferenceAsset: () => Promise<void>
  refreshReferenceLibrary: () => Promise<void>
  revealReferenceLibrary: () => Promise<void>
  deleteReferenceAsset: (id: string) => Promise<void>
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
