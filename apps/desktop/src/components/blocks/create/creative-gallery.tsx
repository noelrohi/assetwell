import { IconWand } from "@tabler/icons-react"

import { CreativeCard } from "@/components/blocks/create/creative-card"
import { useHiggsfieldApp } from "@/lib/higgsfield"

export function CreativeGallery() {
  const { creatives } = useHiggsfieldApp()

  if (creatives.length === 0) {
    return (
      <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center rounded-2xl border border-dashed border-border/70 bg-card/25 px-6 py-10 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-muted/50 text-muted-foreground">
          <IconWand className="size-5" />
        </span>
        <p className="mt-3 text-sm text-muted-foreground">
          Your generated creatives will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {creatives.length} recent creative{creatives.length === 1 ? "" : "s"}
        </p>
        <p className="font-mono text-[0.65rem] text-muted-foreground/70">
          newest first
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {creatives.map((creative, index) => (
          <CreativeCard key={creative.id} creative={creative} index={index} />
        ))}
      </div>
    </div>
  )
}
