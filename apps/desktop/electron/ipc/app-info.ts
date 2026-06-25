import { app, ipcMain } from "electron"
import type { HostAppInfo } from "@assetwell/desktop-bridge"

import { IPC_CHANNELS } from "../shared/channels"

export function registerAppInfoIpc() {
  ipcMain.handle(IPC_CHANNELS.app.getInfo, (): HostAppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
    }
  })
}
