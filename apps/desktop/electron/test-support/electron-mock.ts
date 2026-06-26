import { mock } from "bun:test"
import type {
  IpcRendererEvent,
  OpenDialogReturnValue,
  SaveDialogReturnValue,
} from "electron"

type ExposedWorlds = Record<string, unknown>
export type IpcInvokeCall = readonly [channel: string, ...args: unknown[]]
export type IpcRendererHandler = (
  event: IpcRendererEvent,
  ...args: unknown[]
) => void
export type DialogCall = readonly unknown[]

const defaultOpenDialogResult: OpenDialogReturnValue = {
  canceled: true,
  filePaths: [],
}
const defaultSaveDialogResult: SaveDialogReturnValue = {
  canceled: true,
  filePath: "",
}

let userDataRoot = "/tmp/assetwell"
let nextOpenDialogResult: OpenDialogReturnValue = defaultOpenDialogResult
let nextSaveDialogResult: SaveDialogReturnValue = defaultSaveDialogResult

export const exposedWorlds: ExposedWorlds = {}
export const ipcInvokeCalls: IpcInvokeCall[] = []
export const ipcRendererListeners = new Map<string, IpcRendererHandler>()
export const removedIpcRendererListeners: Array<
  readonly [channel: string, handler: IpcRendererHandler]
> = []
export const openDialogCalls: DialogCall[] = []
export const saveDialogCalls: DialogCall[] = []
export const openedPaths: string[] = []

export function resetElectronMock() {
  userDataRoot = "/tmp/assetwell"
  nextOpenDialogResult = defaultOpenDialogResult
  nextSaveDialogResult = defaultSaveDialogResult
  for (const key of Object.keys(exposedWorlds)) delete exposedWorlds[key]
  ipcInvokeCalls.length = 0
  ipcRendererListeners.clear()
  removedIpcRendererListeners.length = 0
  openDialogCalls.length = 0
  saveDialogCalls.length = 0
  openedPaths.length = 0
}

export function setElectronUserDataRoot(root: string) {
  userDataRoot = root
}

export function setNextOpenDialogResult(result: OpenDialogReturnValue) {
  nextOpenDialogResult = result
}

export function setNextSaveDialogResult(result: SaveDialogReturnValue) {
  nextSaveDialogResult = result
}

export function exposedInMainWorld<T>(name: string) {
  const value = exposedWorlds[name]
  if (value === undefined) {
    throw new Error(`Nothing was exposed in main world as ${name}.`)
  }
  return value as T
}

mock.module("electron", () => ({
  app: {
    getPath: () => userDataRoot,
  },
  dialog: {
    showOpenDialog: async (...args: unknown[]) => {
      openDialogCalls.push(args)
      return nextOpenDialogResult
    },
    showSaveDialog: async (...args: unknown[]) => {
      saveDialogCalls.push(args)
      return nextSaveDialogResult
    },
  },
  shell: {
    openPath: async (target: string) => {
      openedPaths.push(target)
      return ""
    },
  },
  nativeImage: {
    createFromPath: () => ({
      isEmpty: () => true,
      getSize: () => ({ width: 1, height: 1 }),
      crop: () => ({ resize: () => ({ toPNG: () => Buffer.from([]) }) }),
    }),
  },
  BrowserWindow: { fromWebContents: () => null },
  ipcMain: { handle: () => undefined },
  contextBridge: {
    exposeInMainWorld: (name: string, value: unknown) => {
      exposedWorlds[name] = value
    },
  },
  ipcRenderer: {
    invoke: async (channel: string, ...args: unknown[]) => {
      ipcInvokeCalls.push([channel, ...args])
      return { channel, args }
    },
    on: (channel: string, handler: IpcRendererHandler) => {
      ipcRendererListeners.set(channel, handler)
    },
    removeListener: (channel: string, handler: IpcRendererHandler) => {
      removedIpcRendererListeners.push([channel, handler])
      if (ipcRendererListeners.get(channel) === handler) {
        ipcRendererListeners.delete(channel)
      }
    },
  },
}))
