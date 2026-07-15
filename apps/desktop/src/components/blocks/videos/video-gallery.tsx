import * as React from "react"
import { Link } from "@tanstack/react-router"
import {
  IconDownload,
  IconLoader2,
  IconPlayerPlay,
  IconVideo,
} from "@tabler/icons-react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useHiggsfieldApp, type VideoResult } from "@/lib/higgsfield"
import { aspectOf, placementSpecs, type PlacementSpec } from "@/lib/placements"

export function VideoGallery() {
  const { videos } = useHiggsfieldApp()

  if (videos.length === 0) {
    return (
      <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center rounded-2xl border border-dashed border-border/70 bg-card/25 px-6 py-10 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-muted/50 text-muted-foreground">
          <IconVideo className="size-5" />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">
          Your generated videos will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {videos.length} recent video{videos.length === 1 ? "" : "s"}
        </p>
        <p className="font-mono text-[0.65rem] text-muted-foreground/70">
          newest first
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {videos.map((video, index) => (
          <VideoCard key={video.id} video={video} index={index} />
        ))}
      </div>
    </div>
  )
}

function VideoCard({ video, index }: { video: VideoResult; index: number }) {
  const { exportVideo } = useHiggsfieldApp()
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const spec = placementSpecs[video.size]
  const pending = video.status === "pending"
  const failed = video.status === "failed"
  const canPlay = video.status === "ready" && Boolean(video.url)
  const canDownload = video.status === "ready" && Boolean(video.filePath)
  const durationLabel =
    typeof video.durationSeconds === "number"
      ? `${video.durationSeconds}s`
      : null
  const dimensionsLabel = `${spec.width} × ${spec.height}`

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="group animate-in fade-in slide-in-from-bottom-2 fill-mode-both relative overflow-hidden rounded-xl border border-border/70 bg-card/40 transition-all duration-300 hover:border-border hover:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <Link
              to="/video/$videoId"
              params={{ videoId: video.id }}
              className="block"
              aria-label={`Open ${video.prompt}`}
            >
              <div
                className="relative w-full overflow-hidden bg-muted/40"
                style={{ aspectRatio: aspectOf(spec.width, spec.height) }}
              >
                <img
                  src={video.posterUrl}
                  alt={video.prompt}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />

                {pending ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30">
                    <IconLoader2 className="size-5 animate-spin text-ember" />
                    <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground">
                      {video.stage === "framing"
                        ? "preparing frame"
                        : "generating"}
                    </span>
                  </div>
                ) : failed ? (
                  <div className="absolute inset-0 grid place-items-center bg-background/50 text-destructive">
                    <span className="font-mono text-[0.65rem]">failed</span>
                  </div>
                ) : null}

                {/* On hover, keep the card quiet: only duration and dimensions. */}
                {!pending && (
                  <div className="pointer-events-none absolute inset-0 flex translate-y-1 items-end justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent p-3.5 opacity-0 shadow-[inset_0_-120px_80px_-40px_rgba(0,0,0,0.85)] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <p className="flex items-center gap-1.5 font-mono text-[0.65rem] text-white/85 drop-shadow-sm">
                      {durationLabel && (
                        <>
                          <span>{durationLabel}</span>
                          <span className="text-white/40">·</span>
                        </>
                      )}
                      <span>{dimensionsLabel}</span>
                    </p>
                  </div>
                )}
              </div>
            </Link>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem
            disabled={!canPlay}
            onSelect={() => setPreviewOpen(true)}
          >
            <IconPlayerPlay /> Preview
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!canDownload}
            onSelect={() => void exportVideo(video.id)}
          >
            <IconDownload /> Download
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <VideoPreviewDialog
        video={video}
        spec={spec}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  )
}

function VideoPreviewDialog({
  video,
  spec,
  open,
  onOpenChange,
}: {
  video: VideoResult
  spec: PlacementSpec
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const durationLabel =
    typeof video.durationSeconds === "number"
      ? ` · ${video.durationSeconds}s`
      : ""
  const meta = `${video.size} · ${spec.label}${durationLabel}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-border/70 bg-card p-0 sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{video.prompt}</DialogTitle>
          <DialogDescription>{meta}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[75vh] items-center justify-center bg-black">
          {open && video.url && (
            <video
              src={video.url}
              poster={video.posterUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[75vh] w-auto max-w-full object-contain"
            />
          )}
        </div>
        <div className="px-4 py-3">
          <p
            className="line-clamp-2 text-sm leading-6 text-foreground/85"
            title={video.prompt}
          >
            {video.prompt}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{meta}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
