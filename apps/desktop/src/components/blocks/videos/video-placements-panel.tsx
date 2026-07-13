import { useNavigate } from "@tanstack/react-router"
import {
  IconAlertTriangle,
  IconFolderOpen,
  IconLayoutGrid,
  IconLoader2,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  useHiggsfieldApp,
  type Creative,
  type VideoResult,
} from "@/lib/higgsfield"
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_MODEL,
} from "@/lib/higgsfield/constants"
import {
  aspectOf,
  placementSpecs,
  videoPlacements,
  type VideoPlacement,
} from "@/lib/placements"
import { cn } from "@/lib/utils"

export function VideoPlacementsPanel({
  video,
  sourceCreative,
}: {
  video: VideoResult
  sourceCreative?: Creative
}) {
  const navigate = useNavigate()
  const { videos, videoModels, makeVideos, openOutput } = useHiggsfieldApp()
  const groupId = video.groupId ?? `legacy-${video.id}`
  const groupVideos = videos.filter((candidate) =>
    isVideoVariant(candidate, video, groupId),
  )
  const videoBySize = new Map<VideoPlacement, VideoResult>()

  // Videos are stored newest-first, so retries naturally replace failed rows.
  for (const candidate of groupVideos) {
    if (!videoBySize.has(candidate.size)) {
      videoBySize.set(candidate.size, candidate)
    }
  }

  const readyCount = videoPlacements.filter(
    (size) => videoBySize.get(size)?.status === "ready",
  ).length
  const remainingSizes = videoPlacements.filter((size) => {
    const status = videoBySize.get(size)?.status
    return status !== "ready" && status !== "pending"
  })
  const hasPending = videoPlacements.some(
    (size) => videoBySize.get(size)?.status === "pending",
  )
  const sourceFilePath = findVideoSourceFilePath(video, sourceCreative)
  const fallbackModel =
    videoModels.find((option) => option.id === DEFAULT_VIDEO_MODEL)?.id ??
    videoModels[0]?.id ??
    ""
  const model =
    video.model && videoModels.some((option) => option.id === video.model)
      ? video.model
      : fallbackModel
  const canGenerate = Boolean(sourceFilePath && model)
  const baseVideo = videoBySize.get(video.size) ?? video
  const baseReady = baseVideo.status === "ready"
  const baseFailed = baseVideo.status === "failed"
  const basePending = baseVideo.status === "pending"
  const progress = Math.round((readyCount / videoPlacements.length) * 100)

  const generate = (sizes: VideoPlacement[]) => {
    if (!canGenerate || sizes.length === 0) return

    void makeVideos({
      prompt: video.prompt,
      model,
      sizes,
      source: {
        url: video.posterUrl,
        filePath: sourceFilePath,
        label:
          video.sourceTitle ?? sourceCreative?.title ?? "Local source image",
        creativeId: video.sourceCreativeId,
        width: video.sourceWidth,
        height: video.sourceHeight,
      },
      durationSeconds: video.durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS,
      groupId,
    })
    toast(`Queued ${sizes.length} video size${sizes.length === 1 ? "" : "s"}`)
  }

  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconLayoutGrid className="size-4 text-muted-foreground" />
          <p className="font-display text-base">Video sizes</p>
        </div>
        <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
          {readyCount}/{videoPlacements.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/30 p-2.5">
        <div className="flex items-center gap-2.5">
          <img
            src={video.posterUrl}
            alt="Source frame used for every video size"
            className="aspect-video w-16 shrink-0 rounded-md object-cover ring-1 ring-border/60 ring-inset"
          />
          <div className="min-w-0">
            <p className="font-mono text-[0.6rem] tracking-[0.16em] text-muted-foreground uppercase">
              Shared source frame
            </p>
            <p className="mt-0.5 truncate text-xs text-foreground/80">
              {video.sourceTitle ??
                sourceCreative?.title ??
                "Local source image"}
            </p>
          </div>
        </div>
      </div>

      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-ember transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {baseFailed ? (
        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => generate([video.size])}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition-[transform,filter,background-color,color] duration-150 ease-out active:scale-[0.97]",
            canGenerate
              ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
              : "cursor-not-allowed bg-muted text-muted-foreground active:scale-100",
          )}
        >
          <IconAlertTriangle className="size-4" />
          Retry base video
        </button>
      ) : (
        <button
          type="button"
          disabled={!canGenerate || basePending || remainingSizes.length === 0}
          onClick={() => generate(remainingSizes)}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition-[transform,filter,background-color,color] duration-150 ease-out active:scale-[0.97]",
            canGenerate && baseReady && remainingSizes.length > 0
              ? "bg-ember text-ember-foreground ember-glow hover:brightness-105"
              : "cursor-not-allowed bg-muted text-muted-foreground active:scale-100",
          )}
        >
          {(basePending || (hasPending && remainingSizes.length === 0)) && (
            <IconLoader2 className="size-4 animate-spin" />
          )}
          {basePending
            ? "Making base video…"
            : remainingSizes.length === 0
              ? hasPending
                ? "Generating…"
                : "All sizes generated"
              : `Generate remaining sizes (${remainingSizes.length})`}
        </button>
      )}

      {!canGenerate ? (
        <p className="px-0.5 text-xs leading-5 text-muted-foreground">
          The original local source is unavailable, so more sizes cannot be
          generated.
        </p>
      ) : basePending ? (
        <p className="px-0.5 text-xs leading-5 text-muted-foreground">
          You can generate the other sizes once this video is ready.
        </p>
      ) : null}

      <div className="space-y-0.5 pt-1">
        {videoPlacements.map((size) => {
          const variant = videoBySize.get(size)
          return (
            <VideoPlacementTile
              key={size}
              size={size}
              video={variant}
              sourceUrl={video.posterUrl}
              active={size === video.size}
              canGenerate={canGenerate && (baseReady || size === video.size)}
              onSelect={() => {
                if (!variant) return
                void navigate({
                  to: "/video/$videoId",
                  params: { videoId: variant.id },
                })
              }}
              onGenerate={() => generate([size])}
              onReveal={() => void openOutput(variant?.filePath)}
            />
          )
        })}
      </div>
    </aside>
  )
}

export function findVideoSourceFilePath(
  video: VideoResult,
  sourceCreative?: Creative,
) {
  if (video.sourceFilePath) return video.sourceFilePath
  if (!sourceCreative) return undefined

  const matchingSource = [
    ...sourceCreative.takes,
    ...sourceCreative.placements,
  ].find((asset) => asset.url === video.posterUrl)

  if (matchingSource?.filePath) return matchingSource.filePath

  const selectedTake =
    sourceCreative.takes.find(
      (take) => take.id === sourceCreative.selectedTakeId,
    ) ?? sourceCreative.takes.find((take) => take.status === "ready")

  return selectedTake?.filePath
}

export function isVideoVariant(
  candidate: VideoResult,
  current: VideoResult,
  groupId = current.groupId ?? `legacy-${current.id}`,
) {
  if (candidate.id === current.id) return true
  if (candidate.groupId === groupId) return true
  if (groupId === `legacy-${candidate.id}`) return true

  // Videos made together before group ids were persisted share these values.
  return (
    !current.groupId &&
    !candidate.groupId &&
    candidate.createdAt === current.createdAt &&
    candidate.posterUrl === current.posterUrl &&
    candidate.prompt === current.prompt
  )
}

function VideoPlacementTile({
  size,
  video,
  sourceUrl,
  active,
  canGenerate,
  onSelect,
  onGenerate,
  onReveal,
}: {
  size: VideoPlacement
  video?: VideoResult
  sourceUrl: string
  active: boolean
  canGenerate: boolean
  onSelect: () => void
  onGenerate: () => void
  onReveal: () => void
}) {
  const spec = placementSpecs[size]
  const status = video?.status ?? "idle"
  const isReady = status === "ready" && Boolean(video?.url)
  const shape: React.CSSProperties = {
    aspectRatio: aspectOf(spec.width, spec.height),
    ...(spec.width >= spec.height ? { width: "100%" } : { height: "100%" }),
  }

  return (
    <div
      role={video ? "button" : undefined}
      tabIndex={video ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (video && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border px-2.5 py-2 transition-colors",
        active
          ? "cursor-pointer border-ember/60 bg-ember/[0.06]"
          : video
            ? "cursor-pointer border-transparent hover:bg-card/40"
            : "border-transparent",
      )}
    >
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-border/60 bg-muted/20">
        <img
          src={sourceUrl}
          alt=""
          style={shape}
          className={cn(
            "max-h-full max-w-full rounded-[3px] object-cover",
            status === "failed" && "opacity-40",
          )}
        />
        {status === "pending" && (
          <span className="absolute inset-0 grid place-items-center bg-background/65">
            <IconLoader2 className="size-3.5 animate-spin text-ember" />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.7rem] leading-tight text-foreground/85">
          {size}
        </p>
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[0.7rem] leading-tight text-muted-foreground">
            {spec.label}
          </p>
          {video?.sourceCompositionProtected && (
            <span
              className="shrink-0 rounded-full bg-ember/10 px-1.5 py-0.5 font-mono text-[0.5rem] leading-none tracking-wide text-ember uppercase"
              title={`Source protected inside the model's ${video.nativeAspectRatio} frame`}
            >
              protected
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        {status === "idle" && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onGenerate()
            }}
            disabled={!canGenerate}
            className={cn(
              "inline-flex h-7 items-center rounded-full px-3 text-[0.7rem] font-medium transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
              canGenerate
                ? "bg-muted/60 text-foreground hover:bg-ember hover:text-ember-foreground"
                : "cursor-not-allowed bg-muted/40 text-muted-foreground active:scale-100",
            )}
          >
            Generate
          </button>
        )}

        {status === "pending" && (
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            making…
          </span>
        )}

        {status === "failed" && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onGenerate()
            }}
            disabled={!canGenerate}
            title={video?.error}
            className={cn(
              "inline-flex items-center gap-1 text-[0.7rem] font-medium text-destructive transition-[transform,filter] duration-150 ease-out active:scale-[0.96]",
              canGenerate
                ? "hover:brightness-110"
                : "cursor-not-allowed opacity-60 active:scale-100",
            )}
          >
            <IconAlertTriangle className="size-3.5" /> retry
          </button>
        )}

        {isReady && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onReveal()
            }}
            disabled={!video?.filePath}
            className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color,color,transform] duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-muted/60 hover:text-foreground active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-0"
            title="Reveal in folder"
          >
            <IconFolderOpen className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
