import * as React from "react"
import { toast } from "sonner"
import type {
  HiggsfieldAccountStatus,
  HiggsfieldCliStatus,
  HiggsfieldCommandOutputEvent,
  HiggsfieldGeneratedArtifact,
  HiggsfieldGenerateRequest,
  HiggsfieldMediaKind,
  HiggsfieldModel,
  HiggsfieldWorkspaceContext,
} from "@kreeyts/desktop-bridge"

import {
  imagePlacements,
  placementSpecs,
  type ImagePlacement,
  type VideoPlacement,
} from "@/lib/placements"
import {
  demoCreative as seededDemoCreative,
  imageModels as fallbackImageModels,
  imagePromptLibrary,
  referenceLibrary as seededReferenceLibrary,
  videoModels as fallbackVideoModels,
  videoPromptLibrary,
  type Creative as SeedCreative,
  type JobStatus,
  type PlacementResult as SeedPlacementResult,
  type ReferenceAsset as SeedReferenceAsset,
  type Take as SeedTake,
  type VideoResult as SeedVideoResult,
} from "@/lib/mock-data"

export type { JobStatus }
export { imagePromptLibrary, videoPromptLibrary }

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

export interface Creative
  extends Omit<SeedCreative, "takes" | "placements"> {
  takes: Take[]
  placements: PlacementResult[]
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
}

interface ModelOption {
  id: string
  label: string
  hint: string | null
}

interface VideoSource {
  url: string
  filePath?: string
  label: string
  creativeId?: string
}

interface PendingRun {
  kind: "take" | "placement" | "video"
  creativeId?: string
  takeId?: string
  placement?: ImagePlacement
  videoId?: string
}

interface MakeCreativeRequest {
  prompt: string
  ratioId: string
  ratioW: number
  ratioH: number
  model: string
  referenceIds: string[]
}

interface MakeVideosRequest {
  prompt: string
  model: string
  sizes: VideoPlacement[]
  source: VideoSource
}

interface HiggsfieldAppValue {
  account: HiggsfieldAccountStatus | null
  cliStatus: HiggsfieldCliStatus | null
  workspace: HiggsfieldWorkspaceContext | null
  imageModels: ModelOption[]
  videoModels: ModelOption[]
  creatives: Creative[]
  demoCreative: Creative
  videos: VideoResult[]
  referenceLibrary: ReferenceAsset[]
  runningJobs: number
  videoDraftSource: VideoSource | null
  refreshAccount: () => Promise<void>
  signIn: () => Promise<void>
  chooseReferenceAsset: () => Promise<void>
  chooseVideoSource: () => Promise<VideoSource | null>
  setVideoDraftSource: (source: VideoSource | null) => void
  makeCreative: (request: MakeCreativeRequest) => Promise<string | null>
  selectTake: (creativeId: string, takeId: string) => void
  generateAllPlacements: (creativeId: string) => Promise<void>
  regeneratePlacement: (
    creativeId: string,
    placement: ImagePlacement,
  ) => Promise<void>
  openOutput: (target?: string | null) => Promise<void>
  makeVideos: (request: MakeVideosRequest) => Promise<void>
  creativeById: (id: string) => Creative | undefined
}

const HiggsfieldAppContext = React.createContext<HiggsfieldAppValue | null>(
  null,
)

const demoCreative = seededDemoCreative as Creative
const seededReferences = seededReferenceLibrary as ReferenceAsset[]
const BILLING_URL = "https://higgsfield.ai/billing"

export function HiggsfieldProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const bridge = getHiggsfieldBridge()
  const pendingRuns = React.useRef(new Map<string, PendingRun>())
  const completedRuns = React.useRef(new Set<string>())
  const booted = React.useRef(false)

  const [account, setAccount] =
    React.useState<HiggsfieldAccountStatus | null>(null)
  const [cliStatus, setCliStatus] =
    React.useState<HiggsfieldCliStatus | null>(null)
  const [workspace, setWorkspace] =
    React.useState<HiggsfieldWorkspaceContext | null>(null)
  const [imageModels, setImageModels] = React.useState<ModelOption[]>(
    fallbackImageModels,
  )
  const [videoModels, setVideoModels] = React.useState<ModelOption[]>(
    fallbackVideoModels,
  )
  const [creatives, setCreatives] = React.useState<Creative[]>([demoCreative])
  const [videos, setVideos] = React.useState<VideoResult[]>([])
  const [referenceLibrary, setReferenceLibrary] =
    React.useState<ReferenceAsset[]>(seededReferences)
  const [runningJobs, setRunningJobs] = React.useState(0)
  const [videoDraftSource, setVideoDraftSource] =
    React.useState<VideoSource | null>(null)

  const syncRunningJobs = React.useCallback(() => {
    setRunningJobs(pendingRuns.current.size)
  }, [])

  const refreshAccount = React.useCallback(async () => {
    if (!bridge) return
    try {
      setAccount(await bridge.checkCredits())
    } catch (error) {
      toast("Could not refresh Higgsfield credits", {
        description: friendlyError(error),
      })
    }
  }, [bridge])

  React.useEffect(() => {
    if (!bridge || booted.current) return
    booted.current = true
    const higgsfield = bridge

    async function load() {
      const [status, credits, workspaceContext, imageModelRows, videoModelRows] =
        await Promise.allSettled([
          higgsfield.getStatus(),
          higgsfield.checkCredits(),
          higgsfield.checkWorkspace(),
          higgsfield.listModels({ mediaKind: "image" }),
          higgsfield.listModels({ mediaKind: "video" }),
        ])

      if (status.status === "fulfilled") setCliStatus(status.value)
      if (credits.status === "fulfilled") setAccount(credits.value)
      if (workspaceContext.status === "fulfilled") {
        setWorkspace(workspaceContext.value)
      }
      if (imageModelRows.status === "fulfilled") {
        setImageModels(toModelOptions(imageModelRows.value, "image"))
      }
      if (videoModelRows.status === "fulfilled") {
        setVideoModels(toModelOptions(videoModelRows.value, "video"))
      }
    }

    void load()
  }, [bridge])

  React.useEffect(() => {
    if (!bridge) return

    return bridge.onCommandOutput((event) => {
      const pending = pendingRuns.current.get(event.runId)
      if (!pending) return

      if (event.kind === "result") {
        completedRuns.current.add(event.runId)
        applyGenerationResult(pending, event)
      }

      if (event.kind === "exit") {
        const succeeded = event.exitCode === 0 && completedRuns.current.has(event.runId)
        if (!succeeded) markRunFailed(pending, friendlyExit(event))
        pendingRuns.current.delete(event.runId)
        completedRuns.current.delete(event.runId)
        syncRunningJobs()
        void refreshAccount()
      }
    })
  }, [bridge, refreshAccount, syncRunningJobs])

  function applyGenerationResult(
    pending: PendingRun,
    event: HiggsfieldCommandOutputEvent,
  ) {
    const artifact = event.result?.artifacts[0]
    const url = artifactUrl(artifact)
    if (!url) return

    if (pending.kind === "take" && pending.creativeId && pending.takeId) {
      setCreatives((current) =>
        current.map((creative) => {
          if (creative.id !== pending.creativeId) return creative
          const takes = creative.takes.map((take) =>
            take.id === pending.takeId
              ? {
                  ...take,
                  status: "ready" as JobStatus,
                  url,
                  filePath: artifact?.filePath ?? undefined,
                }
              : take,
          )
          const readyTakes = takes.filter((take) => take.status === "ready")
          const selectedTakeId =
            creative.selectedTakeId || readyTakes[0]?.id || pending.takeId || ""
          const selectedTake =
            takes.find((take) => take.id === selectedTakeId) ?? readyTakes[0]
          const stillPending = takes.some((take) => take.status === "pending")
          const hasReady = readyTakes.length > 0

          return {
            ...creative,
            takes,
            selectedTakeId,
            heroUrl: selectedTake?.url ?? creative.heroUrl,
            status: stillPending ? "pending" : hasReady ? "ready" : "failed",
          }
        }),
      )
      return
    }

    if (pending.kind === "placement" && pending.creativeId && pending.placement) {
      setCreatives((current) =>
        current.map((creative) =>
          creative.id === pending.creativeId
            ? {
                ...creative,
                placements: creative.placements.map((placement) =>
                  placement.size === pending.placement
                    ? {
                        ...placement,
                        status: "ready" as JobStatus,
                        url,
                        filePath: artifact?.filePath ?? undefined,
                      }
                    : placement,
                ),
              }
            : creative,
        ),
      )
      return
    }

    if (pending.kind === "video" && pending.videoId) {
      setVideos((current) =>
        current.map((video) =>
          video.id === pending.videoId
            ? {
                ...video,
                status: "ready" as JobStatus,
                url,
                filePath: artifact?.filePath ?? undefined,
              }
            : video,
        ),
      )
    }
  }

  function markRunFailed(pending: PendingRun, error: string) {
    if (pending.kind === "take" && pending.creativeId && pending.takeId) {
      setCreatives((current) =>
        current.map((creative) => {
          if (creative.id !== pending.creativeId) return creative
          const takes = creative.takes.map((take) =>
            take.id === pending.takeId
              ? { ...take, status: "failed" as JobStatus, error }
              : take,
          )
          const stillPending = takes.some((take) => take.status === "pending")
          const hasReady = takes.some((take) => take.status === "ready")
          return {
            ...creative,
            takes,
            status: stillPending ? "pending" : hasReady ? "ready" : "failed",
          }
        }),
      )
      return
    }

    if (pending.kind === "placement" && pending.creativeId && pending.placement) {
      setCreatives((current) =>
        current.map((creative) =>
          creative.id === pending.creativeId
            ? {
                ...creative,
                placements: creative.placements.map((placement) =>
                  placement.size === pending.placement
                    ? { ...placement, status: "failed" as JobStatus, error }
                    : placement,
                ),
              }
            : creative,
        ),
      )
      return
    }

    if (pending.kind === "video" && pending.videoId) {
      setVideos((current) =>
        current.map((video) =>
          video.id === pending.videoId
            ? { ...video, status: "failed" as JobStatus, error }
            : video,
        ),
      )
    }
  }

  async function signIn() {
    if (!bridge) return
    try {
      await bridge.signIn()
      toast("Higgsfield sign-in opened")
    } catch (error) {
      toast("Could not start Higgsfield sign-in", {
        description: friendlyError(error),
      })
    }
  }

  async function chooseReferenceAsset() {
    if (!bridge) {
      toast("Open the desktop app to choose a local reference")
      return
    }

    const asset = await bridge.chooseAsset("image")
    if (!asset) return

    setReferenceLibrary((current) => [
      ...current,
      {
        id: `ref-${Date.now()}`,
        name: asset.fileName,
        url: fileUrl(asset.filePath),
        filePath: asset.filePath,
      },
    ])
  }

  async function chooseVideoSource() {
    if (!bridge) {
      toast("Open the desktop app to choose a local source image")
      return null
    }

    const asset = await bridge.chooseAsset("image")
    if (!asset) return null

    const source = {
      url: fileUrl(asset.filePath),
      filePath: asset.filePath,
      label: asset.fileName,
    }
    setVideoDraftSource(source)
    return source
  }

  async function makeCreative(request: MakeCreativeRequest) {
    if (!(await canGenerate())) return null
    if (!bridge) return null

    const createdAt = new Date().toISOString()
    const id = `creative-${Date.now()}`
    const outputDirectoryName = `${createdAt.slice(0, 10)}-${slug(request.prompt)}`
    const takes = Array.from({ length: 4 }, (_, index) => ({
      id: `${id}-take-${index + 1}`,
      url: "",
      status: "pending" as JobStatus,
    }))
    const reference = request.referenceIds
      .map((refId) => referenceLibrary.find((ref) => ref.id === refId))
      .find((ref) => ref?.filePath)

    setCreatives((current) => [
      {
        id,
        title: titleFromPrompt(request.prompt),
        prompt: request.prompt,
        ratioId: request.ratioId,
        ratioW: request.ratioW,
        ratioH: request.ratioH,
        model: request.model,
        createdAt,
        heroUrl: "",
        status: "pending",
        takes,
        selectedTakeId: "",
        placements: [],
        outputDirectoryName,
      },
      ...current,
    ])

    void Promise.all(
      takes.map(async (take, index) => {
        try {
          const run = await startTrackedGeneration(
            {
              model: request.model,
              prompt: request.prompt,
              mediaKind: "image",
              assetPath: reference?.filePath,
              assetMediaKind: reference?.filePath ? "image" : undefined,
              aspectRatio: nearestHiggsfieldRatio(request.ratioW, request.ratioH),
              outputDirectoryName,
              outputFileName: `take-${index + 1}.png`,
              waitForResult: true,
            },
            { kind: "take", creativeId: id, takeId: take.id },
          )

          setCreatives((current) =>
            current.map((creative) =>
              creative.id === id
                ? {
                    ...creative,
                    takes: creative.takes.map((item) =>
                      item.id === take.id ? { ...item, runId: run.runId } : item,
                    ),
                  }
                : creative,
            ),
          )
        } catch (error) {
          markRunFailed(
            { kind: "take", creativeId: id, takeId: take.id },
            friendlyError(error),
          )
        }
      }),
    )

    return id
  }

  function selectTake(creativeId: string, takeId: string) {
    setCreatives((current) =>
      current.map((creative) => {
        if (creative.id !== creativeId) return creative
        const take = creative.takes.find((item) => item.id === takeId)
        if (!take || take.status !== "ready") return creative

        return {
          ...creative,
          selectedTakeId: takeId,
          heroUrl: take.url,
        }
      }),
    )
  }

  async function generateAllPlacements(creativeId: string) {
    const creative = creatives.find((item) => item.id === creativeId)
    if (!creative || !(await canGenerate()) || !bridge) return
    if (creative.isDemo) {
      toast("Remix the demo before generating new placements")
      return
    }
    const source = selectedTake(creative)

    if (!source?.filePath) {
      toast("Wait for the hero image to finish saving locally first")
      return
    }
    const sourcePath = source.filePath

    setCreatives((current) =>
      current.map((item) =>
        item.id === creativeId
          ? {
              ...item,
              placements: imagePlacements.map((size) => ({
                size,
                status: supportedPlacementAspectRatio(size)
                  ? ("pending" as JobStatus)
                  : ("failed" as JobStatus),
                error: supportedPlacementAspectRatio(size)
                  ? undefined
                  : unsupportedPlacementMessage(size),
              })),
            }
          : item,
      ),
    )

    void Promise.all(
      imagePlacements
        .filter(supportedPlacementAspectRatio)
        .map((size) => startPlacementGeneration(creative, size, sourcePath)),
    )
  }

  async function regeneratePlacement(
    creativeId: string,
    placement: ImagePlacement,
  ) {
    const creative = creatives.find((item) => item.id === creativeId)
    if (!creative || !(await canGenerate()) || !bridge) return
    if (creative.isDemo) {
      toast("Remix the demo before regenerating placements")
      return
    }
    if (!supportedPlacementAspectRatio(placement)) {
      setCreatives((current) =>
        current.map((item) =>
          item.id === creativeId
            ? {
                ...item,
                placements: upsertPlacement(item.placements, {
                  size: placement,
                  status: "failed",
                  error: unsupportedPlacementMessage(placement),
                }),
              }
            : item,
        ),
      )
      toast("That banner size needs a post-process step", {
        description: unsupportedPlacementMessage(placement),
      })
      return
    }
    const source = selectedTake(creative)

    if (!source?.filePath) {
      toast("Wait for the hero image to finish saving locally first")
      return
    }

    setCreatives((current) =>
      current.map((item) =>
        item.id === creativeId
          ? {
              ...item,
              placements: upsertPlacement(item.placements, {
                size: placement,
                status: "pending",
              }),
            }
          : item,
      ),
    )
    void startPlacementGeneration(creative, placement, source.filePath)
  }

  async function startPlacementGeneration(
    creative: Creative,
    placement: ImagePlacement,
    sourcePath: string,
  ) {
    const aspectRatio = supportedPlacementAspectRatio(placement)

    if (!aspectRatio) {
      markRunFailed(
        { kind: "placement", creativeId: creative.id, placement },
        unsupportedPlacementMessage(placement),
      )
      return
    }

    try {
      const run = await startTrackedGeneration(
        {
          model: creative.model,
          prompt: creative.prompt,
          mediaKind: "image",
          assetPath: sourcePath,
          assetMediaKind: "image",
          aspectRatio,
          outputDirectoryName:
            creative.outputDirectoryName ?? `${creative.createdAt.slice(0, 10)}-${slug(creative.prompt)}`,
          outputFileName: `${placement}.png`,
          waitForResult: true,
        },
        { kind: "placement", creativeId: creative.id, placement },
      )

      setCreatives((current) =>
        current.map((item) =>
          item.id === creative.id
            ? {
                ...item,
                placements: item.placements.map((result) =>
                  result.size === placement
                    ? { ...result, runId: run.runId }
                    : result,
                ),
              }
            : item,
        ),
      )
    } catch (error) {
      markRunFailed(
        { kind: "placement", creativeId: creative.id, placement },
        friendlyError(error),
      )
    }
  }

  async function openOutput(target?: string | null) {
    if (!target || !bridge) {
      toast("No local output is available yet")
      return
    }

    const opened = await bridge.openOutput({ target })
    if (!opened) {
      toast("Could not open that output")
    }
  }

  async function makeVideos(request: MakeVideosRequest) {
    if (!(await canGenerate()) || !bridge) return
    if (!request.source.filePath) {
      toast("Choose a local source image before animating")
      return
    }

    const createdAt = new Date().toISOString()
    const outputDirectoryName = `${createdAt.slice(0, 10)}-${slug(request.prompt)}`

    setVideos((current) => [
      ...request.sizes.map((size) => ({
        id: `video-${Date.now()}-${size}`,
        size,
        status: "pending" as JobStatus,
        posterUrl: request.source.url,
        prompt: request.prompt,
        sourceCreativeId: request.source.creativeId,
        sourceTitle: request.source.label,
        createdAt,
      })),
      ...current,
    ])

    void Promise.all(
      request.sizes.map(async (size) => {
        const videoId = `video-${Date.now()}-${size}`
        const spec = placementSpecs[size]

        setVideos((current) =>
          current.map((video) =>
            video.size === size &&
            video.prompt === request.prompt &&
            video.createdAt === createdAt
              ? { ...video, id: videoId }
              : video,
          ),
        )

        try {
          const run = await startTrackedGeneration(
            {
              model: request.model,
              prompt: request.prompt,
              mediaKind: "video",
              assetPath: request.source.filePath,
              assetMediaKind: "image",
              aspectRatio: nearestHiggsfieldRatio(spec.width, spec.height),
              outputDirectoryName,
              outputFileName: `${size}.mp4`,
              waitForResult: true,
            },
            { kind: "video", videoId },
          )

          setVideos((current) =>
            current.map((video) =>
              video.id === videoId ? { ...video, runId: run.runId } : video,
            ),
          )
        } catch (error) {
          markRunFailed({ kind: "video", videoId }, friendlyError(error))
        }
      }),
    )
  }

  async function startTrackedGeneration(
    request: HiggsfieldGenerateRequest,
    pending: PendingRun,
  ) {
    if (!bridge) throw new Error("Open the desktop app to generate.")
    const run = await bridge.generate(request)
    pendingRuns.current.set(run.runId, pending)
    syncRunningJobs()
    return run
  }

  async function canGenerate() {
    if (!bridge) {
      toast("Open the desktop app to generate with Higgsfield")
      return false
    }

    if (account?.credits != null && account.credits <= 0) {
      toast("Your Higgsfield credits are at zero", {
        description: "Top up in Higgsfield before generating.",
        action: {
          label: "Top up",
          onClick: () => void bridge.openOutput({ target: BILLING_URL }),
        },
      })
      return false
    }

    return true
  }

  const value = React.useMemo<HiggsfieldAppValue>(
    () => ({
      account,
      cliStatus,
      workspace,
      imageModels,
      videoModels,
      creatives,
      demoCreative,
      videos,
      referenceLibrary,
      runningJobs,
      videoDraftSource,
      refreshAccount,
      signIn,
      chooseReferenceAsset,
      chooseVideoSource,
      setVideoDraftSource,
      makeCreative,
      selectTake,
      generateAllPlacements,
      regeneratePlacement,
      openOutput,
      makeVideos,
      creativeById: (id) => creatives.find((creative) => creative.id === id),
    }),
    [
      account,
      cliStatus,
      workspace,
      imageModels,
      videoModels,
      creatives,
      videos,
      referenceLibrary,
      runningJobs,
      videoDraftSource,
      refreshAccount,
    ],
  )

  return (
    <HiggsfieldAppContext.Provider value={value}>
      {children}
    </HiggsfieldAppContext.Provider>
  )
}

export function useHiggsfieldApp() {
  const value = React.useContext(HiggsfieldAppContext)
  if (!value) {
    throw new Error("useHiggsfieldApp must be used inside HiggsfieldProvider.")
  }

  return value
}

function getHiggsfieldBridge() {
  return typeof window === "undefined" ? undefined : window.kreeyts?.higgsfield
}

function toModelOptions(
  models: HiggsfieldModel[],
  mediaKind: HiggsfieldMediaKind,
): ModelOption[] {
  const filtered = models.filter((model) => model.mediaKind === mediaKind)
  const normalized = filtered.length > 0 ? filtered : models

  return normalized.map((model) => ({
    id: model.id,
    label: model.label,
    hint: model.hint,
  }))
}

function selectedTake(creative: Creative) {
  return (
    creative.takes.find((take) => take.id === creative.selectedTakeId) ??
    creative.takes.find((take) => take.status === "ready")
  )
}

function upsertPlacement(
  placements: PlacementResult[],
  next: PlacementResult,
) {
  const found = placements.some((placement) => placement.size === next.size)
  return found
    ? placements.map((placement) =>
        placement.size === next.size ? next : placement,
      )
    : [...placements, next]
}

function artifactUrl(artifact?: HiggsfieldGeneratedArtifact) {
  if (!artifact) return null
  if (artifact.filePath) return fileUrl(artifact.filePath)
  return artifact.url
}

function fileUrl(filePath: string) {
  if (filePath.startsWith("file://")) return filePath
  return encodeURI(`file://${filePath}`)
}

function friendlyError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return "Higgsfield could not finish that request. Try again in a moment."
}

function friendlyExit(event: HiggsfieldCommandOutputEvent) {
  if (event.signal) return "Generation was stopped."
  if (event.exitCode === 0) return "Higgsfield finished without returning an output."
  return "Higgsfield could not generate this output."
}

function titleFromPrompt(prompt: string) {
  const trimmed = prompt.trim().replace(/\s+/g, " ")
  if (trimmed.length <= 42) return trimmed
  return `${trimmed.slice(0, 42).trim()}...`
}

function slug(value: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  return safe || "creative"
}

const HIGGSFIELD_RATIOS = [
  { id: "1:1", value: 1 },
  { id: "3:2", value: 3 / 2 },
  { id: "2:3", value: 2 / 3 },
  { id: "4:3", value: 4 / 3 },
  { id: "3:4", value: 3 / 4 },
  { id: "4:5", value: 4 / 5 },
  { id: "5:4", value: 5 / 4 },
  { id: "9:16", value: 9 / 16 },
  { id: "16:9", value: 16 / 9 },
  { id: "21:9", value: 21 / 9 },
]

function nearestHiggsfieldRatio(width: number, height: number) {
  const ratio = width / height
  return HIGGSFIELD_RATIOS.reduce((best, next) => {
    const currentDistance = Math.abs(Math.log(ratio / best.value))
    const nextDistance = Math.abs(Math.log(ratio / next.value))
    return nextDistance < currentDistance ? next : best
  }).id
}

function supportedPlacementAspectRatio(placement: ImagePlacement) {
  const spec = placementSpecs[placement]
  const targetRatio = spec.width / spec.height
  const ratio = nearestHiggsfieldRatio(spec.width, spec.height)
  const supportedRatio =
    HIGGSFIELD_RATIOS.find((item) => item.id === ratio)?.value ?? targetRatio
  const relativeDrift = Math.abs(Math.log(targetRatio / supportedRatio))

  return relativeDrift > 0.35 ? null : ratio
}

function unsupportedPlacementMessage(placement: ImagePlacement) {
  return `${placement} is wider than Higgsfield's supported generation ratios. It needs an exact-size post-process step before we should spend credits on it.`
}
