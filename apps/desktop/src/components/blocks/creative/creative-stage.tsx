import {
  IconAlertTriangle,
  IconChecks,
  IconLoader2,
  IconPhotoPlus,
  IconSparkles,
} from "@tabler/icons-react"

import type { Creative } from "@/lib/higgsfield"
import { aspectOf } from "@/lib/placements"
import { cn } from "@/lib/utils"

export type StagePreviewState = "image" | "generating" | "empty" | "failed"

export function CreativeStage({
  creative,
  previewUrl,
  previewState,
  selectedTakeUrl,
  selectedSize,
  onSelectTake,
}: {
  creative: Creative
  previewUrl: string
  previewState: StagePreviewState
  selectedTakeUrl: string
  selectedSize: { width: number; height: number }
  onSelectTake: (takeId: string) => void
}) {
  const selectedAspect = aspectOf(selectedSize.width, selectedSize.height)
  const selectedRatio = selectedSize.width / selectedSize.height
  const previewWidth = `min(100%, ${selectedSize.width}px, calc(70vh * ${selectedRatio}))`
  const sizeLabel = `${selectedSize.width} × ${selectedSize.height}`

  const hasFrame = previewState === "image" || previewState === "generating"

  return (
    <div className="space-y-4">
      <div className="grid min-h-[18rem] place-items-center overflow-hidden rounded-2xl border border-border/70 bg-card/30 p-6">
        {hasFrame ? (
          <div
            className={cn(
              "relative mx-auto overflow-hidden rounded-xl bg-background/40",
              // The ring/shadow read as a frame; only show it once there's a
              // real image. The generating skeleton stays borderless.
              previewState === "image" &&
                "shadow-[0_18px_70px_rgba(0,0,0,0.28)] ring-1 ring-white/10",
            )}
            style={{
              aspectRatio: selectedAspect,
              width: previewWidth,
            }}
          >
            {previewState === "image" && previewUrl ? (
              <img
                src={previewUrl}
                alt={creative.title}
                className="size-full object-contain"
              />
            ) : (
              <GeneratingState sizeLabel={sizeLabel} />
            )}
          </div>
        ) : previewState === "failed" ? (
          <EmptyState
            tone="danger"
            icon={<IconAlertTriangle className="size-5" />}
            title="Couldn't generate this size"
            hint={`We hit a snag rendering ${sizeLabel}. Regenerate it from the panel.`}
          />
        ) : (
          <EmptyState
            tone="muted"
            icon={<IconPhotoPlus className="size-5" />}
            title="Nothing here yet"
            hint={`Generate ${sizeLabel} from the placements panel to preview it.`}
          />
        )}
      </div>

      <div>
        <p className="mb-2 font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
          {creative.takes.length === 1
            ? "Base image"
            : "Takes — pick your hero"}
        </p>
        <div className="flex gap-2.5">
          {creative.takes.map((take) => (
            <button
              key={take.id}
              disabled={take.status !== "ready"}
              onClick={() => onSelectTake(take.id)}
              className={cn(
                "relative aspect-square w-20 overflow-hidden rounded-lg border-2 transition-all",
                selectedTakeUrl === take.url
                  ? "border-ember"
                  : "border-transparent hover:border-border",
              )}
            >
              {take.status === "ready" ? (
                <img
                  src={take.url}
                  alt={creative.takes.length === 1 ? "base image" : "take"}
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

function GeneratingState({ sizeLabel }: { sizeLabel: string }) {
  return (
    <div className="stage-shimmer relative grid size-full place-items-center overflow-hidden bg-gradient-to-br from-muted/30 via-background/30 to-muted/20 px-6 text-center">
      <div className="relative flex flex-col items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-ember/10 ring-1 ring-ember/25 ring-inset">
          <IconLoader2 className="size-5 animate-spin text-ember" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground/90">
            Generating {sizeLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Hang tight — this might take a while.
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
  tone,
  icon,
  title,
  hint,
}: {
  tone: "muted" | "danger"
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="flex max-w-xs flex-col items-center gap-3 px-6 py-10 text-center">
      <span
        className={cn(
          "grid size-11 place-items-center rounded-full ring-1 ring-inset",
          tone === "danger"
            ? "bg-destructive/10 text-destructive ring-destructive/25"
            : "bg-muted/40 text-muted-foreground ring-border/60",
        )}
      >
        {tone === "muted" ? (
          <span className="relative">
            {icon}
            <IconSparkles className="absolute -top-1.5 -right-2 size-3 text-ember" />
          </span>
        ) : (
          icon
        )}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground/85">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground/80">{hint}</p>
      </div>
    </div>
  )
}
