import { Link, useNavigate, useParams } from "@tanstack/react-router"
import {
  IconFolderOpen,
  IconPackage,
  IconPlayerPlay,
} from "@tabler/icons-react"
import { useQueryStates } from "nuqs"
import { toast } from "sonner"

import { ActionButton } from "@/components/blocks/creative/action-button"
import {
  CreativeStage,
  type StagePreviewState,
} from "@/components/blocks/creative/creative-stage"
import { CreativeSourceSummary } from "@/components/blocks/creative/creative-source-summary"
import { PlacementsPanel } from "@/components/blocks/creative/placements-panel"
import { StatusPill } from "@/components/blocks/creative/status-pill"
import { PageHeaderActions } from "@/components/blocks/layout/page-header-actions"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { placementSpecs } from "@/lib/placements"
import { creativePreviewSelectionParsers } from "@/lib/query-state"

export function CreativePage() {
  const { creativeId } = useParams({ from: "/creative/$creativeId" })
  const navigate = useNavigate()
  const {
    creativeById,
    generateAllPlacements,
    regeneratePlacement,
    openOutput,
    exportCreativeZip,
    selectTake,
    setVideoDraftSource,
  } = useHiggsfieldApp()
  const creative = creativeById(creativeId)

  // Preview selection: either a base take (by id) or a placement size.
  // A placement can be selected even before it has been generated, in which
  // case the stage shows an empty "not generated yet" state.
  const [
    { placement: selectedSize, take: selectedTakeId },
    setPreviewSelection,
  ] = useQueryStates(creativePreviewSelectionParsers)

  if (!creative) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <p className="text-muted-foreground">
          This creative could not be found.
        </p>
        <Link to="/" className="mt-4 inline-block text-ember hover:underline">
          Back to Create
        </Link>
      </div>
    )
  }

  const readyTakes = creative.takes.filter((take) => take.status === "ready")
  const readyPlacements = creative.placements.filter(
    (placement) => placement.status === "ready",
  )

  const selectedPlacement = selectedSize
    ? creative.placements.find((placement) => placement.size === selectedSize)
    : undefined
  const selectedTake =
    creative.takes.find((take) => take.id === selectedTakeId) ??
    creative.takes.find((take) => take.id === creative.selectedTakeId) ??
    readyTakes[0]
  const selectedTakeUrl = selectedTake?.url ?? creative.heroUrl

  // What the stage shows. A selected-but-ungenerated placement → empty
  // preview; one that is still rendering → a loading state.
  const selectedSource = selectedSize ? selectedPlacement : selectedTake
  const previewUrl = selectedSize
    ? (selectedPlacement?.url ?? "")
    : selectedTakeUrl
  const previewState: StagePreviewState = previewUrl
    ? "image"
    : selectedSize
      ? selectedPlacement?.status === "pending"
        ? "generating"
        : selectedPlacement?.status === "failed"
          ? "failed"
          : "empty"
      : // No size selected: a base take that is still rendering.
        "generating"
  const selectedStageSize = selectedSize
    ? placementSpecs[selectedSize]
    : { width: creative.ratioW, height: creative.ratioH }
  const sourceReferences = creative.referenceAssets ?? []
  const canUseLocalHero = Boolean(selectedSource?.filePath)

  const handleSelectTake = (takeId: string) => {
    void setPreviewSelection({ placement: null, take: takeId })
    selectTake(creative.id, takeId)
  }

  const handleAnimate = () => {
    if (!selectedSource?.url) return
    setVideoDraftSource({
      url: selectedSource.url,
      filePath: selectedSource.filePath,
      label: selectedSize
        ? `${creative.title} · ${selectedSize}`
        : creative.title,
      creativeId: creative.id,
    })
    toast("Image attached — animate it in the Video composer")
    navigate({ to: "/videos" })
  }

  return (
    <div className="mx-auto max-w-6xl px-8 pt-6 pb-24">
      <PageHeaderActions>
        <ActionButton
          disabled={!canUseLocalHero}
          onClick={() => void openOutput(selectedSource?.filePath)}
        >
          <IconFolderOpen className="size-3.5" /> Reveal
        </ActionButton>
        <ActionButton onClick={() => void exportCreativeZip(creative.id)}>
          <IconPackage className="size-3.5" /> ZIP ({readyPlacements.length})
        </ActionButton>
        <ActionButton
          primary
          disabled={!canUseLocalHero}
          onClick={handleAnimate}
          title="Attach this image to the Video composer"
        >
          <IconPlayerPlay className="size-3.5" /> Animate in Video
        </ActionButton>
      </PageHeaderActions>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-card/50 px-2.5 py-1 ring-1 ring-border/50 ring-inset">
          <StatusPill status={creative.status} />
        </span>
        <span className="inline-flex items-center rounded-full bg-card/50 px-2.5 py-1 font-mono text-xs text-muted-foreground ring-1 ring-border/50 ring-inset">
          {creative.ratioId}
        </span>
        <span className="inline-flex items-center rounded-full bg-card/50 px-2.5 py-1 font-mono text-xs text-muted-foreground ring-1 ring-border/50 ring-inset">
          {creative.model}
        </span>
      </div>

      <CreativeSourceSummary
        prompt={creative.prompt}
        references={sourceReferences}
        openOutput={openOutput}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <CreativeStage
          creative={creative}
          previewUrl={previewUrl}
          previewState={previewState}
          previewFilePath={selectedSource?.filePath}
          selectedTakeUrl={selectedTakeUrl}
          selectedSize={selectedStageSize}
          onSelectTake={handleSelectTake}
          openOutput={openOutput}
        />
        <PlacementsPanel
          creative={creative}
          selectedSize={selectedSize}
          onSelectPlacement={(placement) =>
            void setPreviewSelection({ placement })
          }
          generateAllPlacements={generateAllPlacements}
          regeneratePlacement={regeneratePlacement}
          openOutput={openOutput}
        />
      </div>
    </div>
  )
}
