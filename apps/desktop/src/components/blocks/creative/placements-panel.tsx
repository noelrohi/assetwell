import { IconLayoutGrid, IconLoader2 } from "@tabler/icons-react"

import { PlacementTile } from "@/components/blocks/creative/placement-tile"
import type { Creative, PlacementResult } from "@/lib/higgsfield"
import {
  IMAGE_PLACEMENT_AVAILABILITY_NOTE,
  availableImagePlacements,
  getImagePlacementUnavailableReason,
  imagePlacements,
  unavailableImagePlacements,
  type ImagePlacement,
} from "@/lib/placements"
import { cn } from "@/lib/utils"

type DisplayedPlacement =
  | PlacementResult
  | {
      size: ImagePlacement
      status: "idle"
      url?: undefined
      filePath?: undefined
    }

export function PlacementsPanel({
  creative,
  selectedSize,
  onSelectPlacement,
  generateAllPlacements,
  regeneratePlacement,
  openOutput,
}: {
  creative: Creative
  selectedSize: ImagePlacement | null
  onSelectPlacement: (size: ImagePlacement) => void
  generateAllPlacements: (creativeId: string) => Promise<void>
  regeneratePlacement: (
    creativeId: string,
    placement: ImagePlacement,
  ) => Promise<void>
  openOutput: (target?: string | null) => Promise<void>
}) {
  const displayedPlacements: DisplayedPlacement[] = imagePlacements.map(
    (size) =>
      creative.placements.find((placement) => placement.size === size) ?? {
        size,
        status: "idle" as const,
        url: undefined,
        filePath: undefined,
      },
  )
  const readyPlacements = creative.placements.filter(
    (placement) =>
      placement.status === "ready" &&
      availableImagePlacements.includes(placement.size),
  )
  const pendingPlacements = creative.placements.filter(
    (placement) =>
      placement.status === "pending" &&
      availableImagePlacements.includes(placement.size),
  )
  const heroSource =
    creative.takes.find((take) => take.id === creative.selectedTakeId) ??
    creative.takes.find((take) => take.status === "ready")
  const canGenerate = Boolean(heroSource?.filePath)

  const isGeneratingAll = pendingPlacements.length > 0
  const progress = Math.round(
    (readyPlacements.length / availableImagePlacements.length) * 100,
  )

  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconLayoutGrid className="size-4 text-muted-foreground" />
          <p className="font-display text-base">Placements</p>
        </div>
        <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
          {readyPlacements.length}/{availableImagePlacements.length}
        </span>
      </div>

      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-ember transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        disabled={!canGenerate}
        onClick={() => void generateAllPlacements(creative.id)}
        className={cn(
          "inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition-all",
          canGenerate
            ? "bg-ember text-ember-foreground ember-glow hover:brightness-105"
            : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
      >
        {isGeneratingAll && <IconLoader2 className="size-4 animate-spin" />}
        {isGeneratingAll ? "Generating…" : "Generate available sizes"}
      </button>

      {unavailableImagePlacements.length > 0 && (
        <p className="px-0.5 text-xs leading-5 text-muted-foreground">
          {IMAGE_PLACEMENT_AVAILABILITY_NOTE}
        </p>
      )}

      {!canGenerate && (
        <p className="px-0.5 text-xs leading-5 text-muted-foreground">
          {creative.status === "pending"
            ? "Finishing the base — pick a hero, then make each ad size."
            : "Pick a saved hero before generating placements."}
        </p>
      )}

      <div className="space-y-0.5 pt-1">
        {displayedPlacements.map((placement) => {
          const unavailableReason = getImagePlacementUnavailableReason(
            placement.size,
          )
          const isUnavailable = Boolean(unavailableReason)

          return (
            <PlacementTile
              key={placement.size}
              p={placement}
              active={!isUnavailable && placement.size === selectedSize}
              unavailableReason={unavailableReason}
              canRegenerate={canGenerate && !isUnavailable}
              canReveal={Boolean(placement.filePath) && !isUnavailable}
              onSelect={() => {
                if (!isUnavailable) onSelectPlacement(placement.size)
              }}
              onRegenerate={() => {
                if (!isUnavailable) {
                  void regeneratePlacement(creative.id, placement.size)
                }
              }}
              onReveal={() =>
                void openOutput(placement.filePath ?? placement.url)
              }
            />
          )
        })}
      </div>
    </aside>
  )
}
