import * as React from "react"
import { IconFolder } from "@tabler/icons-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import type { UploadFolder } from "@/lib/higgsfield/types"
import {
  decodeUploadDragIds,
  isInternalUploadDrag,
  UPLOAD_DRAG_MIME_TYPE,
} from "@/lib/upload-drag"
import { cn } from "@/lib/utils"

import { formatFolderCount } from "./upload-folder-tile"

export function UploadFolderBreadcrumb({
  folder,
  count,
  onBack,
  onDropUploadIds,
}: {
  folder: UploadFolder
  count: number
  onBack: () => void
  onDropUploadIds?: (ids: string[]) => void
}) {
  const [isDropTarget, setIsDropTarget] = React.useState(false)
  const dragDepthRef = React.useRef(0)

  const handleDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      if (!isInternalUploadDrag(event.dataTransfer)) return
      event.preventDefault()
      dragDepthRef.current += 1
      setIsDropTarget(true)
    },
    [],
  )

  const handleDragOver = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      if (!isInternalUploadDrag(event.dataTransfer)) return
      event.preventDefault()
    },
    [],
  )

  const handleDragLeave = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      if (!isInternalUploadDrag(event.dataTransfer)) return
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) setIsDropTarget(false)
    },
    [],
  )

  const handleDrop = React.useCallback(
    (event: React.DragEvent<HTMLButtonElement>) => {
      if (!isInternalUploadDrag(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      dragDepthRef.current = 0
      setIsDropTarget(false)

      const ids = decodeUploadDragIds(
        event.dataTransfer.getData(UPLOAD_DRAG_MIME_TYPE),
      )
      if (ids) onDropUploadIds?.(ids)
    },
    [onDropUploadIds],
  )

  return (
    <Breadcrumb className="mt-6 animate-in fade-in slide-in-from-top-1 duration-200">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button
              type="button"
              onClick={onBack}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "rounded-sm px-1 -mx-1",
                isDropTarget && "bg-ember/10 text-ember ring-1 ring-ember/35",
              )}
            >
              Uploads
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="inline-flex items-center gap-1.5">
            <IconFolder
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            {folder.name}
            <span className="font-normal text-muted-foreground">
              · {formatFolderCount(count)}
            </span>
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
