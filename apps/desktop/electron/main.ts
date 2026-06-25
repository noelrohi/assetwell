import { app, BrowserWindow, nativeImage, protocol } from "electron"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { registerAppInfoIpc } from "./ipc/app-info"
import { registerHiggsfieldIpc } from "./ipc/higgsfield"
import { registerLibraryIpc } from "./ipc/library"
import {
  isPreviewableLocalAsset,
  LOCAL_ASSET_PROTOCOL,
  localAssetContentType,
  resolveLocalAssetUrl,
} from "./local-store"
import { startAutoUpdates } from "./updater"

const APP_NAME = "Assetwell"
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const appIconPath = path.join(__dirname, "../build/icon.png")

protocol.registerSchemesAsPrivileged([
  {
    scheme: LOCAL_ASSET_PROTOCOL,
    privileges: { bypassCSP: false, secure: true, standard: true },
  },
])

app.setName(APP_NAME)
process.title = APP_NAME

function setDockIcon() {
  if (!isDev || process.platform !== "darwin" || !app.dock) return

  const dockIcon = nativeImage.createFromPath(appIconPath)
  if (!dockIcon.isEmpty()) {
    app.dock.setIcon(dockIcon)
  }
}

function registerLocalAssetProtocol() {
  protocol.handle(LOCAL_ASSET_PROTOCOL, async (request) => {
    const filePath = resolveLocalAssetUrl(request.url)
    if (!filePath || !isPreviewableLocalAsset(filePath)) {
      return new Response(null, { status: 404 })
    }

    try {
      const bytes = await readFile(filePath)
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": localAssetContentType(filePath),
        },
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: "#191816",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!)
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
  }
}

app.whenReady().then(() => {
  setDockIcon()
  registerLocalAssetProtocol()
  registerAppInfoIpc()
  registerHiggsfieldIpc()
  registerLibraryIpc()
  createWindow()
  startAutoUpdates()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
