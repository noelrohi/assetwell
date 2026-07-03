import {
  IconDotsVertical,
  IconFolder,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UploadFolder } from "@/lib/higgsfield/types"

export function formatFolderCount(count: number) {
  if (count === 0) return "Empty"
  if (count === 1) return "1 upload"
  return `${count} uploads`
}

interface UploadFolderTileProps {
  folder: UploadFolder
  count: number
  onOpen: (id: string) => void
  onRename: (folder: UploadFolder) => void
  onDelete: (folder: UploadFolder) => void
}

export function UploadFolderTile({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
}: UploadFolderTileProps) {
  const countLabel = formatFolderCount(count)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group relative">
          <button
            type="button"
            onClick={() => onOpen(folder.id)}
            aria-label={`Open folder ${folder.name}, ${countLabel}`}
            className="flex min-h-32 w-full flex-col justify-between gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 text-left outline-none transition duration-150 ease-out hover:border-border hover:bg-card/70 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]"
          >
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-xl border border-border/70 bg-background text-muted-foreground transition-colors duration-150 group-hover:border-ember/30 group-hover:text-ember"
            >
              <IconFolder className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {folder.name}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {countLabel}
              </span>
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`More actions for ${folder.name}`}
                className="absolute top-3 right-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-background hover:text-foreground data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:opacity-100"
              >
                <IconDotsVertical className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => onRename(folder)}>
                <IconPencil /> Rename folder
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDelete(folder)}>
                <IconTrash /> Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={() => onRename(folder)}>
          <IconPencil /> Rename folder
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onDelete(folder)}>
          <IconTrash /> Delete folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
