import { app, ipcMain } from "electron"
import type {
  AssetwellReleaseNotes,
  HostAppInfo,
} from "@assetwell/desktop-bridge"

import { IPC_CHANNELS } from "../shared/channels"

const GITHUB_RELEASES_BASE =
  "https://api.github.com/repos/noelrohi/assetwell/releases/tags"

export function registerAppInfoIpc() {
  ipcMain.handle(IPC_CHANNELS.app.getInfo, (): HostAppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.app.getCurrentReleaseNotes,
    async (): Promise<AssetwellReleaseNotes | null> => {
      const version = app.getVersion()

      try {
        const response = await fetch(
          `${GITHUB_RELEASES_BASE}/v${encodeURIComponent(version)}`,
          {
            headers: {
              "User-Agent": "Assetwell",
              Accept: "application/vnd.github+json",
            },
            signal: AbortSignal.timeout(5000),
          },
        )
        if (!response.ok) return null

        const data = (await response.json()) as {
          name?: string | null
          body?: string | null
        }
        const body = (data.body ?? "").trim()
        if (!body) return null

        return { version, title: data.name ?? "", body }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[whats-new] ${message}`)
        return null
      }
    },
  )
}
