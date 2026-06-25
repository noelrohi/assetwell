import { Link } from "@tanstack/react-router"
import {
  IconArrowLeft,
  IconFolderOpen,
  IconPackage,
  IconPlayerPlay,
} from "@tabler/icons-react"

import { ActionButton } from "@/components/blocks/creative/action-button"
import { StatusPill } from "@/components/blocks/creative/status-pill"
import type { Creative } from "@/lib/higgsfield"

export function CreativeHeader({
  creative,
  readyPlacementsCount,
  canUseLocalHero,
  onReveal,
  onExport,
  onAnimate,
}: {
  creative: Creative
  readyPlacementsCount: number
  canUseLocalHero: boolean
  onReveal: () => void
  onExport: () => void
  onAnimate: () => void
}) {
  return (
    <>
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
          <ActionButton disabled={!canUseLocalHero} onClick={onReveal}>
            <IconFolderOpen className="size-4" /> Reveal
          </ActionButton>
          <ActionButton onClick={onExport}>
            <IconPackage className="size-4" /> ZIP ({readyPlacementsCount})
          </ActionButton>
          <ActionButton primary disabled={!canUseLocalHero} onClick={onAnimate}>
            <IconPlayerPlay className="size-4" /> Animate
          </ActionButton>
        </div>
      </div>
    </>
  )
}
