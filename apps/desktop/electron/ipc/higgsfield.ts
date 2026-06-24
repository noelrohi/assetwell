import { statSync } from "node:fs"
import path from "node:path"

import {
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from "electron"
import type {
  HiggsfieldAssetSelection,
  HiggsfieldCommandOutputEvent,
  HiggsfieldGenerateRequest,
  HiggsfieldMediaKind,
  HiggsfieldModelListRequest,
  HiggsfieldOpenOutputRequest,
  HiggsfieldUploadAssetRequest,
} from "@kreeyts/desktop-bridge"

import {
  cancelHiggsfieldCommand,
  getHiggsfieldAccountStatus,
  getHiggsfieldCliStatus,
  getHiggsfieldModels,
  getHiggsfieldWorkspaceContext,
  startGenerateCommand,
  startSignInCommand,
  startUploadAssetCommand,
} from "../higgsfield-cli"
import { IPC_CHANNELS } from "../shared/channels"

export function registerHiggsfieldIpc() {
  ipcMain.handle(IPC_CHANNELS.higgsfield.getStatus, () => {
    return getHiggsfieldCliStatus()
  })

  ipcMain.handle(IPC_CHANNELS.higgsfield.signIn, (event) => {
    return startSignInCommand(streamToInvoker(event))
  })

  ipcMain.handle(IPC_CHANNELS.higgsfield.checkCredits, (event) => {
    return getHiggsfieldAccountStatus()
  })

  ipcMain.handle(IPC_CHANNELS.higgsfield.checkWorkspace, (event) => {
    return getHiggsfieldWorkspaceContext()
  })

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.listModels,
    (event, request?: HiggsfieldModelListRequest) => {
      return getHiggsfieldModels(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.chooseAsset,
    (event, mediaKind?: Exclude<HiggsfieldMediaKind, "text">) => {
      return chooseAsset(event, mediaKind)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.uploadAsset,
    (event, request: HiggsfieldUploadAssetRequest) => {
      return startUploadAssetCommand(request, streamToInvoker(event))
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.generate,
    (event, request: HiggsfieldGenerateRequest) => {
      return startGenerateCommand(request, streamToInvoker(event))
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.openOutput,
    (_event, request: HiggsfieldOpenOutputRequest) => {
      return openOutput(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.cancelCommand,
    (_event, runId: string) => {
      return cancelHiggsfieldCommand(runId)
    },
  )
}

async function chooseAsset(
  event: IpcMainInvokeEvent,
  mediaKind: Exclude<HiggsfieldMediaKind, "text"> = "image",
): Promise<HiggsfieldAssetSelection | null> {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options: OpenDialogOptions = {
    title: "Choose an asset for Higgsfield",
    properties: ["openFile"],
    filters: filtersForMediaKind(mediaKind),
  }
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || !result.filePaths[0]) return null

  const filePath = result.filePaths[0]
  const stat = statSync(filePath, { throwIfNoEntry: false })

  return {
    filePath,
    fileName: path.basename(filePath),
    mediaKind,
    sizeBytes: stat?.isFile() ? stat.size : null,
  }
}

async function openOutput(request: HiggsfieldOpenOutputRequest) {
  const target = request.target.trim()
  if (!target) return false

  try {
    const url = new URL(target)
    if (url.protocol === "http:" || url.protocol === "https:") {
      await shell.openExternal(url.toString())
      return true
    }

    return false
  } catch {
    const stat = statSync(target, { throwIfNoEntry: false })
    if (stat?.isFile()) {
      shell.showItemInFolder(target)
      return true
    }

    const error = await shell.openPath(target)
    return error.length === 0
  }
}

function streamToInvoker(event: IpcMainInvokeEvent) {
  return (output: HiggsfieldCommandOutputEvent) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(IPC_CHANNELS.higgsfield.commandOutput, output)
    }
  }
}

function filtersForMediaKind(mediaKind: Exclude<HiggsfieldMediaKind, "text">) {
  if (mediaKind === "video") {
    return [{ name: "Video", extensions: ["mp4", "mov", "webm", "m4v"] }]
  }

  if (mediaKind === "audio") {
    return [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "flac"] }]
  }

  return [
    {
      name: "Image",
      extensions: ["png", "jpg", "jpeg", "webp", "gif", "heic"],
    },
  ]
}
