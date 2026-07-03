import * as React from "react"
import { IconLibraryPhoto } from "@tabler/icons-react"

function uploadDragLabel(count: number) {
  return `${count} image${count === 1 ? "" : "s"}`
}

export function useUploadDragBadge() {
  const badgeRef = React.useRef<HTMLDivElement>(null)
  const labelRef = React.useRef<HTMLSpanElement>(null)

  const setDragImage = React.useCallback(
    (dataTransfer: DataTransfer, count: number) => {
      const badge = badgeRef.current
      const label = labelRef.current
      if (!badge || !label) return

      label.textContent = uploadDragLabel(count)
      const offsetX = Math.round(badge.offsetWidth / 2)
      const offsetY = Math.round(badge.offsetHeight / 2)
      dataTransfer.setDragImage(badge, offsetX, offsetY)
    },
    [],
  )

  return {
    dragBadge: (
      <div
        ref={badgeRef}
        aria-hidden="true"
        className="pointer-events-none fixed top-[-1000px] left-[-1000px] inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium whitespace-nowrap text-foreground shadow-lg"
      >
        <IconLibraryPhoto className="size-4 text-muted-foreground" />
        <span ref={labelRef}>{uploadDragLabel(1)}</span>
      </div>
    ),
    setDragImage,
  }
}
