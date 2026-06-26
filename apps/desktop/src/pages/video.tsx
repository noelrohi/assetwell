import { Link, useParams } from "@tanstack/react-router"
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCopy,
  IconDownload,
  IconFolderOpen,
  IconLoader2,
  IconMovie,
  IconPhoto,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { ActionButton } from "@/components/blocks/creative/action-button"
import { StatusPill } from "@/components/blocks/creative/status-pill"
import { PageHeaderActions } from "@/components/blocks/layout/page-header-actions"
import {
  useHiggsfieldApp,
  type Creative,
  type VideoResult,
} from "@/lib/higgsfield"
import { aspectOf, placementSpecs } from "@/lib/placements"
import { cn } from "@/lib/utils"

export function VideoPage() {
  const { videoId } = useParams({ from: "/video/$videoId" })
  const { videos, creativeById, openOutput, exportVideo } = useHiggsfieldApp()
  const video = videos.find((item) => item.id === videoId)

  if (!video) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <p className="text-muted-foreground">This video could not be found.</p>
        <Link
          to="/videos"
          className="mt-4 inline-block text-ember hover:underline"
        >
          Back to Videos
        </Link>
      </div>
    )
  }

  const sourceCreative = video.sourceCreativeId
    ? creativeById(video.sourceCreativeId)
    : undefined
  const spec = placementSpecs[video.size]
  const canReveal = Boolean(video.filePath)

  return (
    <div className="mx-auto max-w-6xl px-8 pt-6 pb-24">
      <PageHeaderActions>
        <ActionButton
          disabled={!canReveal}
          onClick={() => void exportVideo(video.id)}
          title={canReveal ? "Download video" : "Video is not ready yet"}
        >
          <IconDownload className="size-3.5" /> Download
        </ActionButton>
        <ActionButton
          disabled={!canReveal}
          onClick={() => void openOutput(video.filePath)}
        >
          <IconFolderOpen className="size-3.5" /> Reveal
        </ActionButton>
      </PageHeaderActions>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-card/50 px-2.5 py-1 ring-1 ring-border/50 ring-inset">
          <StatusPill status={video.status} />
        </span>
        <FactPill>{video.size}</FactPill>
        <FactPill>{spec.label}</FactPill>
        {typeof video.durationSeconds === "number" && (
          <FactPill>{video.durationSeconds}s</FactPill>
        )}
      </div>

      <VideoSourceSummary video={video} sourceCreative={sourceCreative} />

      <div className="mt-6">
        <VideoStage video={video} spec={spec} />
      </div>
    </div>
  )
}

function VideoSourceSummary({
  video,
  sourceCreative,
}: {
  video: VideoResult
  sourceCreative?: Creative
}) {
  const handleCopyPrompt = () => {
    void navigator.clipboard.writeText(video.prompt)
    toast("Video prompt copied to clipboard")
  }

  const sourceLabel =
    video.sourceTitle ?? sourceCreative?.title ?? "Local source image"

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card/35 p-4 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.65)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-ember/10 text-ember ring-1 ring-ember/20 ring-inset">
            <IconMovie className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
                Motion prompt
              </p>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="grid size-5 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-ember/10 hover:text-ember"
                title="Copy prompt"
                aria-label="Copy prompt"
              >
                <IconCopy className="size-3.5" />
              </button>
            </div>
            <p
              className="mt-1 line-clamp-2 text-sm leading-6 text-foreground/85"
              title={video.prompt}
            >
              {video.prompt}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-3 sm:max-w-[55%] sm:border-l sm:border-border/60 sm:pl-6">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-ember/10 text-ember ring-1 ring-ember/20 ring-inset">
            <IconPhoto className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
              Source frame
            </p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <SourceThumbnail
                posterUrl={video.posterUrl}
                sourceCreative={sourceCreative}
              />
              <div className="min-w-0">
                <p
                  className="truncate text-sm text-foreground/85"
                  title={sourceLabel}
                >
                  {sourceLabel}
                </p>
                {sourceCreative && (
                  <Link
                    to="/creative/$creativeId"
                    params={{ creativeId: sourceCreative.id }}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-ember transition hover:text-ember/80"
                  >
                    Open source creative
                    <IconArrowUpRight className="size-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SourceThumbnail({
  posterUrl,
  sourceCreative,
}: {
  posterUrl?: string
  sourceCreative?: Creative
}) {
  const image = (
    <img
      src={posterUrl}
      alt="Source frame"
      className="size-full object-cover transition group-hover:scale-[1.05]"
    />
  )
  const frameClass =
    "group block aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border/60 ring-inset"

  if (sourceCreative) {
    return (
      <Link
        to="/creative/$creativeId"
        params={{ creativeId: sourceCreative.id }}
        className={cn(frameClass, "transition hover:ring-ember/50")}
        title="Open source creative"
      >
        {image}
      </Link>
    )
  }

  return <div className={frameClass}>{image}</div>
}

function VideoStage({
  video,
  spec,
}: {
  video: VideoResult
  spec: { width: number; height: number }
}) {
  const selectedRatio = spec.width / spec.height
  const selectedAspect = aspectOf(spec.width, spec.height)
  const frameWidth = `min(100%, ${spec.width}px, calc(70vh * ${selectedRatio}))`
  const sizeLabel = `${spec.width} × ${spec.height}`
  const state = video.status === "ready" && video.url ? "ready" : video.status
  const hasFrame = state === "ready" || state === "pending"

  return (
    <div className="relative grid min-h-[18rem] place-items-center overflow-hidden rounded-2xl border border-border/70 bg-card/30 p-6">
      {/* darkroom safelight: a soft, blurred wash of the frame bleeds behind it */}
      {state === "ready" && video.posterUrl && (
        <img
          aria-hidden
          src={video.posterUrl}
          alt=""
          className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-30 blur-3xl saturate-150"
        />
      )}

      {hasFrame ? (
        <div
          className="relative mx-auto overflow-hidden rounded-xl bg-background/40"
          style={{ aspectRatio: selectedAspect, width: frameWidth }}
        >
          {state === "ready" && video.url ? (
            <video
              src={video.url}
              poster={video.posterUrl}
              controls
              playsInline
              preload="metadata"
              className="size-full bg-black object-contain"
            />
          ) : (
            <GeneratingState sizeLabel={sizeLabel} />
          )}
        </div>
      ) : (
        <EmptyState
          icon={<IconAlertTriangle className="size-5" />}
          title="Video is not playable yet"
          hint={
            video.error ??
            "Assetwell has not received a playable local output for this video."
          }
        />
      )}
    </div>
  )
}

function FactPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-card/50 px-2.5 py-1 font-mono text-xs text-muted-foreground ring-1 ring-border/50 ring-inset">
      {children}
    </span>
  )
}

function GeneratingState({ sizeLabel }: { sizeLabel: string }) {
  return (
    <div className="stage-shimmer relative grid size-full place-items-center overflow-hidden bg-gradient-to-br from-muted/30 via-background/30 to-muted/20 px-6 text-center">
      <div className="relative flex flex-col items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-ember/10 ring-1 ring-ember/25 ring-inset">
          <IconLoader2 className="size-5 animate-spin text-ember" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground/90">
            Rendering {sizeLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            The player will appear when the video is saved locally.
          </p>
        </div>
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-1.5 animate-pulse rounded-full bg-ember/70"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="flex max-w-xs flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive ring-1 ring-destructive/25 ring-inset">
        {icon}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground/85">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground/80">{hint}</p>
      </div>
    </div>
  )
}
