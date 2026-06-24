import * as React from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  IconArrowLeft,
  IconChecks,
  IconFolderOpen,
  IconLoader2,
  IconPackage,
  IconPhoto,
  IconPlayerPlay,
  IconRefresh,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { aspectOf, placementSpecs } from "@/lib/placements"
import {
  useHiggsfieldApp,
  type JobStatus,
  type PlacementResult,
} from "@/lib/higgsfield"

function ActionButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode
  onClick?: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
        primary
          ? "bg-ember text-ember-foreground hover:brightness-105 ember-glow"
          : "border border-border/70 bg-background/50 hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}

function PlacementTile({
  p,
  onRegenerate,
  onReveal,
}: {
  p: PlacementResult
  onRegenerate: () => void
  onReveal: () => void
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
              className="flex items-center gap-1 font-mono text-[0.6rem] text-muted-foreground hover:text-foreground"
            >
              <IconRefresh className="size-3" /> retry
            </button>
          </div>
        )}

        {p.status === "ready" && (
          <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-background/80 via-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onRegenerate}
              className="grid size-7 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
              title="Regenerate"
            >
              <IconRefresh className="size-3.5" />
            </button>
            <button
              onClick={onReveal}
              className="grid size-7 place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
              title="Reveal in Finder"
            >
              <IconFolderOpen className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-2.5 py-2">
        <span className="font-mono text-[0.65rem] text-foreground/80">{p.size}</span>
        <span className="truncate pl-2 text-[0.65rem] text-muted-foreground">
          {spec.label}
        </span>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: JobStatus }) {
  const map = {
    ready: { c: "text-success", t: "Ready" },
    pending: { c: "text-ember", t: "Generating" },
    failed: { c: "text-destructive", t: "Failed" },
  } as const
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", map[status].c)}>
      <span className="size-1.5 rounded-full bg-current" />
      {map[status].t}
    </span>
  )
}

export function CreativePage() {
  const { creativeId } = useParams({ from: "/creative/$creativeId" })
  const navigate = useNavigate()
  const {
    creativeById,
    generateAllPlacements,
    regeneratePlacement,
    openOutput,
    selectTake,
    setVideoDraftSource,
  } = useHiggsfieldApp()
  const creative = creativeById(creativeId)

  const [selectedUrl, setSelectedUrl] = React.useState(creative?.heroUrl ?? "")

  React.useEffect(() => {
    if (creative) setSelectedUrl(creative.heroUrl)
  }, [creative])

  if (!creative) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <p className="text-muted-foreground">This creative could not be found.</p>
        <Link to="/" className="mt-4 inline-block text-ember hover:underline">
          Back to Create
        </Link>
      </div>
    )
  }

  const readyTakes = creative.takes.filter((t) => t.status === "ready")
  const hasPlacements = creative.placements.length > 0
  const readyPlacements = creative.placements.filter((p) => p.status === "ready")

  return (
    <div className="mx-auto max-w-6xl px-8 pt-6 pb-24">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <IconArrowLeft className="size-4" /> Create
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl tracking-tight text-balance">
            {creative.title}
          </h1>
          <div className="mt-1.5 flex items-center gap-2.5 font-mono text-xs text-muted-foreground">
            <span>{creative.ratioId}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{creative.model}</span>
            <span className="text-muted-foreground/40">·</span>
            <StatusPill status={creative.status} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={() =>
              void openOutput(
                readyTakes.find((take) => take.url === selectedUrl)?.filePath ??
                  readyTakes[0]?.filePath,
              )
            }
          >
            <IconFolderOpen className="size-4" /> Reveal
          </ActionButton>
          <ActionButton onClick={() => toast("Exporting ZIP…")}>
            <IconPackage className="size-4" /> ZIP ({readyPlacements.length})
          </ActionButton>
          <ActionButton
            primary
            onClick={() => {
              const source =
                creative.takes.find((take) => take.url === selectedUrl) ??
                creative.takes.find((take) => take.id === creative.selectedTakeId) ??
                readyTakes[0]
              if (source) {
                setVideoDraftSource({
                  url: source.url,
                  filePath: source.filePath,
                  label: creative.title,
                  creativeId: creative.id,
                })
              }
              toast("Image attached in the Video composer")
              navigate({ to: "/videos" })
            }}
          >
            <IconPlayerPlay className="size-4" /> Animate
          </ActionButton>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* stage */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/30">
            <div
              className="mx-auto max-h-[70vh] w-full"
              style={{ aspectRatio: aspectOf(creative.ratioW, creative.ratioH) }}
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

          {/* takes */}
          <div>
            <p className="mb-2 font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
              Takes — pick your hero
            </p>
            <div className="flex gap-2.5">
              {creative.takes.map((t) => (
                <button
                  key={t.id}
                  disabled={t.status !== "ready"}
                  onClick={() => {
                    setSelectedUrl(t.url)
                    selectTake(creative.id, t.id)
                  }}
                  className={cn(
                    "relative aspect-square w-20 overflow-hidden rounded-lg border-2 transition-all",
                    selectedUrl === t.url
                      ? "border-ember"
                      : "border-transparent hover:border-border",
                  )}
                >
                  {t.status === "ready" ? (
                    <img src={t.url} alt="take" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center bg-muted/40">
                      <IconLoader2 className="size-4 animate-spin text-ember" />
                    </div>
                  )}
                  {creative.selectedTakeId === t.id && (
                    <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-ember text-ember-foreground">
                      <IconChecks className="size-2.5" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* placements panel */}
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
              {creative.placements.map((p) => (
                <PlacementTile
                  key={p.size}
                  p={p}
                  onRegenerate={() =>
                    void regeneratePlacement(creative.id, p.size)
                  }
                  onReveal={() => void openOutput(p.filePath ?? p.url)}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
