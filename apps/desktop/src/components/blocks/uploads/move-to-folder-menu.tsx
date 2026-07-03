import { IconChevronDown, IconPlus } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UploadFolder } from "@/lib/higgsfield/types"

export function MoveToFolderMenu({
  folders,
  disabled,
  onMove,
  onCreateAndMove,
}: {
  folders: UploadFolder[]
  disabled: boolean
  onMove: (folderId: string | null) => void
  onCreateAndMove: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Move to folder
          <IconChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Folders
        </DropdownMenuLabel>
        {folders.map((folder) => (
          <DropdownMenuItem key={folder.id} onClick={() => onMove(folder.id)}>
            {folder.name}
          </DropdownMenuItem>
        ))}
        {folders.length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onClick={() => onMove(null)}>
          No folder
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateAndMove}>
          <IconPlus />
          New folder…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
