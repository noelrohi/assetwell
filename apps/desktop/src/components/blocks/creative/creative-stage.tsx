import type { Dispatch, SetStateAction } from "react"
import { IconChecks, IconLoader2 } from "@tabler/icons-react"

import type { Creative } from "@/lib/higgsfield"
import { aspectOf } from "@/lib/placements"
import { cn } from "@/lib/utils"

export function CreativeStage({
  creative,
  selectedUrl,
  setSelectedUrl,
  selectedSize,
  selectTake,
}: {
  creative: Creative
  selectedUrl: string
  setSelectedUrl: Dispatch<SetStateAction<string>>
  selectedSize: { width: number; height: number }
  selectTake: (creativeId: string, takeId: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/30">
        <div
          className="mx-auto max-h-[70vh] w-full"
          style={{
            aspectRatio: aspectOf(selectedSize.width, selectedSize.height),
          }}
        >
          {selectedUrl ? (
            <img
              src={selectedUrl}
              alt={creative.title}
              className="size-full object-contain"
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <IconLoader2 className="size-6 animate-spin text-ember" />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
          Takes — pick your hero
        </p>
        <div className="flex gap-2.5">
          {creative.takes.map((take) => (
            <button
              key={take.id}
              disabled={take.status !== "ready"}
              onClick={() => {
                setSelectedUrl(take.url)
                selectTake(creative.id, take.id)
              }}
              className={cn(
                "relative aspect-square w-20 overflow-hidden rounded-lg border-2 transition-all",
                selectedUrl === take.url
                  ? "border-ember"
                  : "border-transparent hover:border-border",
              )}
            >
              {take.status === "ready" ? (
                <img
                  src={take.url}
                  alt="take"
                  className="size-full object-cover"
                />
              ) : (
                <div className="grid size-full place-items-center bg-muted/40">
                  <IconLoader2 className="size-4 animate-spin text-ember" />
                </div>
              )}
              {creative.selectedTakeId === take.id && (
                <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-ember text-ember-foreground">
                  <IconChecks className="size-2.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
