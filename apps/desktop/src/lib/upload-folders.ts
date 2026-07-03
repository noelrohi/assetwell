import * as React from "react"
import { toast } from "sonner"
import type {
  AssetwellUploadFolder,
  AssetwellUploadFolderAssignment,
  AssetwellUploadFolderState,
} from "@assetwell/desktop-bridge"

import { friendlyError } from "./higgsfield/text"
import type {
  LibraryBridge,
  ReferenceAsset,
  UploadFoldersDomain,
} from "./higgsfield/types"

const emptyUploadFolderState: AssetwellUploadFolderState = {
  folders: [],
  assignments: [],
}

export function applyUploadFolderAssignments(
  references: ReferenceAsset[],
  assignments: AssetwellUploadFolderAssignment[],
  folderIds: ReadonlySet<string>,
): ReferenceAsset[] {
  const assignmentMap = new Map(
    assignments.map((assignment) => [assignment.uploadId, assignment.folderId]),
  )

  return references.map((reference) => {
    const assignedFolderId = assignmentMap.get(
      reference.uploadId ?? reference.id,
    )
    const folderId =
      assignedFolderId && folderIds.has(assignedFolderId)
        ? assignedFolderId
        : null

    return { ...reference, folderId }
  })
}

export function referencesInFolder(
  references: ReferenceAsset[],
  folderId: string | null,
): ReferenceAsset[] {
  if (!folderId) {
    return references.filter((reference) => !reference.folderId)
  }

  return references.filter((reference) => reference.folderId === folderId)
}

export function countReferencesByFolder(
  references: ReferenceAsset[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()

  for (const reference of references) {
    if (!reference.folderId) continue
    counts.set(reference.folderId, (counts.get(reference.folderId) ?? 0) + 1)
  }

  return counts
}

export function useUploadFolders(
  libraryBridge?: LibraryBridge,
): UploadFoldersDomain {
  const [state, setState] = React.useState<AssetwellUploadFolderState>(
    emptyUploadFolderState,
  )
  const stateRef = React.useRef(state)

  const applyUploadFolderState = React.useCallback(
    (nextState: AssetwellUploadFolderState) => {
      stateRef.current = {
        folders: nextState.folders,
        assignments: nextState.assignments,
      }
      setState(stateRef.current)
    },
    [],
  )

  React.useEffect(() => {
    if (!libraryBridge) return
    const bridge = libraryBridge

    let cancelled = false

    async function loadUploadFolders() {
      try {
        const nextState = await bridge.loadUploadFolderState()
        if (!cancelled) applyUploadFolderState(nextState)
      } catch (error) {
        if (!cancelled) {
          toast("Could not load folders", {
            description: friendlyError(error),
          })
        }
      }
    }

    void loadUploadFolders()

    return () => {
      cancelled = true
    }
  }, [applyUploadFolderState, libraryBridge])

  const createFolder = React.useCallback(
    async (name: string) => {
      if (!libraryBridge) {
        try {
          const folderName = requireFolderName(name)
          assertUniqueFolderName(stateRef.current.folders, folderName)
          const folder = {
            id: dedupeFolderId(
              folderIdFromName(folderName),
              stateRef.current.folders,
            ),
            name: folderName,
          }
          applyUploadFolderState({
            ...stateRef.current,
            folders: [...stateRef.current.folders, folder],
          })
          toast(`Created ${folder.name}`)
          return folder.id
        } catch (error) {
          toast("Could not create folder", {
            description: friendlyError(error),
          })
          return null
        }
      }

      try {
        const beforeIds = new Set(
          stateRef.current.folders.map((folder) => folder.id),
        )
        const nextState = await libraryBridge.createUploadFolder({ name })
        applyUploadFolderState(nextState)
        const createdFolder =
          nextState.folders.find((folder) => !beforeIds.has(folder.id)) ??
          nextState.folders.find(
            (folder) => folderNameKey(folder.name) === folderNameKey(name),
          )

        toast(`Created ${createdFolder?.name ?? name}`)
        return createdFolder?.id ?? null
      } catch (error) {
        toast("Could not create folder", {
          description: friendlyError(error),
        })
        return null
      }
    },
    [applyUploadFolderState, libraryBridge],
  )

  const renameFolder = React.useCallback(
    async (id: string, name: string) => {
      if (!libraryBridge) {
        try {
          const folder = requireFolder(stateRef.current.folders, id)
          const folderName = requireFolderName(name)
          assertUniqueFolderName(
            stateRef.current.folders,
            folderName,
            folder.id,
          )
          applyUploadFolderState({
            ...stateRef.current,
            folders: stateRef.current.folders.map((current) =>
              current.id === folder.id
                ? { ...current, name: folderName }
                : current,
            ),
          })
          toast("Folder renamed")
          return true
        } catch (error) {
          toast("Could not rename folder", {
            description: friendlyError(error),
          })
          return false
        }
      }

      try {
        applyUploadFolderState(
          await libraryBridge.updateUploadFolder({ id, name }),
        )
        toast("Folder renamed")
        return true
      } catch (error) {
        toast("Could not rename folder", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadFolderState, libraryBridge],
  )

  const deleteFolder = React.useCallback(
    async (id: string) => {
      const folderName =
        findFolder(stateRef.current.folders, id)?.name ?? "folder"

      if (!libraryBridge) {
        try {
          requireFolder(stateRef.current.folders, id)
          applyUploadFolderState({
            folders: stateRef.current.folders.filter(
              (folder) => folder.id !== id,
            ),
            assignments: stateRef.current.assignments.filter(
              (assignment) => assignment.folderId !== id,
            ),
          })
          toast(`Deleted ${folderName}`, {
            description: "Its uploads moved out of folders.",
          })
          return true
        } catch (error) {
          toast("Could not delete folder", {
            description: friendlyError(error),
          })
          return false
        }
      }

      try {
        applyUploadFolderState(await libraryBridge.deleteUploadFolder({ id }))
        toast(`Deleted ${folderName}`, {
          description: "Its uploads moved out of folders.",
        })
        return true
      } catch (error) {
        toast("Could not delete folder", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadFolderState, libraryBridge],
  )

  const assignUploads = React.useCallback(
    async (uploadIds: string[], folderId: string | null, announce = true) => {
      const uniqueIds = uniqueUploadIds(uploadIds)
      if (uniqueIds.length === 0) return true

      const folderName = folderId
        ? (findFolder(stateRef.current.folders, folderId)?.name ?? "folder")
        : null

      if (!libraryBridge) {
        try {
          if (folderId) requireFolder(stateRef.current.folders, folderId)
          const assignments = new Map(
            stateRef.current.assignments.flatMap((assignment) =>
              assignment.folderId
                ? [[assignment.uploadId, assignment.folderId] as const]
                : [],
            ),
          )
          for (const uploadId of uniqueIds) {
            if (folderId) {
              assignments.set(uploadId, folderId)
            } else {
              assignments.delete(uploadId)
            }
          }
          applyUploadFolderState({
            ...stateRef.current,
            assignments: Array.from(
              assignments,
              ([uploadId, assignedFolderId]) => ({
                uploadId,
                folderId: assignedFolderId,
              }),
            ),
          })
          if (announce) toastMove(uniqueIds.length, folderName)
          return true
        } catch (error) {
          toast("Could not move uploads", {
            description: friendlyError(error),
          })
          return false
        }
      }

      try {
        applyUploadFolderState(
          await libraryBridge.assignUploadsToFolder({
            uploadIds: uniqueIds,
            folderId,
          }),
        )
        if (announce) toastMove(uniqueIds.length, folderName)
        return true
      } catch (error) {
        toast("Could not move uploads", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadFolderState, libraryBridge],
  )

  return React.useMemo(
    () => ({
      folders: state.folders,
      assignments: state.assignments,
      createFolder,
      renameFolder,
      deleteFolder,
      assignUploads,
    }),
    [assignUploads, createFolder, deleteFolder, renameFolder, state],
  )
}

function toastMove(count: number, folderName: string | null) {
  const uploadsLabel = `upload${count === 1 ? "" : "s"}`

  if (folderName) {
    toast(`Moved ${count} ${uploadsLabel} to ${folderName}`)
    return
  }

  toast(`Moved ${count} ${uploadsLabel} out of folders`)
}

function requireFolder(folders: AssetwellUploadFolder[], value: unknown) {
  const folderId = normalizeFolderId(value)
  const folder = folderId ? findFolder(folders, folderId) : null

  if (!folder) {
    throw new Error("Unknown folder.")
  }

  return folder
}

function requireFolderName(value: unknown) {
  const name = normalizeFolderName(value)

  if (!name) {
    throw new Error("Folder name is required.")
  }

  return name
}

function assertUniqueFolderName(
  folders: AssetwellUploadFolder[],
  name: string,
  exceptFolderId?: string,
) {
  const nameKey = folderNameKey(name)
  const duplicate = folders.find(
    (folder) =>
      folder.id !== exceptFolderId && folderNameKey(folder.name) === nameKey,
  )

  if (duplicate) {
    throw new Error("A folder with that name already exists.")
  }
}

function folderNameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

function normalizeFolderName(value: unknown) {
  if (typeof value !== "string") return null

  const name = value
    .trim()
    .replace(/[\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim()

  return name || null
}

function normalizeFolderId(value: unknown) {
  if (typeof value !== "string") return null

  const folderId = value.trim()
  return isSafeFolderId(folderId) ? folderId : null
}

function folderIdFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)

  const folderId = slug.startsWith("folder-") ? slug : `folder-${slug}`
  return (
    normalizeFolderId(folderId || `folder-${Date.now()}`) ??
    `folder-${Date.now()}`
  )
}

function isSafeFolderId(value: string) {
  return (
    value.length > 0 &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/[<>:"|?*\u0000-\u001f]/.test(value) &&
    !/[. ]$/.test(value)
  )
}

function dedupeFolderId(
  requestedFolderId: string,
  folders: AssetwellUploadFolder[],
) {
  let index = 1
  let candidate = requestedFolderId

  while (findFolder(folders, candidate)) {
    index += 1
    candidate = `${requestedFolderId}-${index}`
  }

  return candidate
}

function findFolder(folders: AssetwellUploadFolder[], folderId: string) {
  return folders.find(
    (folder) => folder.id.toLowerCase() === folderId.toLowerCase(),
  )
}

function uniqueUploadIds(value: unknown) {
  if (!Array.isArray(value)) return []

  const uploadIds = new Set<string>()
  for (const item of value) {
    const uploadId = normalizeUploadId(item)
    if (uploadId) uploadIds.add(uploadId)
  }

  return Array.from(uploadIds)
}

function normalizeUploadId(value: unknown) {
  if (typeof value !== "string") return null

  const uploadId = value.trim().slice(0, 200)
  return uploadId || null
}
