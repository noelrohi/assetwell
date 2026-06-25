import { IconPhoto } from "@tabler/icons-react"

import { PlacementTile } from "@/components/blocks/creative/placement-tile"
import type { Creative } from "@/lib/higgsfield"
import type { ImagePlacement } from "@/lib/placements"
import { cn } from "@/lib/utils"

export function PlacementsPanel({
  creative,
  selectedSourceFilePath,
  generateAllPlacements,
  regeneratePlacement,
  openOutput,
}: {
  creative: Creative
  selectedSourceFilePath?: string
  generateAllPlacements: (creativeId: string) => Promise<void>
  regeneratePlacement: (
    creativeId: string,
    placement: ImagePlacement,
  ) => Promise<void>
  openOutput: (target?: string | null) => Promise<void>
}) {
  const hasPlacements = creative.placements.length > 0
  const readyPlacements = creative.placements.filter(
    (placement) => placement.status === "ready",
  )

  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-base">Placements</p>
        {hasPlacements && (
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            {readyPlacements.length}/{creative.placements.length}
          </span>
        )}
      </div>

      {!hasPlacements ? (
        <div className="rounded-xl border border-dashed border-border bg-card/20 p-5 text-center">
          <IconPhoto className="mx-auto size-6 text-muted-foreground/60" />
          <p className="mt-2 text-sm text-muted-foreground">
            {creative.status === "pending"
              ? "Finishing the base — pick a hero, then make every ad size."
              : "Turn this hero into all 8 ad placements in one pass."}
          </p>
          <button
            disabled={creative.status === "pending"}
            onClick={() => void generateAllPlacements(creative.id)}
            className={cn(
              "mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition-all",
              creative.status === "pending"
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-ember text-ember-foreground ember-glow hover:brightness-105",
            )}
          >
            Generate all placements
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {creative.placements.map((placement) => (
            <PlacementTile
              key={placement.size}
              p={placement}
              canRegenerate={Boolean(selectedSourceFilePath)}
              canReveal={Boolean(placement.filePath)}
              onRegenerate={() =>
                void regeneratePlacement(creative.id, placement.size)
              }
              onReveal={() =>
                void openOutput(placement.filePath ?? placement.url)
              }
            />
          ))}
        </div>
      )}
    </aside>
  )
}
