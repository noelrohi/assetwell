import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron"
import type {
  AssetwellAssignUploadsToBrandRequest,
  AssetwellAssignUploadsToFolderRequest,
  AssetwellCreateBrandRequest,
  AssetwellCreateUploadFolderRequest,
  AssetwellCreateUploadWorkspaceRequest,
  AssetwellDeleteUploadFolderRequest,
  AssetwellDeleteUploadWorkspaceRequest,
  AssetwellExportCreativeZipRequest,
  AssetwellExportVideoRequest,
  AssetwellLibrarySnapshot,
  AssetwellSetActiveBrandRequest,
  AssetwellSetActiveUploadWorkspaceRequest,
  AssetwellUpdateBrandRequest,
  AssetwellUpdateUploadFolderRequest,
  AssetwellUpdateUploadWorkspaceRequest,
} from "@assetwell/desktop-bridge"

import {
  assignUploadsToBrand,
  assignUploadsToFolder,
  chooseAssetwellOutputRoot,
  createBrand,
  createUploadFolder,
  createUploadWorkspace,
  deleteUploadFolder,
  deleteUploadWorkspace,
  exportCreativeZip,
  exportVideo,
  getAssetwellSettings,
  importReferenceAssets,
  loadBrandState,
  loadLibrarySnapshot,
  loadUploadFolderState,
  loadUploadsSnapshot,
  revealAssetwellOutputRoot,
  revealReferenceAssets,
  saveLibrarySnapshot,
  setActiveBrand,
  setActiveUploadWorkspace,
  updateBrand,
  updateUploadFolder,
  updateUploadWorkspace,
} from "../local-store"
import { IPC_CHANNELS } from "../shared/channels"

export function registerLibraryIpc() {
  ipcMain.handle(IPC_CHANNELS.library.loadSnapshot, () => {
    return loadLibrarySnapshot()
  })

  ipcMain.handle(
    IPC_CHANNELS.library.saveSnapshot,
    (_event, snapshot: AssetwellLibrarySnapshot) => {
      return saveLibrarySnapshot(snapshot)
    },
  )

  ipcMain.handle(IPC_CHANNELS.library.getSettings, () => {
    return getAssetwellSettings()
  })

  ipcMain.handle(IPC_CHANNELS.library.chooseOutputRoot, (event) => {
    return chooseAssetwellOutputRoot(ownerWindow(event))
  })

  ipcMain.handle(IPC_CHANNELS.library.revealOutputRoot, () => {
    return revealAssetwellOutputRoot()
  })

  ipcMain.handle(IPC_CHANNELS.library.loadBrandState, () => {
    return loadBrandState()
  })

  ipcMain.handle(
    IPC_CHANNELS.library.setActiveBrand,
    (_event, request: AssetwellSetActiveBrandRequest) => {
      return setActiveBrand(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.createBrand,
    (_event, request: AssetwellCreateBrandRequest) => {
      return createBrand(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.updateBrand,
    (_event, request: AssetwellUpdateBrandRequest) => {
      return updateBrand(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.assignUploadsToBrand,
    (_event, request: AssetwellAssignUploadsToBrandRequest) => {
      return assignUploadsToBrand(request)
    },
  )

  ipcMain.handle(IPC_CHANNELS.library.loadUploadFolderState, () => {
    return loadUploadFolderState()
  })

  ipcMain.handle(
    IPC_CHANNELS.library.createUploadFolder,
    (_event, request: AssetwellCreateUploadFolderRequest) => {
      return createUploadFolder(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.updateUploadFolder,
    (_event, request: AssetwellUpdateUploadFolderRequest) => {
      return updateUploadFolder(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.deleteUploadFolder,
    (_event, request: AssetwellDeleteUploadFolderRequest) => {
      return deleteUploadFolder(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.assignUploadsToFolder,
    (_event, request: AssetwellAssignUploadsToFolderRequest) => {
      return assignUploadsToFolder(request)
    },
  )

  ipcMain.handle(IPC_CHANNELS.library.loadUploadsSnapshot, () => {
    return loadUploadsSnapshot()
  })

  ipcMain.handle(
    IPC_CHANNELS.library.setActiveUploadWorkspace,
    (_event, request: AssetwellSetActiveUploadWorkspaceRequest) => {
      return setActiveUploadWorkspace(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.createUploadWorkspace,
    (_event, request: AssetwellCreateUploadWorkspaceRequest) => {
      return createUploadWorkspace(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.updateUploadWorkspace,
    (_event, request: AssetwellUpdateUploadWorkspaceRequest) => {
      return updateUploadWorkspace(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.deleteUploadWorkspace,
    (_event, request: AssetwellDeleteUploadWorkspaceRequest) => {
      return deleteUploadWorkspace(request)
    },
  )

  ipcMain.handle(IPC_CHANNELS.library.importReferenceAssets, (event) => {
    return importReferenceAssets(ownerWindow(event))
  })

  ipcMain.handle(IPC_CHANNELS.library.revealReferenceAssets, () => {
    return revealReferenceAssets()
  })

  ipcMain.handle(
    IPC_CHANNELS.library.exportCreativeZip,
    (event, request: AssetwellExportCreativeZipRequest) => {
      return exportCreativeZip(request, ownerWindow(event))
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.library.exportVideo,
    (event, request: AssetwellExportVideoRequest) => {
      return exportVideo(request, ownerWindow(event))
    },
  )
}

function ownerWindow(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender)
}
