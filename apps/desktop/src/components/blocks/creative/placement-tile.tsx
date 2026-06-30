import {
  IconAlertTriangle,
  IconFolderOpen,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react"

import type { PlacementResult } from "@/lib/higgsfield"
import {
  PLACEMENT_COMING_SOON_LABEL,
  aspectOf,
  placementSpecs,
  type ImagePlacement,
} from "@/lib/placements"
import { cn } from "@/lib/utils"

type PlacementTilePlacement =
  | PlacementResult
  | {
      size: ImagePlacement
      status: "idle"
      url?: undefined
      filePath?: undefined
      error?: undefined
    }

/** Fixed-footprint chip that previews the ad's proportions (or thumbnail). */
function ShapeChip({
  p,
  spec,
}: {
  p: PlacementTilePlacement
  spec: (typeof placementSpecs)[ImagePlacement]
}) {
  const isWide = spec.width >= spec.height
  const shape: React.CSSProperties = {
    aspectRatio: aspectOf(spec.width, spec.height),
    ...(isWide ? { width: "100%" } : { height: "100%" }),
  }

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border/60 bg-muted/20">
      {p.status === "ready" && p.url ? (
        <img
          src={p.url}
          alt=""
          style={shape}
          className="max-h-full max-w-full rounded-[3px] object-cover"
        />
      ) : p.status === "pending" ? (
        <IconLoader2 className="size-3.5 animate-spin text-ember" />
      ) : (
        <span
          style={shape}
          className={cn(
            "max-h-full max-w-full rounded-[2px]",
            p.status === "failed"
              ? "bg-destructive/30"
              : "bg-foreground/15 ring-1 ring-inset ring-foreground/10",
          )}
        />
      )}
    </span>
  )
}

export function PlacementTile({
  p,
  active,
  onSelect,
  onRegenerate,
  onReveal,
  canRegenerate,
  canReveal,
  unavailableReason,
  unavailableLabel = PLACEMENT_COMING_SOON_LABEL,
}: {
  p: PlacementTilePlacement
  active: boolean
  onSelect: () => void
  onRegenerate: () => void
  onReveal: () => void
  canRegenerate: boolean
  canReveal: boolean
  unavailableReason?: string
  unavailableLabel?: string
}) {
  const spec = placementSpecs[p.size]
  const isReady = p.status === "ready" && Boolean(p.url)
  const isUnavailable = Boolean(unavailableReason)

  return (
    <div
      role="button"
      tabIndex={isUnavailable ? -1 : 0}
      aria-disabled={isUnavailable}
      title={unavailableReason}
      onClick={() => {
        if (!isUnavailable) onSelect()
      }}
      onKeyDown={(e) => {
        if (isUnavailable) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border px-2.5 py-2 transition-colors",
        isUnavailable
          ? "cursor-not-allowed border-transparent opacity-55"
          : active
            ? "cursor-pointer border-ember/60 bg-ember/[0.06]"
            : "cursor-pointer border-transparent hover:bg-card/40",
      )}
    >
      <ShapeChip p={p} spec={spec} />

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.7rem] leading-tight text-foreground/85">
          {p.size}
        </p>
        <p className="truncate text-[0.7rem] leading-tight text-muted-foreground">
          {spec.label}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        {isUnavailable && (
          <span className="rounded-full bg-muted/45 px-2.5 py-1 text-[0.65rem] font-medium text-muted-foreground">
            {unavailableLabel}
          </span>
        )}

        {!isUnavailable && p.status === "idle" && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRegenerate()
            }}
            disabled={!canRegenerate}
            className={cn(
              "inline-flex h-7 items-center rounded-full px-3 text-[0.7rem] font-medium transition-colors",
              canRegenerate
                ? "bg-muted/60 text-foreground hover:bg-ember hover:text-ember-foreground"
                : "cursor-not-allowed bg-muted/40 text-muted-foreground",
            )}
          >
            Generate
          </button>
        )}

        {!isUnavailable && p.status === "pending" && (
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            making…
          </span>
        )}

        {!isUnavailable && p.status === "failed" && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRegenerate()
            }}
            disabled={!canRegenerate}
            title={p.error}
            className={cn(
              "inline-flex items-center gap-1 text-[0.7rem] font-medium text-destructive transition-colors",
              canRegenerate
                ? "hover:brightness-110"
                : "cursor-not-allowed opacity-60",
            )}
          >
            <IconAlertTriangle className="size-3.5" /> retry
          </button>
        )}

        {!isUnavailable && isReady && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRegenerate()
              }}
              disabled={!canRegenerate}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              title="Regenerate"
            >
              <IconRefresh className="size-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReveal()
              }}
              disabled={!canReveal}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              title="Reveal in folder"
            >
              <IconFolderOpen className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
