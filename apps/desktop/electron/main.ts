import { app, BrowserWindow } from "electron"
import path from "node:path"

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    title: "Kreeyts",
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

app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
