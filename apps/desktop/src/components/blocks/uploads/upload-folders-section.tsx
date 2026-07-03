import type { UploadFolder } from "@/lib/higgsfield/types"

import { UploadFolderTile } from "./upload-folder-tile"

export function UploadFoldersSection({
  folders,
  counts,
  onOpen,
  onRename,
  onDelete,
}: {
  folders: UploadFolder[]
  counts: ReadonlyMap<string, number>
  onOpen: (id: string) => void
  onRename: (folder: UploadFolder) => void
  onDelete: (folder: UploadFolder) => void
}) {
  return (
    <section className="mt-6 animate-in fade-in duration-200">
      <div className="mb-3">
        <h2 className="text-sm font-medium text-foreground">Folders</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Local groupings across the current brand view.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {folders.map((folder) => (
          <UploadFolderTile
            key={folder.id}
            folder={folder}
            count={counts.get(folder.id) ?? 0}
            onOpen={onOpen}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  )
}
