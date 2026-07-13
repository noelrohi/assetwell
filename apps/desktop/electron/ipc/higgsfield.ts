import { statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from "electron"
import type {
  HiggsfieldAssetSelection,
  HiggsfieldCommandOutputEvent,
  HiggsfieldGenerateRequest,
  HiggsfieldModelDetailsRequest,
  HiggsfieldModelListRequest,
  HiggsfieldOpenOutputRequest,
  HiggsfieldSetWorkspaceRequest,
  HiggsfieldUploadAssetRequest,
  HiggsfieldUploadListRequest,
  HiggsfieldUploadMediaKind,
} from "@assetwell/desktop-bridge"

import {
  cancelHiggsfieldCommand,
  createHiggsfieldUpload,
  getHiggsfieldAccountStatus,
  getHiggsfieldCliStatus,
  getHiggsfieldModelDetails,
  getHiggsfieldModels,
  getHiggsfieldUploads,
  getHiggsfieldWorkspaceContext,
  setHiggsfieldWorkspace,
  startGenerateCommand,
  startSignInCommand,
  startSignOutCommand,
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

  ipcMain.handle(IPC_CHANNELS.higgsfield.signOut, (event) => {
    return startSignOutCommand(streamToInvoker(event))
  })

  ipcMain.handle(IPC_CHANNELS.higgsfield.checkCredits, (event) => {
    return getHiggsfieldAccountStatus()
  })

  ipcMain.handle(IPC_CHANNELS.higgsfield.checkWorkspace, (event) => {
    return getHiggsfieldWorkspaceContext()
  })

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.setWorkspace,
    (_event, request: HiggsfieldSetWorkspaceRequest) => {
      return setHiggsfieldWorkspace(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.listModels,
    (_event, request?: HiggsfieldModelListRequest) => {
      return getHiggsfieldModels(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.getModelDetails,
    (_event, request: HiggsfieldModelDetailsRequest) => {
      return getHiggsfieldModelDetails(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.listUploads,
    (_event, request?: HiggsfieldUploadListRequest) => {
      return getHiggsfieldUploads(request)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.chooseAsset,
    (event, mediaKind?: HiggsfieldUploadMediaKind) => {
      return chooseAsset(event, mediaKind)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.chooseAssets,
    (event, mediaKind?: HiggsfieldUploadMediaKind) => {
      return chooseAssets(event, mediaKind)
    },
  )

  ipcMain.handle(
    IPC_CHANNELS.higgsfield.createUpload,
    (_event, request: HiggsfieldUploadAssetRequest) => {
      return createHiggsfieldUpload(request)
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
  mediaKind: HiggsfieldUploadMediaKind = "image",
): Promise<HiggsfieldAssetSelection | null> {
  return (await chooseAssetFiles(event, mediaKind, false))[0] ?? null
}

async function chooseAssets(
  event: IpcMainInvokeEvent,
  mediaKind: HiggsfieldUploadMediaKind = "image",
): Promise<HiggsfieldAssetSelection[]> {
  return chooseAssetFiles(event, mediaKind, true)
}

async function chooseAssetFiles(
  event: IpcMainInvokeEvent,
  mediaKind: HiggsfieldUploadMediaKind,
  multiSelections: boolean,
): Promise<HiggsfieldAssetSelection[]> {
  const owner = BrowserWindow.fromWebContents(event.sender)
  const options: OpenDialogOptions = {
    title: multiSelections
      ? "Choose assets for Higgsfield"
      : "Choose an asset for Higgsfield",
    properties: multiSelections
      ? ["openFile", "multiSelections"]
      : ["openFile"],
    filters: filtersForMediaKind(mediaKind),
  }
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled) return []

  return result.filePaths.map((filePath) => {
    const stat = statSync(filePath, { throwIfNoEntry: false })
    const dimensions =
      mediaKind === "image" ? localImageDimensions(filePath) : undefined

    return {
      filePath,
      fileName: path.basename(filePath),
      mediaKind,
      sizeBytes: stat?.isFile() ? stat.size : null,
      ...dimensions,
    }
  })
}

function localImageDimensions(filePath: string) {
  const image = nativeImage.createFromPath(filePath)
  if (image.isEmpty()) return undefined

  const { width, height } = image.getSize()
  return width > 0 && height > 0 ? { width, height } : undefined
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

    if (url.protocol === "file:") {
      return openLocalPath(fileURLToPath(url))
    }

    return false
  } catch {
    return openLocalPath(target)
  }
}

async function openLocalPath(target: string) {
  const stat = statSync(target, { throwIfNoEntry: false })
  if (stat?.isFile()) {
    shell.showItemInFolder(target)
    return true
  }

  const error = await shell.openPath(target)
  return error.length === 0
}

function streamToInvoker(event: IpcMainInvokeEvent) {
  return (output: HiggsfieldCommandOutputEvent) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send(IPC_CHANNELS.higgsfield.commandOutput, output)
    }
  }
}

function filtersForMediaKind(mediaKind: HiggsfieldUploadMediaKind) {
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
