import * as React from "react"
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconFolder,
  IconLibraryPhoto,
  IconLink,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"

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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { uploadsSearchParser } from "@/lib/query-state"
import {
  buildUploadSearchIndex,
  filterUploadSearchIndex,
} from "@/lib/uploads-search"
import {
  countReferencesByFolder,
  referencesInFolder,
} from "@/lib/upload-folders"
import { cn } from "@/lib/utils"
import type {
  Brand,
  BrandView,
  ReferenceAsset,
  UploadFolder,
} from "@/lib/higgsfield/types"

const uploadsFolderParser = parseAsString

type FolderEditorState =
  | { mode: "create"; afterCreate?: (folderId: string) => Promise<void> | void }
  | { mode: "edit"; folder: UploadFolder }

export function UploadsPage() {
  const { uploads, brands, folders } = useHiggsfieldApp()
  const [search, setSearch] = useQueryState("q", uploadsSearchParser)
  const [folderId, setFolderId] = useQueryState("folder", uploadsFolderParser)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [moving, setMoving] = React.useState(false)
  const [folderEditor, setFolderEditor] =
    React.useState<FolderEditorState | null>(null)
  const referenceLibrary = uploads.references
  const refreshUploads = uploads.refresh
  const itemLabel = uploads.isRemote ? "upload" : "file"
  const selectedCount = selectedIds.size
  const searchTerm = search.trim()
  const folderItems = folders.folders
  const activeFolder = React.useMemo(
    () =>
      folderId
        ? (folderItems.find((folder) => folder.id === folderId) ?? null)
        : null,
    [folderId, folderItems],
  )
  const activeFolderId = activeFolder?.id ?? null
  const isSearching = searchTerm.length > 0
  const showFolderTiles =
    !isSearching && !activeFolder && folderItems.length > 0
  const showHeaderNewFolder = Boolean(activeFolder) || folderItems.length === 0

  React.useEffect(() => {
    void refreshUploads()
  }, [refreshUploads])

  React.useEffect(() => {
    const visibleIds = new Set(referenceLibrary.map((asset) => asset.id))
    setSelectedIds((current) => {
      let changed = false
      const next = new Set<string>()

      for (const id of current) {
        if (visibleIds.has(id)) next.add(id)
        else changed = true
      }

      return changed ? next : current
    })
  }, [referenceLibrary])

  const uploadSearchIndex = React.useMemo(
    () => buildUploadSearchIndex(referenceLibrary, brands.brands, folderItems),
    [brands.brands, folderItems, referenceLibrary],
  )

  const folderCounts = React.useMemo(
    () => countReferencesByFolder(referenceLibrary),
    [referenceLibrary],
  )

  const visibleReferences = React.useMemo(() => {
    if (isSearching) return filterUploadSearchIndex(uploadSearchIndex, search)
    return referencesInFolder(referenceLibrary, activeFolderId)
  }, [activeFolderId, isSearching, referenceLibrary, search, uploadSearchIndex])

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  async function moveSelection(brandId: string | null) {
    const uploadIds = Array.from(selectedIds)
    if (uploadIds.length === 0) return

    setMoving(true)
    const moved = await brands.assignUploads(uploadIds, brandId)
    setMoving(false)
    if (moved) setSelectedIds(new Set())
  }

  async function moveSelectionToFolder(nextFolderId: string | null) {
    const uploadIds = Array.from(selectedIds)
    if (uploadIds.length === 0) return false

    setMoving(true)
    const moved = await folders.assignUploads(uploadIds, nextFolderId)
    setMoving(false)
    if (moved) setSelectedIds(new Set())
    return moved
  }

  async function submitFolderName(name: string) {
    if (!folderEditor) return false
    if (folderEditor.mode === "edit") {
      return folders.renameFolder(folderEditor.folder.id, name)
    }

    const createdFolderId = await folders.createFolder(name)
    if (!createdFolderId) return false
    await folderEditor.afterCreate?.(createdFolderId)
    return true
  }

  async function deleteUploadFolder(folder: UploadFolder) {
    const deleted = await folders.deleteFolder(folder.id)
    if (deleted && activeFolderId === folder.id) void setFolderId(null)
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="max-w-xl">
          <h1 className="font-display text-2xl tracking-tight text-balance">
            Uploads
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {showHeaderNewFolder ? (
            <Button
              variant="outline"
              onClick={() => setFolderEditor({ mode: "create" })}
            >
              <IconFolder />
              New folder
            </Button>
          ) : null}
          {uploads.canRevealReferences ? (
            <Button variant="outline" onClick={() => void uploads.reveal()}>
              Open folder
            </Button>
          ) : null}
          <Button onClick={() => void uploads.importFiles()}>
            <IconPlus />
            Add files
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 border-t border-border/60 pt-6 lg:flex-row lg:items-center lg:justify-between">
        <BrandFilters
          brands={brands.brands}
          view={brands.view}
          activeBrandId={brands.activeBrandId}
          onChange={(view, id) => void brands.setActiveBrand(view, id)}
        />
        <div className="flex gap-2 lg:justify-end">
          <div className="relative w-full sm:w-64">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => void setSearch(event.target.value)}
              placeholder={`Search ${itemLabel}s`}
              className="rounded-full bg-card/50 pl-9"
              aria-label="Search Uploads"
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

      {selectedCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/60 px-3 py-2 shadow-sm">
          <p className="text-sm font-medium text-foreground">
            {selectedCount} selected
          </p>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={moving}>
                  Move to
                  <IconChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Move uploads
                </DropdownMenuLabel>
                {brands.brands.map((brand) => (
                  <DropdownMenuItem
                    key={brand.id}
                    onClick={() => void moveSelection(brand.id)}
                  >
                    {brand.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void moveSelection(null)}>
                  Unsorted
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={moving}>
                  Move to folder
                  <IconChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Move uploads
                </DropdownMenuLabel>
                {folderItems.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => void moveSelectionToFolder(folder.id)}
                  >
                    {folder.name}
                  </DropdownMenuItem>
                ))}
                {folderItems.length > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  onClick={() => void moveSelectionToFolder(null)}
                >
                  No folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    setFolderEditor({
                      mode: "create",
                      afterCreate: async (createdFolderId) => {
                        await moveSelectionToFolder(createdFolderId)
                      },
                    })
                  }
                >
                  <IconPlus />
                  New folder…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelectedIds((current) =>
                  current.size === 0 ? current : new Set(),
                )
              }
              disabled={moving}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {!isSearching && activeFolder ? (
        <Breadcrumb className="mt-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button type="button" onClick={() => void setFolderId(null)}>
                  Uploads
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{activeFolder.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      {showFolderTiles ? (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-foreground">Folders</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Local groupings across the current brand view.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFolderEditor({ mode: "create" })}
            >
              <IconPlus />
              New folder
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {folderItems.map((folder) => (
              <UploadFolderTile
                key={folder.id}
                folder={folder}
                count={folderCounts.get(folder.id) ?? 0}
                onOpen={(id) => void setFolderId(id)}
                onRename={(folder) => setFolderEditor({ mode: "edit", folder })}
                onDelete={(folder) => void deleteUploadFolder(folder)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {referenceLibrary.length === 0 && folderItems.length === 0 ? (
        <div className="mt-6 grid min-h-72 place-items-center rounded-2xl border border-dashed border-border/70 p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
              <IconLibraryPhoto className="size-6" />
            </div>
            <h2 className="text-base font-medium text-foreground">
              {emptyTitle(brands.view, brands.activeLabel)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add image files your team reuses. Assetwell uploads them to
              Higgsfield and keeps brand organization as local metadata.
            </p>
            <Button className="mt-5" onClick={() => void uploads.importFiles()}>
              <IconPlus />
              Add files
            </Button>
          </div>
        </div>
      ) : isSearching && visibleReferences.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
          No {itemLabel}s match “{searchTerm}”.
        </div>
      ) : !isSearching && activeFolder && visibleReferences.length === 0 ? (
        <div className="mt-6 grid min-h-72 place-items-center rounded-2xl border border-dashed border-border/70 p-8 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground">
              <IconFolder className="size-6" />
            </div>
            <h2 className="text-base font-medium text-foreground">
              No uploads in {activeFolder.name} yet
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Move existing uploads into this folder, or add more files to the
              shared library.
            </p>
            <Button className="mt-5" onClick={() => void uploads.importFiles()}>
              <IconPlus />
              Add files
            </Button>
          </div>
        </div>
      ) : visibleReferences.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visibleReferences.map((asset) => (
              <UploadCard
                key={asset.id}
                asset={asset}
                selected={selectedIds.has(asset.id)}
                isRemote={uploads.isRemote}
                onToggle={toggleSelected}
              />
            ))}
          </div>
          {uploads.hasMore ? (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => void uploads.loadMore()}
                disabled={uploads.loadingMore}
              >
                {uploads.loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <UploadFolderFormDialog
        state={folderEditor}
        onOpenChange={(open) => {
          if (!open) setFolderEditor(null)
        }}
        onSubmit={submitFolderName}
      />
    </div>
  )
}

function UploadFolderTile({
  folder,
  count,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: UploadFolder
  count: number
  onOpen: (id: string) => void
  onRename: (folder: UploadFolder) => void
  onDelete: (folder: UploadFolder) => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(folder.id)}
          className="group flex min-h-32 flex-col justify-between rounded-2xl border border-border/60 bg-card/50 p-4 text-left outline-none transition-all hover:border-border hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.99]"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-border/70 bg-background text-muted-foreground transition-colors group-hover:text-foreground">
              <IconFolder className="size-5" />
            </span>
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {count}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {folder.name}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {count === 1 ? "1 upload" : `${count} uploads`}
            </span>
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
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

function UploadFolderFormDialog({
  state,
  onOpenChange,
  onSubmit,
}: {
  state: FolderEditorState | null
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<boolean>
}) {
  const [name, setName] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const open = Boolean(state)
  const isEditing = state?.mode === "edit"

  React.useEffect(() => {
    if (!state) return
    setName(state.mode === "edit" ? state.folder.name : "")
    setError(null)
    setSaving(false)
  }, [state])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim().replace(/\s+/g, " ")

    if (!trimmed) {
      setError("Name is required.")
      return
    }

    setSaving(true)
    const saved = await onSubmit(trimmed)
    setSaving(false)

    if (saved) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Rename folder" : "New folder"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Change the folder label shown on the Uploads page. Higgsfield uploads stay where they are."
                : "Create a local folder for grouping Uploads without changing Higgsfield storage."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-5">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="upload-folder-name">Folder name</FieldLabel>
              <Input
                id="upload-folder-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
                disabled={saving}
                autoFocus
                placeholder="e.g. Spring launch"
              />
              <FieldDescription>
                Folders are local Assetwell metadata layered over the shared
                Uploads library.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : isEditing
                  ? "Rename folder"
                  : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BrandFilters({
  brands,
  view,
  activeBrandId,
  onChange,
}: {
  brands: Brand[]
  view: BrandView
  activeBrandId: string | null
  onChange: (view: BrandView, id?: string | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        label="All"
        active={view === "all"}
        onClick={() => onChange("all")}
      />
      {brands.map((brand) => (
        <FilterChip
          key={brand.id}
          label={brand.name}
          active={view === "brand" && activeBrandId === brand.id}
          onClick={() => onChange("brand", brand.id)}
        />
      ))}
      <FilterChip
        label="Unsorted"
        active={view === "unsorted"}
        onClick={() => onChange("unsorted")}
      />
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-ember/40 bg-ember/10 text-ember"
          : "border-border/70 bg-card/50 text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  )
}

interface UploadCardProps {
  asset: ReferenceAsset
  selected: boolean
  isRemote: boolean
  onToggle: (id: string) => void
}

const UploadCard = React.memo(function UploadCard({
  asset,
  selected,
  isRemote,
  onToggle,
}: UploadCardProps) {
  const handleClick = React.useCallback(() => {
    onToggle(asset.id)
  }, [asset.id, onToggle])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          aria-pressed={selected}
          className={cn(
            "group relative aspect-square overflow-hidden rounded-2xl border bg-muted text-left outline-none transition-all [contain-intrinsic-size:220px_220px] [content-visibility:auto] focus-visible:ring-[3px] focus-visible:ring-ring/50",
            selected
              ? "border-ember ring-2 ring-ember/35"
              : "border-border/60 hover:border-border",
          )}
        >
          <ViewportUploadImage src={asset.url} alt={asset.name} />
          <span
            className={cn(
              "absolute top-2 left-2 grid size-6 place-items-center rounded-full border text-white shadow-sm backdrop-blur-sm transition-opacity",
              selected
                ? "border-ember bg-ember text-ember-foreground"
                : "border-white/50 bg-black/35 opacity-0 group-hover:opacity-100",
            )}
            aria-hidden="true"
          >
            {selected ? <IconCheck className="size-3.5" /> : null}
          </span>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 text-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
            <p className="text-xs text-white/75 drop-shadow">
              {formatUploadDetail(asset, isRemote)}
            </p>
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={() => void copyUploadImage(asset)}>
          <IconCopy /> Copy image
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void downloadUploadImage(asset)}>
          <IconDownload /> Download image
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void copyUploadImageLink(asset)}>
          <IconLink /> Copy image link
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => openUploadImage(asset)}>
          <IconExternalLink /> Open image in new tab
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

async function copyUploadImage(asset: ReferenceAsset) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    try {
      await writeUploadImageLink(asset)
      toast("Image copy is not supported", {
        description: "Copied the image link instead.",
      })
    } catch {
      toast("Could not copy image")
    }
    return
  }

  try {
    const sourceBlob = await fetchImageBlob(asset.url)
    const clipboardBlob =
      sourceBlob.type === "image/png"
        ? sourceBlob
        : await convertImageBlobToPng(sourceBlob)

    await navigator.clipboard.write([
      new ClipboardItem({ [clipboardBlob.type]: clipboardBlob }),
    ])
    toast("Image copied")
  } catch {
    toast("Could not copy image", {
      description: "Try copying the image link instead.",
    })
  }
}

async function downloadUploadImage(asset: ReferenceAsset) {
  try {
    const blob = await fetchImageBlob(asset.url)
    triggerBlobDownload(blob, uploadImageFileName(asset, blob.type))
    toast("Image download started")
  } catch {
    triggerUrlDownload(asset.url, uploadImageFileName(asset))
    toast("Image opened for download", {
      description: "If it opens in the browser, save it from there.",
    })
  }
}

async function copyUploadImageLink(asset: ReferenceAsset) {
  try {
    await writeUploadImageLink(asset)
    toast("Image link copied")
  } catch {
    toast("Could not copy image link")
  }
}

async function writeUploadImageLink(asset: ReferenceAsset) {
  await navigator.clipboard.writeText(asset.url)
}

function openUploadImage(asset: ReferenceAsset) {
  window.open(asset.url, "_blank", "noopener,noreferrer")
}

async function fetchImageBlob(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load image (${response.status})`)

  const blob = await response.blob()
  if (!blob.type.startsWith("image/")) {
    throw new Error("Downloaded asset is not an image")
  }

  return blob
}

async function convertImageBlobToPng(blob: Blob) {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const context = canvas.getContext("2d")
  if (!context) throw new Error("Could not prepare image for clipboard")

  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((pngBlob) => {
      if (pngBlob) resolve(pngBlob)
      else reject(new Error("Could not prepare image for clipboard"))
    }, "image/png")
  })
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  triggerUrlDownload(url, fileName)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function triggerUrlDownload(url: string, fileName: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
}

function uploadImageFileName(asset: ReferenceAsset, contentType?: string) {
  const name = sanitizeDownloadName(asset.name) || "assetwell-image"
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name

  return `${name}${imageExtensionFromUrl(asset.url) ?? imageExtensionForType(contentType) ?? ".png"}`
}

function sanitizeDownloadName(name: string) {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .replace(/^\.+$/, "")
}

function imageExtensionFromUrl(url: string) {
  try {
    const extension = new URL(url).pathname.match(
      /\.(avif|gif|jpeg|jpg|png|webp)$/i,
    )?.[0]
    return extension?.toLowerCase()
  } catch {
    return null
  }
}

function imageExtensionForType(contentType?: string) {
  switch (contentType) {
    case "image/avif":
      return ".avif"
    case "image/gif":
      return ".gif"
    case "image/jpeg":
      return ".jpg"
    case "image/png":
      return ".png"
    case "image/webp":
      return ".webp"
    default:
      return null
  }
}

function ViewportUploadImage({ src, alt }: { src: string; alt: string }) {
  const rootRef = React.useRef<HTMLSpanElement | null>(null)
  const [shouldLoad, setShouldLoad] = React.useState(false)

  React.useEffect(() => {
    const element = rootRef.current
    if (!element) return

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShouldLoad(Boolean(entry?.isIntersecting))
      },
      { rootMargin: "360px" },
    )
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <span ref={rootRef} className="block size-full bg-muted">
      {shouldLoad ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : null}
    </span>
  )
}

function emptyTitle(view: BrandView, activeLabel: string) {
  if (view === "brand") return `No uploads in ${activeLabel} yet`
  if (view === "unsorted") return "No unsorted uploads"
  return "No shared uploads found"
}

function formatUploadDetail(
  asset: { createdAt?: string | null; sizeBytes?: number | null },
  isRemote: boolean,
) {
  if (isRemote) return formatDate(asset.createdAt) ?? "Higgsfield upload"
  return formatBytes(asset.sizeBytes)
}

function formatBytes(size?: number | null) {
  if (!size) return "Local image"
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value?: string | null) {
  if (!value) return null
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return null

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp)
}
