import { Link } from "@tanstack/react-router"
import { IconLayoutGrid, IconLoader2 } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { aspectOf, type ImagePlacement } from "@/lib/placements"
import type { Creative } from "@/lib/higgsfield"

function readyCount(placements: Creative["placements"]) {
  return placements.filter((p) => p.status === "ready").length
}

export function CreativeCard({
  creative,
  index = 0,
}: {
  creative: Creative
  index?: number
}) {
  const pending = creative.status === "pending"
  const placements = readyCount(creative.placements)

  return (
    <Link
      to="/creative/$creativeId"
      params={{ creativeId: creative.id }}
      className="group animate-in fade-in slide-in-from-bottom-2 fill-mode-both block"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/40 transition-all duration-300 group-hover:border-border group-hover:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
        <div
          className="relative w-full overflow-hidden bg-muted/40"
          style={{ aspectRatio: aspectOf(creative.ratioW, creative.ratioH) }}
        >
          {pending ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30">
              <IconLoader2 className="size-5 animate-spin text-ember" />
              <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground">
                generating
              </span>
            </div>
          ) : (
            <img
              src={creative.heroUrl}
              alt={creative.title}
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          )}

          {creative.isDemo && (
            <span className="absolute top-2.5 left-2.5 rounded-full border border-ember/40 bg-background/70 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.2em] text-ember uppercase backdrop-blur-sm">
              demo
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-3 px-3.5 py-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[0.95rem] leading-tight">
              {creative.title}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[0.65rem] text-muted-foreground">
              <span>{creative.ratioId}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{creative.model}</span>
            </p>
          </div>
          {!pending && (
            <span
              className={cn(
                "mt-0.5 flex shrink-0 items-center gap-1 font-mono text-[0.65rem]",
                placements > 0 ? "text-foreground/70" : "text-muted-foreground/60",
              )}
            >
              <IconLayoutGrid className="size-3" />
              {placements}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export type { ImagePlacement }
