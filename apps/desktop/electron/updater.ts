import { app } from "electron"
import { autoUpdater } from "electron-updater"

const UPDATE_CHECK_DELAY_MS = 3_000
const DISABLE_AUTO_UPDATES = process.env.ASSETWELL_DISABLE_AUTO_UPDATES === "1"

let hasStarted = false

export function startAutoUpdates() {
  if (hasStarted || !app.isPackaged || DISABLE_AUTO_UPDATES) return

  hasStarted = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on("error", logUpdaterError)

  setTimeout(() => {
    void autoUpdater.checkForUpdatesAndNotify().catch(logUpdaterError)
  }, UPDATE_CHECK_DELAY_MS)
}

function logUpdaterError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`[updater] ${message}`)
}
