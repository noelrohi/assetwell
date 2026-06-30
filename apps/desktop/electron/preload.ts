import { contextBridge, ipcRenderer } from "electron"
import type {
  AssetwellUpdateInfo,
  DesktopBridge,
  HiggsfieldCommandOutputEvent,
} from "@assetwell/desktop-bridge"

import { IPC_CHANNELS } from "./shared/channels"

const bridge: DesktopBridge = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getInfo),
    getCurrentReleaseNotes: () =>
      ipcRenderer.invoke(IPC_CHANNELS.app.getCurrentReleaseNotes),
  },
  higgsfield: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.higgsfield.getStatus),
    signIn: () => ipcRenderer.invoke(IPC_CHANNELS.higgsfield.signIn),
    checkCredits: () =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.checkCredits),
    checkWorkspace: () =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.checkWorkspace),
    listModels: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.listModels, request),
    getModelDetails: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.getModelDetails, request),
    chooseAsset: (mediaKind) =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.chooseAsset, mediaKind),
    uploadAsset: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.uploadAsset, request),
    generate: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.generate, request),
    openOutput: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.openOutput, request),
    cancelCommand: (runId) =>
      ipcRenderer.invoke(IPC_CHANNELS.higgsfield.cancelCommand, runId),
    onCommandOutput: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        output: HiggsfieldCommandOutputEvent,
      ) => {
        listener(output)
      }

      ipcRenderer.on(IPC_CHANNELS.higgsfield.commandOutput, handler)

      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.higgsfield.commandOutput,
          handler,
        )
      }
    },
  },
  library: {
    loadSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.library.loadSnapshot),
    saveSnapshot: (snapshot) =>
      ipcRenderer.invoke(IPC_CHANNELS.library.saveSnapshot, snapshot),
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.library.getSettings),
    chooseOutputRoot: () =>
      ipcRenderer.invoke(IPC_CHANNELS.library.chooseOutputRoot),
    revealOutputRoot: () =>
      ipcRenderer.invoke(IPC_CHANNELS.library.revealOutputRoot),
    loadUploadsSnapshot: () =>
      ipcRenderer.invoke(IPC_CHANNELS.library.loadUploadsSnapshot),
    setActiveUploadWorkspace: (request) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.library.setActiveUploadWorkspace,
        request,
      ),
    createUploadWorkspace: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.library.createUploadWorkspace, request),
    updateUploadWorkspace: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.library.updateUploadWorkspace, request),
    deleteUploadWorkspace: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.library.deleteUploadWorkspace, request),
    importReferenceAssets: () =>
      ipcRenderer.invoke(IPC_CHANNELS.library.importReferenceAssets),
    revealReferenceAssets: () =>
      ipcRenderer.invoke(IPC_CHANNELS.library.revealReferenceAssets),
    deleteReferenceAsset: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.library.deleteReferenceAsset, request),
    exportCreativeZip: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.library.exportCreativeZip, request),
    exportVideo: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.library.exportVideo, request),
  },
  updater: {
    getDownloadedUpdate: () =>
      ipcRenderer.invoke(IPC_CHANNELS.updater.getDownloadedUpdate),
    installDownloadedUpdate: () =>
      ipcRenderer.invoke(IPC_CHANNELS.updater.installDownloadedUpdate),
    onDownloadedUpdate: (listener) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        update: AssetwellUpdateInfo,
      ) => {
        listener(update)
      }

      ipcRenderer.on(IPC_CHANNELS.updater.downloadedUpdate, handler)

      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.updater.downloadedUpdate,
          handler,
        )
      }
    },
  },
}

contextBridge.exposeInMainWorld("assetwell", bridge)
