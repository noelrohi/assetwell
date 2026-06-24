import { contextBridge } from "electron"
import type { DesktopBridge } from "@kreeyts/desktop-bridge"

const bridge: DesktopBridge = {
  platform: process.platform,
}

contextBridge.exposeInMainWorld("kreeyts", bridge)
