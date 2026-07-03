import * as React from "react"
import { toast } from "sonner"

import { friendlyError } from "./higgsfield/text"
import type {
  BrandsDomain,
  UploadFoldersDomain,
  UploadsDomain,
} from "./higgsfield/types"
import {
  isInternalUploadDrag,
  isOsFileDrag,
  partitionImageFiles,
} from "./upload-drag"

function getDesktopBridge() {
  return typeof window === "undefined" ? undefined : window.assetwell
}

export interface UseDroppedUploadsOptions {
  uploads: UploadsDomain
  brands: BrandsDomain
  folders: UploadFoldersDomain
  activeFolderId: string | null
}

export interface DropZoneHandlers {
  onDragEnter: (event: React.DragEvent) => void
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: (event: React.DragEvent) => void
  onDrop: (event: React.DragEvent) => void
}

export interface UseDroppedUploadsResult {
  /** Whether an OS file drag is currently hovering the page (drives the overlay). */
  isDraggingFiles: boolean
  /** Whether a drop is currently being imported. */
  isImporting: boolean
  dropZoneHandlers: DropZoneHandlers
}

/**
 * Drives the "drop OS image files onto the Uploads page" flow: filtering to
 * images, resolving absolute paths via the preload bridge, importing them
 * (remote Higgsfield uploads or the local file library), and quietly
 * assigning the result to the active brand / open folder.
 */
export function useDroppedUploads({
  uploads,
  brands,
  folders,
  activeFolderId,
}: UseDroppedUploadsOptions): UseDroppedUploadsResult {
  const [isDraggingFiles, setIsDraggingFiles] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const dragDepth = React.useRef(0)

  const activeFolderIdRef = React.useRef(activeFolderId)
  activeFolderIdRef.current = activeFolderId

  const assignAndAnnounce = React.useCallback(
    async (uploadIds: string[]) => {
      const activeBrand = brands.activeBrand
      const folderId = activeFolderIdRef.current
      let announced = false

      if (activeBrand) {
        await brands.assignUploads(uploadIds, activeBrand.id)
        announced = true
      }

      if (folderId) {
        await folders.assignUploads(uploadIds, folderId, !announced)
        announced = true
      }

      if (!announced) {
        toast(
          `Added ${uploadIds.length} upload${uploadIds.length === 1 ? "" : "s"}`,
        )
      }
    },
    [brands, folders],
  )

  const importDroppedFiles = React.useCallback(
    async (files: File[]) => {
      const bridge = getDesktopBridge()
      if (!bridge) {
        toast("Open the desktop app to add files")
        return
      }

      const { images, skippedCount } = partitionImageFiles(files)
      if (images.length === 0) {
        if (skippedCount > 0) {
          toast(
            skippedCount === 1
              ? "That file isn't an image"
              : "Those files aren't images",
          )
        }
        return
      }

      if (skippedCount > 0) {
        toast(
          `Skipped ${skippedCount} non-image file${skippedCount === 1 ? "" : "s"}`,
        )
      }

      setIsImporting(true)
      try {
        const filePaths = bridge.app.getDroppedFilePaths(images)

        const addedUploadIds = uploads.isRemote
          ? await importDroppedRemoteFiles(bridge, filePaths)
          : await importDroppedLocalFiles(bridge, filePaths)

        if (addedUploadIds.length === 0) return

        await assignAndAnnounce(addedUploadIds)
        await uploads.refresh()
      } finally {
        setIsImporting(false)
      }
    },
    [assignAndAnnounce, uploads],
  )

  const onDragEnter = React.useCallback((event: React.DragEvent) => {
    if (!isOsFileDrag(event.dataTransfer)) return
    event.preventDefault()
    dragDepth.current += 1
    setIsDraggingFiles(true)
  }, [])

  const onDragOver = React.useCallback((event: React.DragEvent) => {
    if (!isOsFileDrag(event.dataTransfer)) return
    event.preventDefault()
  }, [])

  const onDragLeave = React.useCallback((event: React.DragEvent) => {
    if (isInternalUploadDrag(event.dataTransfer)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDraggingFiles(false)
  }, [])

  const onDrop = React.useCallback(
    (event: React.DragEvent) => {
      if (isInternalUploadDrag(event.dataTransfer)) return
      event.preventDefault()
      dragDepth.current = 0
      setIsDraggingFiles(false)

      const files = Array.from(event.dataTransfer.files)
      if (files.length === 0) return

      void importDroppedFiles(files)
    },
    [importDroppedFiles],
  )

  return {
    isDraggingFiles,
    isImporting,
    dropZoneHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}

async function importDroppedRemoteFiles(
  bridge: NonNullable<ReturnType<typeof getDesktopBridge>>,
  filePaths: string[],
) {
  const results = await Promise.allSettled(
    filePaths.map((filePath) => bridge.higgsfield.createUpload({ filePath })),
  )
  const uploaded = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  )
  const failed = results.some((result) => result.status === "rejected")

  if (failed) {
    toast(
      uploaded.length > 0
        ? "Some files could not be added"
        : "Could not add files to Uploads",
    )
  }

  return uploaded.map((upload) => upload.uploadId)
}

async function importDroppedLocalFiles(
  bridge: NonNullable<ReturnType<typeof getDesktopBridge>>,
  filePaths: string[],
) {
  try {
    const before = await bridge.library.loadUploadsSnapshot()
    const beforeIds = new Set(before.references.map((asset) => asset.id))

    const after = await bridge.library.importReferenceAssetPaths({
      filePaths,
    })
    const addedIds = after.references
      .filter((asset) => !beforeIds.has(asset.id))
      .map((asset) => asset.id)

    if (addedIds.length === 0) {
      toast("No new files were added", {
        description: "Those files may already be in Uploads.",
      })
    }

    return addedIds
  } catch (error) {
    toast("Could not add files to Uploads", {
      description: friendlyError(error),
    })
    return []
  }
}
