import {
  IconAlertTriangle,
  IconChecks,
  IconCopy,
  IconDownload,
  IconFolderOpen,
  IconLoader2,
  IconPhotoPlus,
  IconSparkles,
} from "@tabler/icons-react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { Creative, Take } from "@/lib/higgsfield"
import {
  copyImage,
  downloadImage,
  type ImageActionAsset,
} from "@/lib/image-actions"
import { aspectOf } from "@/lib/placements"
import { cn } from "@/lib/utils"

export type StagePreviewState = "image" | "generating" | "empty" | "failed"

interface StageImageAsset extends ImageActionAsset {
  filePath?: string | null
}

export function CreativeStage({
  creative,
  previewUrl,
  previewState,
  previewFilePath,
  selectedTakeUrl,
  selectedSize,
  onSelectTake,
  openOutput,
}: {
  creative: Creative
  previewUrl: string
  previewState: StagePreviewState
  previewFilePath?: string | null
  selectedTakeUrl: string
  selectedSize: { width: number; height: number }
  onSelectTake: (takeId: string) => void
  openOutput: (target?: string | null) => Promise<void>
}) {
  const selectedAspect = aspectOf(selectedSize.width, selectedSize.height)
  const selectedRatio = selectedSize.width / selectedSize.height
  const previewWidth = `min(100%, ${selectedSize.width}px, calc(70vh * ${selectedRatio}))`
  const sizeLabel = `${selectedSize.width} × ${selectedSize.height}`
  const previewImage: StageImageAsset | null =
    previewState === "image" && previewUrl
      ? {
          url: previewUrl,
          name: `${creative.title} · ${sizeLabel}`,
          filePath: previewFilePath,
        }
      : null

  const hasFrame = previewState === "image" || previewState === "generating"
  // Slim banner strips are too short to host the generating caption inside
  // the shape, so it stacks below the shimmer instead.
  const isSlimStrip = selectedRatio >= 3

  return (
    <div className="space-y-4">
      <div className="grid min-h-[18rem] place-items-center overflow-hidden rounded-2xl border border-border/70 bg-card/30 p-6">
        {hasFrame && !previewImage && isSlimStrip ? (
          <div className="w-full space-y-5">
            <div
              className="stage-shimmer mx-auto overflow-hidden rounded-xl bg-gradient-to-br from-muted/30 via-background/30 to-muted/20"
              style={{
                aspectRatio: selectedAspect,
                width: previewWidth,
              }}
            />
            <GeneratingCaption sizeLabel={sizeLabel} />
          </div>
        ) : hasFrame ? (
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
            {previewImage ? (
              <StageImageContextMenu
                image={previewImage}
                openOutput={openOutput}
              >
                <figure className="size-full">
                  <img
                    src={previewUrl}
                    alt={creative.title}
                    className="size-full object-contain"
                  />
                </figure>
              </StageImageContextMenu>
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
          {creative.takes.map((take, index) =>
            take.status === "ready" && take.url ? (
              <StageImageContextMenu
                key={take.id}
                image={takeImageAsset(creative, take, index)}
                openOutput={openOutput}
              >
                <button
                  type="button"
                  onClick={() => onSelectTake(take.id)}
                  className={takeButtonClassName(selectedTakeUrl === take.url)}
                >
                  <img
                    src={take.url}
                    alt={creative.takes.length === 1 ? "base image" : "take"}
                    className="size-full object-cover"
                  />
                  {creative.selectedTakeId === take.id && (
                    <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-ember text-ember-foreground">
                      <IconChecks className="size-2.5" />
                    </span>
                  )}
                </button>
              </StageImageContextMenu>
            ) : (
              <button
                key={take.id}
                type="button"
                disabled
                className={takeButtonClassName(false)}
              >
                <div className="grid size-full place-items-center bg-muted/40">
                  <IconLoader2 className="size-4 animate-spin text-ember" />
                </div>
                {creative.selectedTakeId === take.id && (
                  <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-ember text-ember-foreground">
                    <IconChecks className="size-2.5" />
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function StageImageContextMenu({
  children,
  image,
  openOutput,
}: {
  children: React.ReactElement
  image: StageImageAsset
  openOutput: (target?: string | null) => Promise<void>
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onSelect={() => void copyImage(image, { fallbackToLink: false })}
        >
          <IconCopy /> Copy image
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void downloadImage(image)}>
          <IconDownload /> Download image
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!image.filePath}
          onSelect={() => void openOutput(image.filePath)}
        >
          <IconFolderOpen /> Reveal in folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function takeImageAsset(
  creative: Creative,
  take: Take,
  index: number,
): StageImageAsset {
  return {
    url: take.url,
    filePath: take.filePath,
    name:
      creative.takes.length === 1
        ? `${creative.title} · base image`
        : `${creative.title} · take ${index + 1}`,
  }
}

function takeButtonClassName(selected: boolean) {
  return cn(
    "relative aspect-square w-20 overflow-hidden rounded-lg border-2 transition-all disabled:cursor-not-allowed disabled:opacity-70",
    selected ? "border-ember" : "border-transparent hover:border-border",
  )
}

function GeneratingState({ sizeLabel }: { sizeLabel: string }) {
  return (
    <div className="stage-shimmer relative grid size-full place-items-center overflow-hidden bg-gradient-to-br from-muted/30 via-background/30 to-muted/20 px-6 text-center">
      <GeneratingCaption sizeLabel={sizeLabel} />
    </div>
  )
}

function GeneratingCaption({ sizeLabel }: { sizeLabel: string }) {
  return (
    <div className="relative flex flex-col items-center gap-3 text-center">
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
