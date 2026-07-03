import { beforeEach, describe, expect, test } from "bun:test"
import type {
  AssetwellLibrarySnapshot,
  AssetwellUpdateInfo,
  DesktopBridge,
  HiggsfieldCommandOutputEvent,
} from "@assetwell/desktop-bridge"
import type { IpcRendererEvent } from "electron"

import {
  exposedInMainWorld,
  ipcInvokeCalls,
  ipcRendererListeners,
  removedIpcRendererListeners,
  type IpcInvokeCall,
} from "./test-support/electron-mock"
import { IPC_CHANNELS } from "./shared/channels"

await import("./preload")

type BridgeInvokePath =
  | `app.${Extract<keyof DesktopBridge["app"], string>}`
  | `higgsfield.${Exclude<
      Extract<keyof DesktopBridge["higgsfield"], string>,
      "onCommandOutput"
    >}`
  | `library.${Extract<keyof DesktopBridge["library"], string>}`
  | `updater.${Exclude<
      Extract<keyof DesktopBridge["updater"], string>,
      "onDownloadedUpdate"
    >}`

interface BridgeInvokeCase {
  call: (bridge: DesktopBridge) => Promise<unknown>
  expected: IpcInvokeCall
}

const snapshot: AssetwellLibrarySnapshot = {
  schemaVersion: 1,
  creatives: [],
  videos: [],
  referenceLibrary: [],
  customPrompts: [],
  savedAt: "2026-06-24T00:00:00.000Z",
}

const bridgeInvocationCases = {
  "app.getInfo": {
    call: (bridge) => bridge.app.getInfo(),
    expected: [IPC_CHANNELS.app.getInfo],
  },
  "app.getCurrentReleaseNotes": {
    call: (bridge) => bridge.app.getCurrentReleaseNotes(),
    expected: [IPC_CHANNELS.app.getCurrentReleaseNotes],
  },
  "higgsfield.getStatus": {
    call: (bridge) => bridge.higgsfield.getStatus(),
    expected: [IPC_CHANNELS.higgsfield.getStatus],
  },
  "higgsfield.signIn": {
    call: (bridge) => bridge.higgsfield.signIn(),
    expected: [IPC_CHANNELS.higgsfield.signIn],
  },
  "higgsfield.signOut": {
    call: (bridge) => bridge.higgsfield.signOut(),
    expected: [IPC_CHANNELS.higgsfield.signOut],
  },
  "higgsfield.checkCredits": {
    call: (bridge) => bridge.higgsfield.checkCredits(),
    expected: [IPC_CHANNELS.higgsfield.checkCredits],
  },
  "higgsfield.checkWorkspace": {
    call: (bridge) => bridge.higgsfield.checkWorkspace(),
    expected: [IPC_CHANNELS.higgsfield.checkWorkspace],
  },
  "higgsfield.setWorkspace": {
    call: (bridge) =>
      bridge.higgsfield.setWorkspace({ id: "workspace-funded" }),
    expected: [
      IPC_CHANNELS.higgsfield.setWorkspace,
      { id: "workspace-funded" },
    ],
  },
  "higgsfield.listModels": {
    call: (bridge) => bridge.higgsfield.listModels({ mediaKind: "video" }),
    expected: [IPC_CHANNELS.higgsfield.listModels, { mediaKind: "video" }],
  },
  "higgsfield.getModelDetails": {
    call: (bridge) =>
      bridge.higgsfield.getModelDetails({
        model: "veo3_1_lite",
        mediaKind: "video",
      }),
    expected: [
      IPC_CHANNELS.higgsfield.getModelDetails,
      { model: "veo3_1_lite", mediaKind: "video" },
    ],
  },
  "higgsfield.listUploads": {
    call: (bridge) =>
      bridge.higgsfield.listUploads({ mediaKind: "image", size: 100 }),
    expected: [
      IPC_CHANNELS.higgsfield.listUploads,
      { mediaKind: "image", size: 100 },
    ],
  },
  "higgsfield.chooseAsset": {
    call: (bridge) => bridge.higgsfield.chooseAsset("image"),
    expected: [IPC_CHANNELS.higgsfield.chooseAsset, "image"],
  },
  "higgsfield.chooseAssets": {
    call: (bridge) => bridge.higgsfield.chooseAssets("image"),
    expected: [IPC_CHANNELS.higgsfield.chooseAssets, "image"],
  },
  "higgsfield.createUpload": {
    call: (bridge) =>
      bridge.higgsfield.createUpload({ filePath: "/tmp/reference.png" }),
    expected: [
      IPC_CHANNELS.higgsfield.createUpload,
      { filePath: "/tmp/reference.png" },
    ],
  },
  "higgsfield.uploadAsset": {
    call: (bridge) =>
      bridge.higgsfield.uploadAsset({ filePath: "/tmp/reference.png" }),
    expected: [
      IPC_CHANNELS.higgsfield.uploadAsset,
      { filePath: "/tmp/reference.png" },
    ],
  },
  "higgsfield.generate": {
    call: (bridge) =>
      bridge.higgsfield.generate({
        model: "image-model",
        prompt: "Prompt",
        mediaKind: "image",
      }),
    expected: [
      IPC_CHANNELS.higgsfield.generate,
      { model: "image-model", prompt: "Prompt", mediaKind: "image" },
    ],
  },
  "higgsfield.openOutput": {
    call: (bridge) =>
      bridge.higgsfield.openOutput({ target: "/tmp/output.png" }),
    expected: [
      IPC_CHANNELS.higgsfield.openOutput,
      { target: "/tmp/output.png" },
    ],
  },
  "higgsfield.cancelCommand": {
    call: (bridge) => bridge.higgsfield.cancelCommand("run-1"),
    expected: [IPC_CHANNELS.higgsfield.cancelCommand, "run-1"],
  },
  "library.loadSnapshot": {
    call: (bridge) => bridge.library.loadSnapshot(),
    expected: [IPC_CHANNELS.library.loadSnapshot],
  },
  "library.saveSnapshot": {
    call: (bridge) => bridge.library.saveSnapshot(snapshot),
    expected: [IPC_CHANNELS.library.saveSnapshot, snapshot],
  },
  "library.getSettings": {
    call: (bridge) => bridge.library.getSettings(),
    expected: [IPC_CHANNELS.library.getSettings],
  },
  "library.chooseOutputRoot": {
    call: (bridge) => bridge.library.chooseOutputRoot(),
    expected: [IPC_CHANNELS.library.chooseOutputRoot],
  },
  "library.revealOutputRoot": {
    call: (bridge) => bridge.library.revealOutputRoot(),
    expected: [IPC_CHANNELS.library.revealOutputRoot],
  },
  "library.loadBrandState": {
    call: (bridge) => bridge.library.loadBrandState(),
    expected: [IPC_CHANNELS.library.loadBrandState],
  },
  "library.setActiveBrand": {
    call: (bridge) =>
      bridge.library.setActiveBrand({ view: "brand", id: "brand-default" }),
    expected: [
      IPC_CHANNELS.library.setActiveBrand,
      { view: "brand", id: "brand-default" },
    ],
  },
  "library.createBrand": {
    call: (bridge) => bridge.library.createBrand({ name: "Brand A" }),
    expected: [IPC_CHANNELS.library.createBrand, { name: "Brand A" }],
  },
  "library.updateBrand": {
    call: (bridge) =>
      bridge.library.updateBrand({ id: "brand-a", name: "Brand Alpha" }),
    expected: [
      IPC_CHANNELS.library.updateBrand,
      { id: "brand-a", name: "Brand Alpha" },
    ],
  },
  "library.assignUploadsToBrand": {
    call: (bridge) =>
      bridge.library.assignUploadsToBrand({
        uploadIds: ["upload-1"],
        brandId: "brand-a",
      }),
    expected: [
      IPC_CHANNELS.library.assignUploadsToBrand,
      { uploadIds: ["upload-1"], brandId: "brand-a" },
    ],
  },
  "library.loadUploadFolderState": {
    call: (bridge) => bridge.library.loadUploadFolderState(),
    expected: [IPC_CHANNELS.library.loadUploadFolderState],
  },
  "library.createUploadFolder": {
    call: (bridge) => bridge.library.createUploadFolder({ name: "Folder A" }),
    expected: [IPC_CHANNELS.library.createUploadFolder, { name: "Folder A" }],
  },
  "library.updateUploadFolder": {
    call: (bridge) =>
      bridge.library.updateUploadFolder({ id: "folder-a", name: "Folder B" }),
    expected: [
      IPC_CHANNELS.library.updateUploadFolder,
      { id: "folder-a", name: "Folder B" },
    ],
  },
  "library.deleteUploadFolder": {
    call: (bridge) => bridge.library.deleteUploadFolder({ id: "folder-a" }),
    expected: [IPC_CHANNELS.library.deleteUploadFolder, { id: "folder-a" }],
  },
  "library.assignUploadsToFolder": {
    call: (bridge) =>
      bridge.library.assignUploadsToFolder({
        uploadIds: ["upload-1"],
        folderId: "folder-a",
      }),
    expected: [
      IPC_CHANNELS.library.assignUploadsToFolder,
      { uploadIds: ["upload-1"], folderId: "folder-a" },
    ],
  },
  "library.loadUploadsSnapshot": {
    call: (bridge) => bridge.library.loadUploadsSnapshot(),
    expected: [IPC_CHANNELS.library.loadUploadsSnapshot],
  },
  "library.setActiveUploadWorkspace": {
    call: (bridge) =>
      bridge.library.setActiveUploadWorkspace({ id: "Brand A" }),
    expected: [
      IPC_CHANNELS.library.setActiveUploadWorkspace,
      { id: "Brand A" },
    ],
  },
  "library.createUploadWorkspace": {
    call: (bridge) => bridge.library.createUploadWorkspace({ name: "Brand A" }),
    expected: [IPC_CHANNELS.library.createUploadWorkspace, { name: "Brand A" }],
  },
  "library.updateUploadWorkspace": {
    call: (bridge) =>
      bridge.library.updateUploadWorkspace({ id: "Brand A", name: "Brand B" }),
    expected: [
      IPC_CHANNELS.library.updateUploadWorkspace,
      { id: "Brand A", name: "Brand B" },
    ],
  },
  "library.deleteUploadWorkspace": {
    call: (bridge) => bridge.library.deleteUploadWorkspace({ id: "Brand A" }),
    expected: [IPC_CHANNELS.library.deleteUploadWorkspace, { id: "Brand A" }],
  },
  "library.importReferenceAssets": {
    call: (bridge) => bridge.library.importReferenceAssets(),
    expected: [IPC_CHANNELS.library.importReferenceAssets],
  },
  "library.revealReferenceAssets": {
    call: (bridge) => bridge.library.revealReferenceAssets(),
    expected: [IPC_CHANNELS.library.revealReferenceAssets],
  },
  "library.exportCreativeZip": {
    call: (bridge) =>
      bridge.library.exportCreativeZip({ title: "Creative", files: [] }),
    expected: [
      IPC_CHANNELS.library.exportCreativeZip,
      { title: "Creative", files: [] },
    ],
  },
  "library.exportVideo": {
    call: (bridge) =>
      bridge.library.exportVideo({ path: "/tmp/video.mp4", title: "Video" }),
    expected: [
      IPC_CHANNELS.library.exportVideo,
      { path: "/tmp/video.mp4", title: "Video" },
    ],
  },
  "updater.getDownloadedUpdate": {
    call: (bridge) => bridge.updater.getDownloadedUpdate(),
    expected: [IPC_CHANNELS.updater.getDownloadedUpdate],
  },
  "updater.installDownloadedUpdate": {
    call: (bridge) => bridge.updater.installDownloadedUpdate(),
    expected: [IPC_CHANNELS.updater.installDownloadedUpdate],
  },
} satisfies Record<BridgeInvokePath, BridgeInvokeCase>

describe("preload desktop bridge", () => {
  beforeEach(() => {
    ipcInvokeCalls.length = 0
    ipcRendererListeners.clear()
    removedIpcRendererListeners.length = 0
  })

  test("exposes the Assetwell bridge in the isolated world", () => {
    const bridge = exposedInMainWorld<DesktopBridge>("assetwell")

    expect(bridge).toBeDefined()
    expect(Object.keys(bridge)).toEqual([
      "app",
      "higgsfield",
      "library",
      "updater",
    ])
  })

  test("maps every invoking bridge method to the expected IPC channel", async () => {
    const bridge = exposedInMainWorld<DesktopBridge>("assetwell")

    for (const bridgeCase of Object.values(bridgeInvocationCases)) {
      await bridgeCase.call(bridge)
    }

    expect(ipcInvokeCalls).toEqual(
      Object.values(bridgeInvocationCases).map(
        (bridgeCase) => bridgeCase.expected,
      ),
    )
  })

  test("subscribes and unsubscribes command output events", () => {
    const bridge = exposedInMainWorld<DesktopBridge>("assetwell")
    const received: HiggsfieldCommandOutputEvent[] = []
    const output: HiggsfieldCommandOutputEvent = {
      runId: "run-1",
      kind: "stdout",
      text: "hello",
      timestamp: "2026-06-24T00:00:00.000Z",
    }

    const unsubscribe = bridge.higgsfield.onCommandOutput((event) => {
      received.push(event)
    })
    const handler = ipcRendererListeners.get(
      IPC_CHANNELS.higgsfield.commandOutput,
    )

    if (!handler) throw new Error("Expected command output listener.")
    handler({} as IpcRendererEvent, output)
    expect(received).toEqual([output])

    unsubscribe()
    expect(removedIpcRendererListeners).toEqual([
      [IPC_CHANNELS.higgsfield.commandOutput, handler],
    ])
    expect(
      ipcRendererListeners.has(IPC_CHANNELS.higgsfield.commandOutput),
    ).toBe(false)
  })

  test("subscribes and unsubscribes downloaded update events", () => {
    const bridge = exposedInMainWorld<DesktopBridge>("assetwell")
    const received: AssetwellUpdateInfo[] = []
    const update: AssetwellUpdateInfo = {
      version: "0.0.3",
      currentVersion: "0.0.2",
      releaseDate: "2026-06-26T00:00:00.000Z",
    }

    const unsubscribe = bridge.updater.onDownloadedUpdate((event) => {
      received.push(event)
    })
    const handler = ipcRendererListeners.get(
      IPC_CHANNELS.updater.downloadedUpdate,
    )

    if (!handler) throw new Error("Expected downloaded update listener.")
    handler({} as IpcRendererEvent, update)
    expect(received).toEqual([update])

    unsubscribe()
    expect(removedIpcRendererListeners).toEqual([
      [IPC_CHANNELS.updater.downloadedUpdate, handler],
    ])
    expect(
      ipcRendererListeners.has(IPC_CHANNELS.updater.downloadedUpdate),
    ).toBe(false)
  })
})
