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
  HiggsfieldModelDetails,
  HiggsfieldWorkspaceContext,
  KreeytsLibrarySnapshot,
  KreeytsPromptKind,
  KreeytsPromptPreset,
  KreeytsSettings,
} from "@kreeyts/desktop-bridge"

import {
  baseRatios,
  imagePlacements,
  placementSpecs,
  type ImagePlacement,
  type VideoPlacement,
} from "@/lib/placements"
import {
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

export interface Creative extends Omit<SeedCreative, "takes" | "placements"> {
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

export type PromptPreset = KreeytsPromptPreset

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
  videos: VideoResult[]
  referenceLibrary: ReferenceAsset[]
  imagePrompts: PromptPreset[]
  videoPrompts: PromptPreset[]
  settings: KreeytsSettings | null
  runningJobs: number
  videoDraftSource: VideoSource | null
  refreshAccount: () => Promise<void>
  signIn: () => Promise<void>
  chooseReferenceAsset: () => Promise<void>
  chooseVideoSource: () => Promise<VideoSource | null>
  chooseOutputRoot: () => Promise<void>
  revealOutputRoot: () => Promise<void>
  savePromptPreset: (kind: KreeytsPromptKind, body: string) => void
  deletePromptPreset: (id: string) => void
  getModelAspectRatios: (
    model: string,
    mediaKind: HiggsfieldMediaKind,
  ) => Promise<string[]>
  setVideoDraftSource: (source: VideoSource | null) => void
  makeCreative: (request: MakeCreativeRequest) => Promise<string | null>
  selectTake: (creativeId: string, takeId: string) => void
  generateAllPlacements: (creativeId: string) => Promise<void>
  regeneratePlacement: (
    creativeId: string,
    placement: ImagePlacement,
  ) => Promise<void>
  openOutput: (target?: string | null) => Promise<void>
  exportCreativeZip: (creativeId: string) => Promise<void>
  makeVideos: (request: MakeVideosRequest) => Promise<void>
  creativeById: (id: string) => Creative | undefined
}

const HiggsfieldAppContext = React.createContext<HiggsfieldAppValue | null>(
  null,
)

const seededReferences = seededReferenceLibrary as ReferenceAsset[]
const shippedImagePrompts = imagePromptLibrary.map((prompt) => ({
  ...prompt,
  kind: "image" as const,
  createdAt: "shipped",
}))
const shippedVideoPrompts = videoPromptLibrary.map((prompt) => ({
  ...prompt,
  kind: "video" as const,
  createdAt: "shipped",
}))
const BILLING_URL = "https://higgsfield.ai/billing"

export function HiggsfieldProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const desktopBridge = getDesktopBridge()
  const bridge = desktopBridge?.higgsfield
  const libraryBridge = desktopBridge?.library
  const pendingRuns = React.useRef(new Map<string, PendingRun>())
  const completedRuns = React.useRef(new Set<string>())
  const modelDetailsCache = React.useRef(
    new Map<string, HiggsfieldModelDetails>(),
  )
  const signInRun = React.useRef<string | null>(null)
  const booted = React.useRef(false)

  const [account, setAccount] = React.useState<HiggsfieldAccountStatus | null>(
    null,
  )
  const [cliStatus, setCliStatus] = React.useState<HiggsfieldCliStatus | null>(
    null,
  )
  const [workspace, setWorkspace] =
    React.useState<HiggsfieldWorkspaceContext | null>(null)
  const [imageModels, setImageModels] =
    React.useState<ModelOption[]>(fallbackImageModels)
  const [videoModels, setVideoModels] =
    React.useState<ModelOption[]>(fallbackVideoModels)
  const [creatives, setCreatives] = React.useState<Creative[]>([])
  const [videos, setVideos] = React.useState<VideoResult[]>([])
  const [referenceLibrary, setReferenceLibrary] =
    React.useState<ReferenceAsset[]>(seededReferences)
  const [customPrompts, setCustomPrompts] = React.useState<PromptPreset[]>([])
  const [settings, setSettings] = React.useState<KreeytsSettings | null>(null)
  const [localStateReady, setLocalStateReady] = React.useState(!libraryBridge)
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

  const refreshSession = React.useCallback(async () => {
    if (!bridge) return

    const [status, credits, workspaceContext] = await Promise.allSettled([
      bridge.getStatus(),
      bridge.checkCredits(),
      bridge.checkWorkspace(),
    ])

    if (status.status === "fulfilled") setCliStatus(status.value)
    if (credits.status === "fulfilled") setAccount(credits.value)
    if (workspaceContext.status === "fulfilled") {
      setWorkspace(workspaceContext.value)
    }
  }, [bridge])

  React.useEffect(() => {
    if ((!bridge && !libraryBridge) || booted.current) return
    booted.current = true
    const higgsfield = bridge
    const library = libraryBridge

    async function load() {
      if (library) {
        const [snapshot, storedSettings] = await Promise.allSettled([
          library.loadSnapshot(),
          library.getSettings(),
        ])

        if (snapshot.status === "fulfilled" && snapshot.value) {
          restoreSnapshot(snapshot.value)
        }
        if (storedSettings.status === "fulfilled") {
          setSettings(storedSettings.value)
        }
        setLocalStateReady(true)
      }

      if (!higgsfield) return

      const [
        status,
        credits,
        workspaceContext,
        imageModelRows,
        videoModelRows,
      ] = await Promise.allSettled([
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
  }, [bridge, libraryBridge])

  React.useEffect(() => {
    if (!bridge) return

    return bridge.onCommandOutput((event) => {
      if (event.runId === signInRun.current && event.kind === "exit") {
        signInRun.current = null
        if (event.exitCode === 0) {
          void refreshSession()
        }
      }

      const pending = pendingRuns.current.get(event.runId)
      if (!pending) return

      if (event.kind === "result") {
        completedRuns.current.add(event.runId)
        applyGenerationResult(pending, event)
      }

      if (event.kind === "exit") {
        const succeeded =
          event.exitCode === 0 && completedRuns.current.has(event.runId)
        if (!succeeded) markRunFailed(pending, friendlyExit(event))
        pendingRuns.current.delete(event.runId)
        completedRuns.current.delete(event.runId)
        syncRunningJobs()
        void refreshAccount()
      }
    })
  }, [bridge, refreshAccount, refreshSession, syncRunningJobs])

  React.useEffect(() => {
    if (!libraryBridge || !localStateReady) return

    const snapshot = createSnapshot(
      creatives,
      videos,
      referenceLibrary,
      customPrompts,
    )
    const timeout = window.setTimeout(() => {
      void libraryBridge.saveSnapshot(snapshot)
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [
    libraryBridge,
    localStateReady,
    creatives,
    videos,
    referenceLibrary,
    customPrompts,
  ])

  function restoreSnapshot(snapshot: KreeytsLibrarySnapshot) {
    setCreatives(snapshot.creatives as Creative[])
    setVideos(snapshot.videos as VideoResult[])
    setReferenceLibrary(
      snapshot.referenceLibrary.length
        ? (snapshot.referenceLibrary as ReferenceAsset[])
        : seededReferences,
    )
    setCustomPrompts(snapshot.customPrompts)
  }

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

    if (
      pending.kind === "placement" &&
      pending.creativeId &&
      pending.placement
    ) {
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

    if (
      pending.kind === "placement" &&
      pending.creativeId &&
      pending.placement
    ) {
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
      const run = await bridge.signIn()
      signInRun.current = run.runId
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

  async function chooseOutputRoot() {
    if (!libraryBridge) return
    const result = await libraryBridge.chooseOutputRoot()
    if (!result) return
    setSettings({ outputRoot: result.outputRoot })
    toast("Kreeyts library folder updated", {
      description: result.outputRoot,
    })
  }

  async function revealOutputRoot() {
    if (!libraryBridge) return
    const opened = await libraryBridge.revealOutputRoot()
    if (!opened) toast("Could not open the Kreeyts library folder")
  }

  function savePromptPreset(kind: KreeytsPromptKind, body: string) {
    const trimmed = body.trim()
    if (trimmed.length < 3) return
    const preset: PromptPreset = {
      id: `prompt-${kind}-${Date.now()}`,
      kind,
      title: titleFromPrompt(trimmed),
      body: trimmed,
      createdAt: new Date().toISOString(),
    }
    setCustomPrompts((current) => [preset, ...current])
    toast("Saved prompt")
  }

  function deletePromptPreset(id: string) {
    setCustomPrompts((current) => current.filter((prompt) => prompt.id !== id))
  }

  async function getModelAspectRatios(
    model: string,
    mediaKind: HiggsfieldMediaKind,
  ) {
    if (!bridge || !model) return fallbackAspectRatios(mediaKind)
    const cached = modelDetailsCache.current.get(model)
    if (cached) return cached.aspectRatios

    try {
      const details = await bridge.getModelDetails({ model, mediaKind })
      modelDetailsCache.current.set(model, details)
      return details.aspectRatios.length
        ? details.aspectRatios
        : fallbackAspectRatios(mediaKind)
    } catch {
      return fallbackAspectRatios(mediaKind)
    }
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
    const references = request.referenceIds
      .map((refId) => referenceLibrary.find((ref) => ref.id === refId))
      .filter((ref): ref is ReferenceAsset => Boolean(ref?.filePath))
      .slice(0, 5)
    const aspectRatios = await getModelAspectRatios(request.model, "image")

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
              assetPaths: references.flatMap((reference) =>
                reference.filePath ? [reference.filePath] : [],
              ),
              assetMediaKind: references.length ? "image" : undefined,
              aspectRatio: nearestHiggsfieldRatio(
                request.ratioW,
                request.ratioH,
                aspectRatios,
              ),
              outputDirectoryName,
              outputFileName: `take-${index + 1}.png`,
              outputSize: { width: request.ratioW, height: request.ratioH },
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
                      item.id === take.id
                        ? { ...item, runId: run.runId }
                        : item,
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
                status: "pending" as JobStatus,
              })),
            }
          : item,
      ),
    )

    void Promise.all(
      imagePlacements.map((size) =>
        startPlacementGeneration(creative, size, sourcePath),
      ),
    )
  }

  async function regeneratePlacement(
    creativeId: string,
    placement: ImagePlacement,
  ) {
    const creative = creatives.find((item) => item.id === creativeId)
    if (!creative || !(await canGenerate()) || !bridge) return
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
    const spec = placementSpecs[placement]
    const aspectRatios = await getModelAspectRatios(creative.model, "image")
    const aspectRatio = nearestHiggsfieldRatio(
      spec.width,
      spec.height,
      aspectRatios,
    )

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
            creative.outputDirectoryName ??
            `${creative.createdAt.slice(0, 10)}-${slug(creative.prompt)}`,
          outputFileName: `${placement}.png`,
          outputSize: { width: spec.width, height: spec.height },
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

  async function exportCreativeZip(creativeId: string) {
    if (!libraryBridge) {
      toast("Open the desktop app to export a ZIP")
      return
    }

    const creative = creatives.find((item) => item.id === creativeId)
    if (!creative) return

    const readyFiles = [
      ...creative.takes
        .filter((take) => take.status === "ready" && take.filePath)
        .map((take, index) => ({
          path: take.filePath!,
          name: `take-${index + 1}.png`,
        })),
      ...creative.placements
        .filter((placement) =>
          Boolean(placement.status === "ready" && placement.filePath),
        )
        .map((placement) => ({
          path: placement.filePath!,
          name: `${placement.size}.png`,
        })),
    ]

    if (readyFiles.length === 0) {
      toast("No local files are ready to export yet")
      return
    }

    const result = await libraryBridge.exportCreativeZip({
      title: creative.title,
      outputDirectoryName: creative.outputDirectoryName,
      files: readyFiles,
    })

    if (result) {
      toast("ZIP exported", { description: result.filePath })
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
    const queuedVideos = request.sizes.map((size) => ({
      id: `video-${Date.now()}-${size}-${Math.random().toString(36).slice(2, 8)}`,
      size,
      status: "pending" as JobStatus,
      posterUrl: request.source.url,
      prompt: request.prompt,
      sourceCreativeId: request.source.creativeId,
      sourceTitle: request.source.label,
      createdAt,
    }))
    const aspectRatios = await getModelAspectRatios(request.model, "video")

    setVideos((current) => [...queuedVideos, ...current])

    void Promise.all(
      queuedVideos.map(async (video) => {
        const size = video.size
        const videoId = video.id
        const spec = placementSpecs[size]

        try {
          const run = await startTrackedGeneration(
            {
              model: request.model,
              prompt: request.prompt,
              mediaKind: "video",
              assetPath: request.source.filePath,
              assetMediaKind: "image",
              aspectRatio: nearestHiggsfieldRatio(
                spec.width,
                spec.height,
                aspectRatios,
              ),
              outputDirectoryName,
              outputFileName: `${size}.mp4`,
              outputSize: { width: spec.width, height: spec.height },
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

    if (cliStatus?.authStatus === "unauthenticated") {
      toast("Sign in to Higgsfield before generating", {
        action: {
          label: "Sign in",
          onClick: () => void signIn(),
        },
      })
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
      videos,
      referenceLibrary,
      imagePrompts: [
        ...shippedImagePrompts,
        ...customPrompts.filter((prompt) => prompt.kind === "image"),
      ],
      videoPrompts: [
        ...shippedVideoPrompts,
        ...customPrompts.filter((prompt) => prompt.kind === "video"),
      ],
      settings,
      runningJobs,
      videoDraftSource,
      refreshAccount,
      signIn,
      chooseReferenceAsset,
      chooseVideoSource,
      chooseOutputRoot,
      revealOutputRoot,
      savePromptPreset,
      deletePromptPreset,
      getModelAspectRatios,
      setVideoDraftSource,
      makeCreative,
      selectTake,
      generateAllPlacements,
      regeneratePlacement,
      openOutput,
      exportCreativeZip,
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
      customPrompts,
      settings,
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

function getDesktopBridge() {
  return typeof window === "undefined" ? undefined : window.kreeyts
}

function getHiggsfieldBridge() {
  return getDesktopBridge()?.higgsfield
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

function createSnapshot(
  creatives: Creative[],
  videos: VideoResult[],
  referenceLibrary: ReferenceAsset[],
  customPrompts: PromptPreset[],
): KreeytsLibrarySnapshot {
  return {
    schemaVersion: 1,
    creatives,
    videos,
    referenceLibrary,
    customPrompts,
    savedAt: new Date().toISOString(),
  }
}

function selectedTake(creative: Creative) {
  return (
    creative.takes.find((take) => take.id === creative.selectedTakeId) ??
    creative.takes.find((take) => take.status === "ready")
  )
}

function upsertPlacement(placements: PlacementResult[], next: PlacementResult) {
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

  const normalized = filePath.replace(/\\/g, "/")
  if (/^[A-Za-z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`)
  }
  if (normalized.startsWith("//")) {
    return encodeURI(`file:${normalized}`)
  }

  return encodeURI(`file://${normalized}`)
}

function friendlyError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  return "Higgsfield could not finish that request. Try again in a moment."
}

function friendlyExit(event: HiggsfieldCommandOutputEvent) {
  if (event.signal) return "Generation was stopped."
  if (event.exitCode === 0)
    return "Higgsfield finished without returning an output."
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
  { id: "9:21", value: 9 / 21 },
  { id: "300:157", value: 300 / 157 },
  { id: "364:45", value: 364 / 45 },
  { id: "32:5", value: 32 / 5 },
] as const

function nearestHiggsfieldRatio(
  width: number,
  height: number,
  supportedRatios = fallbackAspectRatios("image"),
) {
  const ratio = width / height
  const candidates = supportedRatios
    .flatMap((id) => {
      const value = ratioValue(id)
      return value ? [{ id, value }] : []
    })
    .filter((candidate) => candidate.id !== "auto")
  const ratios = candidates.length
    ? candidates
    : HIGGSFIELD_RATIOS.filter((item) =>
        fallbackAspectRatios("image").includes(item.id),
      )

  return ratios.reduce((best, next) => {
    const currentDistance = Math.abs(Math.log(ratio / best.value))
    const nextDistance = Math.abs(Math.log(ratio / next.value))
    return nextDistance < currentDistance ? next : best
  }).id
}

function fallbackAspectRatios(mediaKind: HiggsfieldMediaKind) {
  if (mediaKind === "video") return ["16:9", "9:16", "1:1", "4:3", "3:4"]
  return baseRatios
    .map((ratio) => ratio.id)
    .filter((ratio) => ratio !== "1.91:1")
}

function ratioValue(id: string) {
  const known = HIGGSFIELD_RATIOS.find((ratio) => ratio.id === id)?.value
  if (known) return known

  const match = id.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) {
    return null
  }

  return width / height
}
