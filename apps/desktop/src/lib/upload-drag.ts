/**
 * Pure helpers shared by both drag-and-drop flows on the Uploads page:
 * dropping OS image files onto the page, and dragging existing upload
 * cards onto folder drop targets. Kept dependency-free so they are easy
 * to unit test in isolation from React and Electron.
 */

const UPLOAD_IMAGE_EXTENSIONS = new Set([
  "avif",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "webp",
])

export interface DroppableFile {
  name: string
  type?: string
}

/** True when a dropped file looks like a supported reference image. */
export function isImageFile(file: DroppableFile): boolean {
  if (file.type) return file.type.startsWith("image/")

  const extension = file.name.split(".").pop()?.toLowerCase()
  return Boolean(extension && UPLOAD_IMAGE_EXTENSIONS.has(extension))
}

export interface PartitionedDropFiles<T extends DroppableFile> {
  images: T[]
  skippedCount: number
}

/** Splits dropped files into supported images and everything else. */
export function partitionImageFiles<T extends DroppableFile>(
  files: readonly T[],
): PartitionedDropFiles<T> {
  const images: T[] = []
  let skippedCount = 0

  for (const file of files) {
    if (isImageFile(file)) images.push(file)
    else skippedCount += 1
  }

  return { images, skippedCount }
}

/** Custom DataTransfer MIME type used to drag existing upload cards internally. */
export const UPLOAD_DRAG_MIME_TYPE = "application/x-assetwell-upload-ids"

export function encodeUploadDragIds(ids: string[]): string {
  return JSON.stringify(ids)
}

export function decodeUploadDragIds(raw: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    const ids = parsed.filter((id): id is string => typeof id === "string")
    return ids.length > 0 ? ids : null
  } catch {
    return null
  }
}

export function resolveUploadDragIds(
  draggedId: string,
  selectedIds: ReadonlySet<string>,
): string[] {
  return selectedIds.has(draggedId) ? Array.from(selectedIds) : [draggedId]
}

interface DragTypesSource {
  types: readonly string[] | DOMStringList
}

function hasType(source: DragTypesSource | null | undefined, type: string) {
  if (!source) return false
  return Array.from(source.types).includes(type)
}

/** True when the in-progress drag carries our internal upload-card payload. */
export function isInternalUploadDrag(source: DragTypesSource | null) {
  return hasType(source, UPLOAD_DRAG_MIME_TYPE)
}

/** True when the in-progress drag is OS files, not an internal card drag. */
export function isOsFileDrag(source: DragTypesSource | null) {
  return hasType(source, "Files") && !isInternalUploadDrag(source)
}
