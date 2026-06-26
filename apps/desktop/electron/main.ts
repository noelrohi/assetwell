import { app, BrowserWindow, nativeImage, protocol } from "electron"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"
import path from "node:path"

import { registerAppInfoIpc } from "./ipc/app-info"
import { registerHiggsfieldIpc } from "./ipc/higgsfield"
import { registerLibraryIpc } from "./ipc/library"
import {
  isPreviewableLocalAsset,
  LOCAL_ASSET_PROTOCOL,
  localAssetContentType,
  parseByteRange,
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

    let fileSize: number
    try {
      const stats = await stat(filePath)
      if (!stats.isFile()) return new Response(null, { status: 404 })
      fileSize = stats.size
    } catch {
      return new Response(null, { status: 404 })
    }

    const contentType = localAssetContentType(filePath)
    // Video playback streams via Range requests; honor them so <video> can
    // start and seek. Images request the whole file and fall through to 200.
    const rangeHeader = request.headers.get("range")
    const range = rangeHeader ? parseByteRange(rangeHeader, fileSize) : null

    if (rangeHeader && !range) {
      return new Response(null, {
        status: 416,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${fileSize}`,
        },
      })
    }

    const start = range ? range.start : 0
    const end = range ? range.end : Math.max(fileSize - 1, 0)
    const stream = createReadStream(filePath, { start, end })
    const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>

    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": String(fileSize === 0 ? 0 : end - start + 1),
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${fileSize}` }
          : {}),
      },
    })
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
