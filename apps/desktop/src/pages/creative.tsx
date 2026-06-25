import * as React from "react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { toast } from "sonner"

import { CreativeHeader } from "@/components/blocks/creative/creative-header"
import { CreativeStage } from "@/components/blocks/creative/creative-stage"
import { PlacementsPanel } from "@/components/blocks/creative/placements-panel"
import { useHiggsfieldApp } from "@/lib/higgsfield"

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
  const selectedSource =
    creative.takes.find((take) => take.url === selectedUrl) ??
    creative.takes.find((take) => take.id === creative.selectedTakeId) ??
    readyTakes[0]
  const canUseLocalHero = Boolean(selectedSource?.filePath)

  return (
    <div className="mx-auto max-w-6xl px-8 pt-6 pb-24">
      <CreativeHeader
        creative={creative}
        readyPlacementsCount={readyPlacements.length}
        canUseLocalHero={canUseLocalHero}
        onReveal={() => void openOutput(selectedSource?.filePath)}
        onExport={() => toast("Exporting ZIP…")}
        onAnimate={() => {
          if (selectedSource) {
            setVideoDraftSource({
              url: selectedSource.url,
              filePath: selectedSource.filePath,
              label: creative.title,
              creativeId: creative.id,
            })
          }
          toast("Image attached in the Video composer")
          navigate({ to: "/videos" })
        }}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <CreativeStage
          creative={creative}
          selectedUrl={selectedUrl}
          setSelectedUrl={setSelectedUrl}
          selectTake={selectTake}
        />
        <PlacementsPanel
          creative={creative}
          selectedSourceFilePath={selectedSource?.filePath}
          generateAllPlacements={generateAllPlacements}
          regeneratePlacement={regeneratePlacement}
          openOutput={openOutput}
        />
      </div>
    </div>
  )
}
