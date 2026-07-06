import { app, BrowserWindow, dialog, ipcMain } from "electron"
import {
  autoUpdater,
  type ProgressInfo,
  type UpdateDownloadedEvent,
  type UpdateInfo,
} from "electron-updater"
import type {
  AssetwellUpdateDownloadProgress,
  AssetwellUpdateInfo,
} from "@assetwell/desktop-bridge"

import { IPC_CHANNELS } from "./shared/channels"

const UPDATE_CHECK_DELAY_MS = 3_000
const DISABLE_AUTO_UPDATES = process.env.ASSETWELL_DISABLE_AUTO_UPDATES === "1"
const DOWNLOAD_NOTIFICATION = {
  title: "{appName} update ready",
  body: "{appName} version {version} has downloaded and will install when you quit the app.",
}

// Dev-only knob so the progress UI can be exercised without a real signed
// release. Honoured exclusively outside a packaged runtime (see simulationMode).
const SIMULATE_UPDATE = process.env.ASSETWELL_SIMULATE_UPDATE ?? ""
const SIMULATION_STEP_MS = 500
const SIMULATION_ERROR_STOP_PERCENT = 40

let hasConfigured = false
let hasStarted = false
let downloadedUpdate: AssetwellUpdateInfo | null = null
let downloadedUpdateIsSimulated = false
let downloadingVersion: string | null = null
let simulationTimer: ReturnType<typeof setInterval> | null = null

export function registerUpdaterIpc() {
  ipcMain.handle(IPC_CHANNELS.updater.getDownloadedUpdate, () => {
    return downloadedUpdate
  })

  ipcMain.handle(IPC_CHANNELS.updater.installDownloadedUpdate, () => {
    if (!downloadedUpdate) return false

    installDownloadedUpdateNow()
    return true
  })
}

export function startAutoUpdates() {
  if (hasStarted || !canUseAutoUpdater()) return

  hasStarted = true
  configureAutoUpdater()

  setTimeout(() => {
    void autoUpdater
      .checkForUpdatesAndNotify(DOWNLOAD_NOTIFICATION)
      .catch(logUpdaterError)
  }, UPDATE_CHECK_DELAY_MS)
}

export async function checkForUpdatesFromMenu() {
  const owner = BrowserWindow.getFocusedWindow()

  if (downloadedUpdate) {
    const { response } = await showUpdateDialog(
      owner,
      "An update is ready",
      `Assetwell ${downloadedUpdate.version} has downloaded and is ready to install.`,
      ["Restart and Install", "Later"],
    )

    if (response === 0) installDownloadedUpdateNow()
    return
  }

  if (DISABLE_AUTO_UPDATES) {
    await showUpdateDialog(
      owner,
      "Updates are disabled",
      "Automatic updates are disabled for this build by ASSETWELL_DISABLE_AUTO_UPDATES.",
    )
    return
  }

  if (!app.isPackaged || isDevRuntime()) {
    if (simulationMode()) {
      startUpdateSimulation()
      await showUpdateDialog(
        owner,
        "Update available",
        `Assetwell ${downloadingVersion} is downloading in the background. You can keep working — we'll let you know when it's ready to install.`,
      )
      return
    }

    await showUpdateDialog(
      owner,
      "Updates are available in packaged builds",
      "Run a signed production build of Assetwell to check for updates from GitHub Releases.",
    )
    return
  }

  configureAutoUpdater()

  try {
    const result = await autoUpdater.checkForUpdatesAndNotify(
      DOWNLOAD_NOTIFICATION,
    )

    if (result && !result.isUpdateAvailable) {
      await showUpdateDialog(
        owner,
        "Assetwell is up to date",
        `You're running Assetwell ${app.getVersion()}.`,
      )
    } else if (result?.isUpdateAvailable) {
      await showUpdateDialog(
        owner,
        "Update available",
        `Assetwell ${result.updateInfo.version} is downloading in the background. You can keep working — we'll let you know when it's ready to install.`,
      )
    }
  } catch (error) {
    logUpdaterError(error)
    await showUpdateDialog(
      owner,
      "Couldn't check for updates",
      "Please try again later.",
    )
  }
}

function canUseAutoUpdater() {
  return app.isPackaged && !isDevRuntime() && !DISABLE_AUTO_UPDATES
}

function isDevRuntime() {
  return Boolean(process.env.VITE_DEV_SERVER_URL)
}

function configureAutoUpdater() {
  if (hasConfigured) return

  hasConfigured = true
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on("error", handleUpdaterError)
  autoUpdater.on("update-available", handleUpdateAvailable)
  autoUpdater.on("download-progress", handleDownloadProgress)
  autoUpdater.on("update-downloaded", handleUpdateDownloaded)
}

function handleUpdateAvailable(info: UpdateInfo) {
  downloadingVersion = info.version
}

function handleDownloadProgress(progress: ProgressInfo) {
  broadcastDownloadProgress({
    percent: progress.percent,
    version: downloadingVersion,
  })
}

function handleUpdaterError(error: unknown) {
  logUpdaterError(error)

  // A mid-download failure (e.g. a dropped connection) leaves the renderer
  // showing progress forever; clear it so the indicator disappears.
  downloadingVersion = null
  broadcastDownloadProgress(null)
}

function broadcastDownloadProgress(
  payload: AssetwellUpdateDownloadProgress | null,
) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.updater.downloadProgress, payload)
  }
}

function handleUpdateDownloaded(event: UpdateDownloadedEvent) {
  downloadedUpdate = updateDownloadedEventToBridgeInfo(event)
  downloadedUpdateIsSimulated = false
  downloadingVersion = null
  broadcastDownloadedUpdate()
}

function broadcastDownloadedUpdate() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(
      IPC_CHANNELS.updater.downloadedUpdate,
      downloadedUpdate,
    )
  }
}

function updateDownloadedEventToBridgeInfo(
  event: UpdateDownloadedEvent,
): AssetwellUpdateInfo {
  return {
    version: event.version,
    currentVersion: app.getVersion(),
    releaseDate: event.releaseDate,
    releaseNotes: event.releaseNotes?.toString(),
  }
}

function installDownloadedUpdateNow() {
  if (downloadedUpdateIsSimulated) {
    // No real installer exists in dev; relaunch is the closest honest analog.
    app.relaunch()
    app.quit()
    return
  }

  autoUpdater.quitAndInstall()
}

// Returns the active dev simulation mode, or null when simulation is off. The
// hard guard here is the only thing that keeps the flag from ever touching a
// real packaged runtime.
function simulationMode(): "ready" | "error" | null {
  if (app.isPackaged && !isDevRuntime()) return null
  if (SIMULATE_UPDATE === "1" || SIMULATE_UPDATE === "ready") return "ready"
  if (SIMULATE_UPDATE === "error") return "error"
  return null
}

function startUpdateSimulation() {
  const mode = simulationMode()
  if (!mode) return
  // Don't stack simulations or re-run once one has already "downloaded".
  if (simulationTimer || downloadedUpdate) return

  const version = bumpPatch(app.getVersion())
  downloadingVersion = version

  let percent = 0
  broadcastDownloadProgress({ percent, version })

  simulationTimer = setInterval(() => {
    percent += 10

    if (mode === "error" && percent >= SIMULATION_ERROR_STOP_PERCENT) {
      stopSimulationTimer()
      downloadingVersion = null
      broadcastDownloadProgress(null)
      return
    }

    if (percent >= 100) {
      stopSimulationTimer()
      broadcastDownloadProgress({ percent: 100, version })
      completeSimulatedDownload(version)
      return
    }

    broadcastDownloadProgress({ percent, version })
  }, SIMULATION_STEP_MS)
}

function completeSimulatedDownload(version: string) {
  downloadedUpdate = {
    version,
    currentVersion: app.getVersion(),
    releaseDate: new Date().toISOString(),
    releaseNotes: "Simulated update (ASSETWELL_SIMULATE_UPDATE) — dev only.",
  }
  downloadedUpdateIsSimulated = true
  downloadingVersion = null
  broadcastDownloadedUpdate()
}

function stopSimulationTimer() {
  if (!simulationTimer) return

  clearInterval(simulationTimer)
  simulationTimer = null
}

function bumpPatch(version: string): string {
  const [major = "0", minor = "0", patch = "0"] = version.split(".")
  const nextPatch = Number.parseInt(patch, 10)
  return `${major}.${minor}.${Number.isFinite(nextPatch) ? nextPatch + 1 : 1}`
}

async function showUpdateDialog(
  owner: BrowserWindow | null,
  message: string,
  detail: string,
  buttons = ["OK"],
) {
  const options = {
    type: "info" as const,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
    title: "Assetwell",
    message,
    detail,
  }

  if (owner) {
    return dialog.showMessageBox(owner, options)
  }

  return dialog.showMessageBox(options)
}

function logUpdaterError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`[updater] ${message}`)
}
