import { Link } from "@tanstack/react-router"
import {
  IconLoader2,
  IconPlayerPlayFilled,
  IconVideo,
} from "@tabler/icons-react"

import { useHiggsfieldApp } from "@/lib/higgsfield"
import { aspectOf, placementSpecs } from "@/lib/placements"

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
        {videos.map((video, index) => {
          const spec = placementSpecs[video.size]
          return (
            <div
              key={video.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both group overflow-hidden rounded-xl border border-border/70 bg-card/40 transition-colors hover:border-border"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div
                className="relative w-full overflow-hidden bg-muted/40"
                style={{ aspectRatio: aspectOf(spec.width, spec.height) }}
              >
                {video.url && video.status === "ready" ? (
                  <video
                    src={video.url}
                    muted
                    loop
                    playsInline
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <img
                    src={video.posterUrl}
                    alt={video.prompt}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                {video.status === "pending" ? (
                  <div className="absolute inset-0 grid place-items-center bg-background/40">
                    <IconLoader2 className="size-5 animate-spin text-ember" />
                  </div>
                ) : video.status === "failed" ? (
                  <div className="absolute inset-0 grid place-items-center bg-background/50 text-destructive">
                    <span className="font-mono text-[0.65rem]">failed</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="ember-glow grid size-11 place-items-center rounded-full bg-background/70 text-foreground backdrop-blur">
                      <IconPlayerPlayFilled className="size-4" />
                    </span>
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded-full bg-background/70 px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground backdrop-blur">
                  {video.size}
                </span>
                {typeof video.durationSeconds === "number" && (
                  <span className="absolute top-2 right-2 rounded-full bg-background/70 px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground backdrop-blur">
                    {video.durationSeconds}s
                  </span>
                )}
              </div>
              <div className="px-3.5 py-3">
                <p className="line-clamp-1 text-sm">{video.prompt}</p>
                {video.sourceCreativeId && (
                  <Link
                    to="/creative/$creativeId"
                    params={{ creativeId: video.sourceCreativeId }}
                    className="mt-1 block truncate font-mono text-[0.65rem] text-muted-foreground transition-colors hover:text-ember"
                  >
                    from {video.sourceTitle}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
