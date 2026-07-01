import * as React from "react"
import { toast } from "sonner"
import type {
  AssetwellUploadWorkspace,
  AssetwellUploadsSnapshot,
} from "@assetwell/desktop-bridge"

import { seededReferences } from "./higgsfield/constants"
import { normalizeReferenceUrl } from "./higgsfield/local-state"
import { friendlyError } from "./higgsfield/text"
import type {
  LibraryBridge,
  ReferenceAsset,
  UploadsDomain,
} from "./higgsfield/types"

export const DEFAULT_UPLOAD_WORKSPACE_ID = "Default"

const defaultUploadWorkspace: AssetwellUploadWorkspace = {
  id: DEFAULT_UPLOAD_WORKSPACE_ID,
  name: DEFAULT_UPLOAD_WORKSPACE_ID,
  isDefault: true,
}

export function isInUploadWorkspace(
  item: { uploadWorkspaceId?: string },
  uploadWorkspaceId: string,
) {
  return (
    (item.uploadWorkspaceId || DEFAULT_UPLOAD_WORKSPACE_ID) ===
    uploadWorkspaceId
  )
}

export function useUploadsLibrary(libraryBridge?: LibraryBridge) {
  const [references, setReferences] = React.useState<ReferenceAsset[]>(
    libraryBridge ? [] : seededReferences,
  )
  const [workspaces, setWorkspaces] = React.useState<
    AssetwellUploadWorkspace[]
  >([defaultUploadWorkspace])
  const [activeWorkspaceId, setActiveWorkspaceId] = React.useState(
    defaultUploadWorkspace.id,
  )

  const applyUploadsSnapshot = React.useCallback(
    (snapshot: AssetwellUploadsSnapshot) => {
      const nextWorkspaces = snapshot.workspaceState.workspaces.length
        ? snapshot.workspaceState.workspaces
        : [defaultUploadWorkspace]

      setWorkspaces(nextWorkspaces)
      setActiveWorkspaceId(
        snapshot.workspaceState.activeWorkspaceId || defaultUploadWorkspace.id,
      )
      setReferences(
        (snapshot.references as ReferenceAsset[]).map(normalizeReferenceUrl),
      )
    },
    [],
  )

  const restorePersistedReferences = React.useCallback(
    (persistedReferences: ReferenceAsset[]) => {
      setReferences(
        persistedReferences.length
          ? persistedReferences.map(normalizeReferenceUrl)
          : libraryBridge
            ? []
            : seededReferences,
      )
    },
    [libraryBridge],
  )

  const refresh = React.useCallback(async () => {
    if (!libraryBridge) return

    try {
      applyUploadsSnapshot(await libraryBridge.loadUploadsSnapshot())
    } catch (error) {
      toast("Could not refresh Uploads", {
        description: friendlyError(error),
      })
    }
  }, [applyUploadsSnapshot, libraryBridge])

  const importFiles = React.useCallback(async () => {
    if (!libraryBridge) {
      toast("Open the desktop app to add Uploads files")
      return
    }

    try {
      const before = references.length
      const snapshot = await libraryBridge.importReferenceAssets()
      applyUploadsSnapshot(snapshot)
      const added = Math.max(0, snapshot.references.length - before)
      if (added > 0) {
        toast(`Added ${added} Uploads file${added === 1 ? "" : "s"}`)
      }
    } catch (error) {
      toast("Could not add files to Uploads", {
        description: friendlyError(error),
      })
    }
  }, [applyUploadsSnapshot, libraryBridge, references.length])

  const reveal = React.useCallback(async () => {
    if (!libraryBridge) return
    const opened = await libraryBridge.revealReferenceAssets()
    if (!opened) toast("Could not open Uploads folder")
  }, [libraryBridge])

  const deleteReference = React.useCallback(
    async (id: string) => {
      if (!libraryBridge) return

      try {
        applyUploadsSnapshot(await libraryBridge.deleteReferenceAsset({ id }))
        toast("Removed Uploads file")
      } catch (error) {
        toast("Could not remove Uploads file", {
          description: friendlyError(error),
        })
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const switchWorkspace = React.useCallback(
    async (id: string) => {
      if (!libraryBridge) return false

      try {
        applyUploadsSnapshot(
          await libraryBridge.setActiveUploadWorkspace({
            id,
          }),
        )
        return true
      } catch (error) {
        toast("Could not switch Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const createWorkspace = React.useCallback(
    async (name: string) => {
      if (!libraryBridge) {
        toast("Open the desktop app to create Uploads workspaces")
        return false
      }

      try {
        const snapshot = await libraryBridge.createUploadWorkspace({ name })
        applyUploadsSnapshot(snapshot)
        const activeWorkspace = snapshot.workspaceState.workspaces.find(
          (workspace) =>
            workspace.id === snapshot.workspaceState.activeWorkspaceId,
        )
        toast(`Switched to ${activeWorkspace?.name ?? name}`)
        return true
      } catch (error) {
        toast("Could not create Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const updateWorkspace = React.useCallback(
    async (id: string, name: string) => {
      if (!libraryBridge) {
        toast("Open the desktop app to rename Uploads workspaces")
        return false
      }

      try {
        const snapshot = await libraryBridge.updateUploadWorkspace({ id, name })
        applyUploadsSnapshot(snapshot)
        toast("Workspace renamed")
        return true
      } catch (error) {
        toast("Could not rename Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const deleteWorkspace = React.useCallback(
    async (id: string) => {
      if (!libraryBridge) {
        toast("Open the desktop app to delete Uploads workspaces")
        return false
      }

      const workspaceName =
        workspaces.find((workspace) => workspace.id === id)?.name ?? "workspace"

      try {
        applyUploadsSnapshot(await libraryBridge.deleteUploadWorkspace({ id }))
        toast(`Deleted ${workspaceName}`)
        return true
      } catch (error) {
        toast("Could not delete Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge, workspaces],
  )

  const activeWorkspace = React.useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      workspaces[0] ??
      defaultUploadWorkspace,
    [activeWorkspaceId, workspaces],
  )

  const uploads = React.useMemo<UploadsDomain>(
    () => ({
      workspaces,
      activeWorkspace,
      activeWorkspaceId,
      references,
      refresh,
      reveal,
      importFiles,
      deleteReference,
      switchWorkspace,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
    }),
    [
      activeWorkspace,
      activeWorkspaceId,
      createWorkspace,
      deleteReference,
      deleteWorkspace,
      importFiles,
      references,
      refresh,
      reveal,
      switchWorkspace,
      updateWorkspace,
      workspaces,
    ],
  )

  return {
    uploads,
    applyUploadsSnapshot,
    restorePersistedReferences,
  }
}
