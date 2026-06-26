import { contextBridge, ipcRenderer } from "electron"
import type {
  DesktopBridge,
  HiggsfieldCommandOutputEvent,
} from "@assetwell/desktop-bridge"

import { IPC_CHANNELS } from "./shared/channels"

const bridge: DesktopBridge = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getInfo),
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
    listReferenceAssets: () =>
      ipcRenderer.invoke(IPC_CHANNELS.library.listReferenceAssets),
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
}

contextBridge.exposeInMainWorld("assetwell", bridge)
