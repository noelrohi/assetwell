import { Link } from "@tanstack/react-router"
import { IconLayoutGrid, IconLoader2, IconTrash } from "@tabler/icons-react"

import { useHiggsfieldApp } from "@/lib/higgsfield"
import type { Creative } from "@/lib/higgsfield"
import { aspectOf, type ImagePlacement } from "@/lib/placements"

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
  const { deleteCreative } = useHiggsfieldApp()
  const pending = creative.status === "pending"
  const placements = readyCount(creative.placements)

  return (
    <div
      className="group animate-in fade-in slide-in-from-bottom-2 fill-mode-both relative overflow-hidden rounded-xl border border-border/70 bg-card/40 transition-all duration-300 hover:border-border hover:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Link
        to="/creative/$creativeId"
        params={{ creativeId: creative.id }}
        className="block"
      >
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

          {/* Metadata revealed on hover — no prompt, just the essentials. */}
          {!pending && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3.5 pt-12 pb-3 opacity-0 shadow-[inset_0_-80px_60px_-40px_rgba(0,0,0,0.85)] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <h3 className="truncate font-display text-[0.95rem] leading-tight text-white drop-shadow-sm">
                {creative.title}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-[0.65rem] text-white/75 drop-shadow-sm">
                <span>{creative.ratioId}</span>
                <span className="text-white/40">·</span>
                <span>{creative.model}</span>
                <span className="text-white/40">·</span>
                <span className="flex items-center gap-1">
                  <IconLayoutGrid className="size-3" />
                  {placements}
                </span>
              </p>
            </div>
          )}
        </div>
      </Link>

      <button
        type="button"
        aria-label="Delete creative"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          deleteCreative(creative.id)
        }}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg bg-black/55 text-white/90 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-destructive hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
      >
        <IconTrash className="size-3.5" />
      </button>
    </div>
  )
}

export type { ImagePlacement }
