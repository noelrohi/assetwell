import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron"
import type {
  KreeytsExportCreativeZipRequest,
  KreeytsLibrarySnapshot,
} from "@kreeyts/desktop-bridge"

import {
  chooseKreeytsOutputRoot,
  exportCreativeZip,
  getKreeytsSettings,
  loadLibrarySnapshot,
  revealKreeytsOutputRoot,
  saveLibrarySnapshot,
} from "../local-store"
import { IPC_CHANNELS } from "../shared/channels"

export function registerLibraryIpc() {
  ipcMain.handle(IPC_CHANNELS.library.loadSnapshot, () => {
    return loadLibrarySnapshot()
  })

  ipcMain.handle(
    IPC_CHANNELS.library.saveSnapshot,
    (_event, snapshot: KreeytsLibrarySnapshot) => {
      return saveLibrarySnapshot(snapshot)
    },
  )

  ipcMain.handle(IPC_CHANNELS.library.getSettings, () => {
    return getKreeytsSettings()
  })

  ipcMain.handle(IPC_CHANNELS.library.chooseOutputRoot, (event) => {
    return chooseKreeytsOutputRoot(ownerWindow(event))
  })

  ipcMain.handle(IPC_CHANNELS.library.revealOutputRoot, () => {
    return revealKreeytsOutputRoot()
  })

  ipcMain.handle(
    IPC_CHANNELS.library.exportCreativeZip,
    (event, request: KreeytsExportCreativeZipRequest) => {
      return exportCreativeZip(request, ownerWindow(event))
    },
  )
}

function ownerWindow(event: IpcMainInvokeEvent) {
  return BrowserWindow.fromWebContents(event.sender)
}
