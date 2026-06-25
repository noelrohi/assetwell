import {
  IconAlertTriangle,
  IconFolderOpen,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react"

import type { PlacementResult } from "@/lib/higgsfield"
import { aspectOf, placementSpecs } from "@/lib/placements"
import { cn } from "@/lib/utils"

export function PlacementTile({
  p,
  onRegenerate,
  onReveal,
  canRegenerate,
  canReveal,
}: {
  p: PlacementResult
  onRegenerate: () => void
  onReveal: () => void
  canRegenerate: boolean
  canReveal: boolean
}) {
  const spec = placementSpecs[p.size]
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-card/30">
      <div
        className="relative w-full overflow-hidden bg-muted/30"
        style={{ aspectRatio: aspectOf(spec.width, spec.height) }}
      >
        {p.status === "ready" && p.url && (
          <img src={p.url} alt={p.size} className="size-full object-cover" />
        )}
        {p.status === "pending" && (
          <div className="absolute inset-0 grid place-items-center">
            <IconLoader2 className="size-4 animate-spin text-ember" />
          </div>
        )}
        {p.status === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-destructive">
            <IconAlertTriangle className="size-4" />
            <button
              onClick={onRegenerate}
              disabled={!canRegenerate}
              title={p.error}
              className={cn(
                "flex items-center gap-1 font-mono text-[0.6rem] text-muted-foreground",
                canRegenerate
                  ? "hover:text-foreground"
                  : "cursor-not-allowed opacity-60",
              )}
            >
              <IconRefresh className="size-3" /> retry
            </button>
          </div>
        )}

        {p.status === "ready" && (
          <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-background/80 via-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onRegenerate}
              disabled={!canRegenerate}
              className="grid size-7 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
              title="Regenerate"
            >
              <IconRefresh className="size-3.5" />
            </button>
            <button
              onClick={onReveal}
              disabled={!canReveal}
              className="grid size-7 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
              title="Reveal in Finder"
            >
              <IconFolderOpen className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-2.5 py-2">
        <span className="font-mono text-[0.65rem] text-foreground/80">
          {p.size}
        </span>
        <span className="truncate pl-2 text-[0.65rem] text-muted-foreground">
          {spec.label}
        </span>
      </div>
    </div>
  )
}
