import * as React from "react"
import { toast } from "sonner"
import type {
  HiggsfieldAccountStatus,
  HiggsfieldCliStatus,
  HiggsfieldGenerateRequest,
  HiggsfieldMediaKind,
} from "@assetwell/desktop-bridge"

import {
  IMAGE_PLACEMENT_UNAVAILABLE_TOAST,
  availableImagePlacements,
  isNarrowBannerPlacement,
  isUnavailableImagePlacement,
  placementSpecs,
  type ImagePlacement,
} from "@/lib/placements"

import {
  BILLING_URL,
  BASE_CREATIVE_TAKE_COUNT,
  DEFAULT_VIDEO_MODEL,
  NARROW_BANNER_PLACEMENT_MODEL,
  NARROW_BANNER_SOURCE_ASPECT_RATIO,
  VIDEO_FRAME_PLACEMENT_MODEL,
} from "./constants"
import {
  buildNarrowBannerPlacementPrompt,
  buildPlacementPrompt,
  buildVideoFramePrompt,
} from "./generation-prompts"
import { selectedTake, upsertPlacement } from "./local-state"
import {
  matchesHiggsfieldRatio,
  nearestHiggsfieldRatio,
} from "./model-aspect-ratios"
import { friendlyError, slug, titleFromPrompt } from "./text"
import type {
  Creative,
  HiggsfieldBridge,
  LibraryBridge,
  MakeCreativeRequest,
  MakeVideosRequest,
  PendingRun,
  ReferenceAsset,
  VideoResult,
} from "./types"
import type { JobStatus } from "./types"
import { needsVideoReframe, videoFrameOutputSize } from "./video-frame"

export type CreativeReferenceAssetSnapshot = Pick<
  ReferenceAsset,
  | "id"
  | "name"
  | "url"
  | "filePath"
  | "uploadId"
  | "mediaKind"
  | "createdAt"
  | "source"
  | "sizeBytes"
  | "modifiedAt"
>

export function snapshotCreativeReferences(
  referenceIds: string[],
  library: ReferenceAsset[],
): CreativeReferenceAssetSnapshot[] {
  return referenceIds
    .map((refId) => library.find((reference) => reference.id === refId))
    .flatMap((reference) => {
      if (!reference?.filePath && !reference?.uploadId) return []
      return [
        {
          id: reference.id,
          name: reference.name,
          url: reference.url,
          filePath: reference.filePath,
          uploadId: reference.uploadId,
          mediaKind: reference.mediaKind,
          createdAt: reference.createdAt,
          source: reference.source,
          sizeBytes: reference.sizeBytes,
          modifiedAt: reference.modifiedAt,
        },
      ]
    })
    .slice(0, 5)
}

interface UseHiggsfieldGenerationActionsRequest {
  bridge?: HiggsfieldBridge
  libraryBridge?: LibraryBridge
  account: HiggsfieldAccountStatus | null
  cliStatus: HiggsfieldCliStatus | null
  creatives: Creative[]
  videos: VideoResult[]
  referenceLibrary: ReferenceAsset[]
  activeUploadWorkspaceId: string
  setCreatives: React.Dispatch<React.SetStateAction<Creative[]>>
  setVideos: React.Dispatch<React.SetStateAction<VideoResult[]>>
  pendingRuns: React.MutableRefObject<Map<string, PendingRun>>
  syncRunningJobs: () => void
  getModelAspectRatios: (
    model: string,
    mediaKind: HiggsfieldMediaKind,
  ) => Promise<string[]>
  markRunFailed: (pending: PendingRun, error: string) => void
  signIn: () => Promise<void>
}

export function useHiggsfieldGenerationActions({
  bridge,
  libraryBridge,
  account,
  cliStatus,
  creatives,
  videos,
  referenceLibrary,
  activeUploadWorkspaceId,
  setCreatives,
  setVideos,
  pendingRuns,
  syncRunningJobs,
  getModelAspectRatios,
  markRunFailed,
  signIn,
}: UseHiggsfieldGenerationActionsRequest) {
  const canGenerate = React.useCallback(async () => {
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
  }, [account?.credits, bridge, cliStatus?.authStatus, signIn])

  const startTrackedGeneration = React.useCallback(
    async (request: HiggsfieldGenerateRequest, pending: PendingRun) => {
      if (!bridge) throw new Error("Open the desktop app to generate.")
      const run = await bridge.generate(request)
      pendingRuns.current.set(run.runId, pending)
      syncRunningJobs()
      return run
    },
    [bridge, pendingRuns, syncRunningJobs],
  )

  const makeCreative = React.useCallback(
    async (request: MakeCreativeRequest) => {
      if (!(await canGenerate())) return null
      if (!bridge) return null

      const createdAt = new Date().toISOString()
      const id = `creative-${Date.now()}`
      const outputDirectoryName = `${createdAt.slice(0, 10)}-${slug(request.prompt)}`
      const takes = Array.from(
        { length: BASE_CREATIVE_TAKE_COUNT },
        (_, index) => ({
          id: `${id}-take-${index + 1}`,
          url: "",
          status: "pending" as JobStatus,
        }),
      )
      const references = snapshotCreativeReferences(
        request.referenceIds,
        referenceLibrary,
      )
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
          referenceAssets: references,
          uploadWorkspaceId: activeUploadWorkspaceId,
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
                assetPaths: references.flatMap((reference) => {
                  const mediaReference =
                    reference.uploadId ?? reference.filePath
                  return mediaReference ? [mediaReference] : []
                }),
                assetMediaKind: references.length ? "image" : undefined,
                aspectRatio: nearestHiggsfieldRatio(
                  request.ratioW,
                  request.ratioH,
                  aspectRatios,
                ),
                uploadWorkspaceId: activeUploadWorkspaceId,
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
    },
    [
      activeUploadWorkspaceId,
      bridge,
      canGenerate,
      getModelAspectRatios,
      markRunFailed,
      referenceLibrary,
      setCreatives,
      startTrackedGeneration,
    ],
  )

  const selectTake = React.useCallback(
    (creativeId: string, takeId: string) => {
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
    },
    [setCreatives],
  )

  const startPlacementGeneration = React.useCallback(
    async (
      creative: Creative,
      placement: ImagePlacement,
      sourcePath: string,
    ) => {
      const spec = placementSpecs[placement]
      const isNarrowBanner = isNarrowBannerPlacement(placement)

      try {
        const outputDirectoryName =
          creative.outputDirectoryName ??
          `${creative.createdAt.slice(0, 10)}-${slug(creative.prompt)}`
        const aspectRatio = isNarrowBanner
          ? NARROW_BANNER_SOURCE_ASPECT_RATIO
          : nearestHiggsfieldRatio(
              spec.width,
              spec.height,
              await getModelAspectRatios(creative.model, "image"),
            )

        console.log({ NARROW_BANNER_PLACEMENT_MODEL })

        const run = await startTrackedGeneration(
          {
            model: isNarrowBanner
              ? NARROW_BANNER_PLACEMENT_MODEL
              : creative.model,
            prompt: isNarrowBanner
              ? buildNarrowBannerPlacementPrompt({
                  originalPrompt: creative.prompt,
                  placement,
                  sourceAspectRatio: NARROW_BANNER_SOURCE_ASPECT_RATIO,
                })
              : buildPlacementPrompt({
                  originalPrompt: creative.prompt,
                  placement,
                  aspectRatio: spec.aspectRatio,
                }),
            mediaKind: "image",
            assetPath: sourcePath,
            assetMediaKind: "image",
            aspectRatio,
            uploadWorkspaceId: creative.uploadWorkspaceId,
            outputDirectoryName,
            outputFileName: `${placement}.png`,
            outputSize: { width: spec.width, height: spec.height },
            outputCrop: isNarrowBanner ? "top" : undefined,
            waitForResult: true,
          },
          {
            kind: "placement",
            creativeId: creative.id,
            placement,
          },
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
    },
    [getModelAspectRatios, markRunFailed, setCreatives, startTrackedGeneration],
  )

  const generateAllPlacements = React.useCallback(
    async (creativeId: string) => {
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
                placements: availableImagePlacements.map((size) => ({
                  size,
                  status: "pending" as JobStatus,
                })),
              }
            : item,
        ),
      )

      void Promise.all(
        availableImagePlacements.map((size) =>
          startPlacementGeneration(creative, size, sourcePath),
        ),
      )
    },
    [bridge, canGenerate, creatives, setCreatives, startPlacementGeneration],
  )

  const regeneratePlacement = React.useCallback(
    async (creativeId: string, placement: ImagePlacement) => {
      const creative = creatives.find((item) => item.id === creativeId)
      if (!creative || !(await canGenerate()) || !bridge) return

      if (isUnavailableImagePlacement(placement)) {
        toast(IMAGE_PLACEMENT_UNAVAILABLE_TOAST)
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
    },
    [bridge, canGenerate, creatives, setCreatives, startPlacementGeneration],
  )

  const openOutput = React.useCallback(
    async (target?: string | null) => {
      if (!target || !bridge) {
        toast("No local output is available yet")
        return
      }

      const opened = await bridge.openOutput({ target })
      if (!opened) {
        toast("Could not open that output")
      }
    },
    [bridge],
  )

  const exportCreativeZip = React.useCallback(
    async (creativeId: string) => {
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
          .filter(
            (placement) =>
              placement.status === "ready" &&
              placement.filePath &&
              !isUnavailableImagePlacement(placement.size),
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
        uploadWorkspaceId: creative.uploadWorkspaceId,
        outputDirectoryName: creative.outputDirectoryName,
        files: readyFiles,
      })

      if (result) {
        toast("ZIP exported", { description: result.filePath })
      }
    },
    [creatives, libraryBridge],
  )

  const exportVideo = React.useCallback(
    async (videoId: string) => {
      if (!libraryBridge) {
        toast("Open the desktop app to download videos")
        return
      }

      const video = videos.find((item) => item.id === videoId)
      if (!video) return

      if (video.status !== "ready" || !video.filePath) {
        toast("No local video is ready to download yet")
        return
      }

      const result = await libraryBridge.exportVideo({
        path: video.filePath,
        title: `${titleFromPrompt(video.prompt)}-${video.size}`,
        uploadWorkspaceId: video.uploadWorkspaceId,
      })

      if (result) {
        toast("Video downloaded", { description: result.filePath })
      }
    },
    [libraryBridge, videos],
  )

  const makeVideos = React.useCallback(
    async (request: MakeVideosRequest) => {
      if (!(await canGenerate()) || !bridge) return
      const sourcePath = request.source.filePath
      if (!sourcePath) {
        toast("Choose a local source image before animating")
        return
      }

      const createdAt = new Date().toISOString()
      const outputDirectoryName = `${createdAt.slice(0, 10)}-${slug(request.prompt)}`
      const groupId =
        request.groupId ??
        `video-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const aspectRatios = await getModelAspectRatios(request.model, "video")
      const queuedVideos = request.sizes.map((size) => {
        const spec = placementSpecs[size]
        const nativeAspectRatio = nearestHiggsfieldRatio(
          spec.width,
          spec.height,
          aspectRatios,
        )
        const modelNeedsProtection = !matchesHiggsfieldRatio(
          spec.width,
          spec.height,
          nativeAspectRatio,
        )
        const reframe = needsVideoReframe(request.source, spec)
        const sourceCompositionProtected = modelNeedsProtection || reframe

        return {
          id: `video-${Date.now()}-${size}-${Math.random().toString(36).slice(2, 8)}`,
          size,
          status: "pending" as JobStatus,
          posterUrl: request.source.url,
          prompt: request.prompt,
          sourceCreativeId: request.source.creativeId,
          sourceTitle: request.source.label,
          sourceFilePath: sourcePath,
          model: request.model,
          groupId,
          nativeAspectRatio,
          sourceCompositionProtected,
          sourceWidth: request.source.width,
          sourceHeight: request.source.height,
          createdAt,
          durationSeconds: request.durationSeconds,
          uploadWorkspaceId: activeUploadWorkspaceId,
          stage: reframe ? ("framing" as const) : ("animating" as const),
        }
      })

      setVideos((current) => [...queuedVideos, ...current])

      async function startVideoRun(
        video: (typeof queuedVideos)[number],
        assetPath: string,
        protectSourceComposition: boolean,
      ) {
        const size = video.size
        const videoId = video.id
        const spec = placementSpecs[size]

        try {
          const run = await startTrackedGeneration(
            {
              model: request.model,
              prompt: request.prompt,
              mediaKind: "video",
              assetPath,
              assetMediaKind: "image",
              aspectRatio: video.nativeAspectRatio,
              durationSeconds: request.durationSeconds,
              videoQuality:
                request.model === DEFAULT_VIDEO_MODEL ? "standard" : undefined,
              videoSound:
                request.model === DEFAULT_VIDEO_MODEL ? false : undefined,
              uploadWorkspaceId: activeUploadWorkspaceId,
              outputDirectoryName,
              outputFileName: `${size}.mp4`,
              outputSize: { width: spec.width, height: spec.height },
              protectSourceComposition,
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
      }

      void Promise.all(
        queuedVideos.map(async (video) => {
          const spec = placementSpecs[video.size]
          if (video.stage !== "framing") {
            await startVideoRun(
              video,
              sourcePath,
              video.sourceCompositionProtected,
            )
            return
          }

          const sourceCreative = request.source.creativeId
            ? creatives.find((item) => item.id === request.source.creativeId)
            : undefined
          const frameModel =
            sourceCreative?.model ?? VIDEO_FRAME_PLACEMENT_MODEL
          // After reframing, the frame already matches the target ratio; blur-fill is
          // only still needed when the video model has no native ratio for the target.
          const frameStillNeedsProtection = !matchesHiggsfieldRatio(
            spec.width,
            spec.height,
            video.nativeAspectRatio,
          )
          // A result followed by a non-zero exit fires both callbacks, so only the first wins.
          let frameSettled = false
          const fallbackToDirectRun = () =>
            void startVideoRun(
              video,
              sourcePath,
              video.sourceCompositionProtected,
            )

          try {
            const frameRatios = await getModelAspectRatios(frameModel, "image")
            const run = await startTrackedGeneration(
              {
                model: frameModel,
                prompt: buildVideoFramePrompt({
                  originalPrompt: sourceCreative?.prompt,
                  placement: video.size,
                  aspectRatio: spec.aspectRatio,
                }),
                mediaKind: "image",
                assetPath: sourcePath,
                assetMediaKind: "image",
                aspectRatio: nearestHiggsfieldRatio(
                  spec.width,
                  spec.height,
                  frameRatios,
                ),
                uploadWorkspaceId: activeUploadWorkspaceId,
                outputDirectoryName,
                outputFileName: `${video.size}-frame.png`,
                outputSize: videoFrameOutputSize(spec),
                waitForResult: true,
              },
              {
                kind: "video-frame",
                videoId: video.id,
                onReady: (result) => {
                  if (frameSettled) return
                  frameSettled = true
                  if (result.filePath) {
                    void startVideoRun(
                      video,
                      result.filePath,
                      frameStillNeedsProtection,
                    )
                  } else {
                    fallbackToDirectRun()
                  }
                },
                onFailed: () => {
                  if (frameSettled) return
                  frameSettled = true
                  fallbackToDirectRun()
                },
              },
            )
            setVideos((current) =>
              current.map((item) =>
                item.id === video.id ? { ...item, runId: run.runId } : item,
              ),
            )
          } catch {
            fallbackToDirectRun()
          }
        }),
      )
    },
    [
      activeUploadWorkspaceId,
      bridge,
      canGenerate,
      creatives,
      getModelAspectRatios,
      markRunFailed,
      setVideos,
      startTrackedGeneration,
    ],
  )

  return React.useMemo(
    () => ({
      makeCreative,
      selectTake,
      generateAllPlacements,
      regeneratePlacement,
      openOutput,
      exportCreativeZip,
      exportVideo,
      makeVideos,
    }),
    [
      exportCreativeZip,
      exportVideo,
      generateAllPlacements,
      makeCreative,
      makeVideos,
      openOutput,
      regeneratePlacement,
      selectTake,
    ],
  )
}
