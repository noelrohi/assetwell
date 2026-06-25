import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron"
import type {
  AssetwellDeleteReferenceAssetRequest,
  AssetwellExportCreativeZipRequest,
  AssetwellLibrarySnapshot,
} from "@assetwell/desktop-bridge"

import {
  chooseAssetwellOutputRoot,
  deleteReferenceAsset,
  exportCreativeZip,
  getAssetwellSettings,
  importReferenceAssets,
  listReferenceAssets,
  loadLibrarySnapshot,
  revealAssetwellOutputRoot,
  revealReferenceAssets,
  saveLibrarySnapshot,
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

  ipcMain.handle(IPC_CHANNELS.library.listReferenceAssets, () => {
    return listReferenceAssets()
  })

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
}

function ownerWindow(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender)
}
