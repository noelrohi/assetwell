import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron"
import type {
  AssetwellCreateUploadWorkspaceRequest,
  AssetwellDeleteReferenceAssetRequest,
  AssetwellDeleteUploadWorkspaceRequest,
  AssetwellExportCreativeZipRequest,
  AssetwellExportVideoRequest,
  AssetwellLibrarySnapshot,
  AssetwellSetActiveUploadWorkspaceRequest,
  AssetwellUpdateUploadWorkspaceRequest,
} from "@assetwell/desktop-bridge"

import {
  chooseAssetwellOutputRoot,
  createUploadWorkspace,
  deleteReferenceAsset,
  deleteUploadWorkspace,
  exportCreativeZip,
  exportVideo,
  getAssetwellSettings,
  importReferenceAssets,
  loadLibrarySnapshot,
  loadUploadsSnapshot,
  revealAssetwellOutputRoot,
  revealReferenceAssets,
  saveLibrarySnapshot,
  setActiveUploadWorkspace,
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
    IPC_CHANNELS.library.deleteReferenceAsset,
    (_event, request: AssetwellDeleteReferenceAssetRequest) => {
      return deleteReferenceAsset(request)
    },
  )

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
