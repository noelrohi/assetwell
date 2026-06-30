import * as React from "react"
import {
  IconLibraryPhoto,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react"
import { useQueryState } from "nuqs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { brandMemorySearchParser } from "@/lib/query-state"
import { cn } from "@/lib/utils"

export function BrandMemoryPage() {
  const { uploads } = useHiggsfieldApp()
  const [search, setSearch] = useQueryState("q", brandMemorySearchParser)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const referenceLibrary = uploads.references
  const activeWorkspaceName = uploads.activeWorkspace.name
  const refreshUploads = uploads.refresh

  React.useEffect(() => {
    void refreshUploads()
  }, [refreshUploads])

  const filteredReferences = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return referenceLibrary

    return referenceLibrary.filter((asset) =>
      asset.name.toLowerCase().includes(query),
    )
  }, [referenceLibrary, search])

  async function removeReference(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from Uploads?`)) return

    setDeletingId(id)
    await uploads.deleteReference(id)
    setDeletingId(null)
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="max-w-xl">
          <h1 className="font-display text-2xl tracking-tight text-balance">
            Uploads
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground text-pretty">
            Local workspace folders for logos, product shots, and references the
            Create composer pulls from.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => void uploads.reveal()}>
            Open folder
          </Button>
          <Button onClick={() => void uploads.importFiles()}>
            <IconPlus />
            Add files
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-6">
        <p className="text-sm text-muted-foreground">
          {referenceLibrary.length} file
          {referenceLibrary.length === 1 ? "" : "s"} in {activeWorkspaceName}
        </p>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-64">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => void setSearch(event.target.value)}
              placeholder="Search files"
              className="rounded-full bg-card/50 pl-9"
              aria-label="Search Uploads files"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void uploads.refresh()}
            aria-label="Refresh Uploads"
          >
            <IconRefresh />
          </Button>
        </div>
      </div>

      {referenceLibrary.length === 0 ? (
        <div className="mt-6 grid min-h-72 place-items-center rounded-2xl border border-dashed border-border/70 p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
              <IconLibraryPhoto className="size-6" />
            </div>
            <h2 className="text-base font-medium text-foreground">
              No uploads in {activeWorkspaceName} yet
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add the image files your team reuses. Assetwell copies them into
              this workspace so the composer can attach them in a click.
            </p>
            <Button className="mt-5" onClick={() => void uploads.importFiles()}>
              <IconPlus />
              Add files
            </Button>
          </div>
        </div>
      ) : filteredReferences.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          No files match “{search.trim()}”.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filteredReferences.map((asset) => (
            <article
              key={asset.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border/60 bg-muted"
            >
              <img
                src={asset.url}
                alt={asset.name}
                className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.025]"
              />
              <div className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_-170px_120px_-60px_oklch(0_0_0_/_86%)] transition-opacity group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                <p className="truncate text-sm font-medium drop-shadow">
                  {asset.name}
                </p>
                <p className="mt-0.5 text-xs text-white/75 drop-shadow">
                  {formatBytes(asset.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void removeReference(asset.id, asset.name)}
                disabled={deletingId === asset.id}
                className={cn(
                  "absolute top-2 right-2 grid size-8 translate-y-1 place-items-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/55 disabled:opacity-50 group-hover:translate-y-0 group-hover:opacity-100",
                  deletingId === asset.id && "translate-y-0 opacity-100",
                )}
                aria-label={`Remove ${asset.name}`}
              >
                <IconTrash className="size-4" />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function formatBytes(size?: number | null) {
  if (!size) return "Local image"
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
