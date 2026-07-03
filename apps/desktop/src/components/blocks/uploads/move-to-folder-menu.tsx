import { IconCheck, IconChevronDown, IconPlus } from "@tabler/icons-react"

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
  activeFolderId,
  disabled,
  onMove,
  onCreateAndMove,
}: {
  folders: UploadFolder[]
  activeFolderId: string | null
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
        {folders.map((folder) => {
          const isCurrentFolder = folder.id === activeFolderId

          return (
            <DropdownMenuItem
              key={folder.id}
              disabled={isCurrentFolder}
              onClick={() => onMove(folder.id)}
            >
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              {isCurrentFolder ? <IconCheck className="ml-auto" /> : null}
            </DropdownMenuItem>
          )
        })}
        {folders.length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem
          disabled={activeFolderId === null}
          onClick={() => onMove(null)}
        >
          <span className="flex-1">No folder</span>
          {activeFolderId === null ? <IconCheck className="ml-auto" /> : null}
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
