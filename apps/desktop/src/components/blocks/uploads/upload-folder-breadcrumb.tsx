import * as React from "react"
import {
  IconDotsVertical,
  IconFolder,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  onRename,
  onDelete,
  onDropUploadIds,
}: {
  folder: UploadFolder
  count: number
  onBack: () => void
  onRename: (folder: UploadFolder) => void
  onDelete: (folder: UploadFolder) => void
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
    <Breadcrumb className="group mt-6 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-1">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`More actions for ${folder.name}`}
              className="text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-card hover:text-foreground data-[state=open]:bg-card data-[state=open]:text-foreground data-[state=open]:opacity-100"
            >
              <IconDotsVertical className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onSelect={() => onRename(folder)}>
              <IconPencil /> Rename folder
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDelete(folder)}>
              <IconTrash /> Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Breadcrumb>
  )
}
