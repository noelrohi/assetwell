import { beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { AssetwellLibrarySnapshot } from "@assetwell/desktop-bridge"

import {
  openDialogCalls,
  openedPaths,
  saveDialogCalls,
  resetElectronMock,
  setElectronUserDataRoot,
  setNextOpenDialogResult,
  setNextSaveDialogResult,
} from "./test-support/electron-mock"

const localStore = await import("./local-store")

async function makeTempDir() {
  return mkdtemp(path.join(os.tmpdir(), "assetwell-store-test-"))
}

describe("local store", () => {
  let userDataRoot = ""

  beforeEach(async () => {
    userDataRoot = await makeTempDir()
    resetElectronMock()
    setElectronUserDataRoot(userDataRoot)
    setNextOpenDialogResult({ canceled: true, filePaths: [] })
    setNextSaveDialogResult({ canceled: true, filePath: "" })
  })

  test("round-trips local asset URLs and content types", () => {
    const filePath = path.join(userDataRoot, "Creative Output", "hero.png")
    const url = localStore.localAssetUrl(filePath)

    expect(url).toBe(
      `assetwell-local://asset/${encodeURIComponent(path.resolve(filePath))}`,
    )
    expect(localStore.resolveLocalAssetUrl(url)).toBe(path.resolve(filePath))
    expect(
      localStore.resolveLocalAssetUrl("https://example.com/hero.png"),
    ).toBe(null)
    expect(
      localStore.resolveLocalAssetUrl("assetwell-local://other/%2Ftmp"),
    ).toBe(null)

    expect(localStore.localAssetContentType("image.avif")).toBe("image/avif")
    expect(localStore.localAssetContentType("clip.mov")).toBe("video/quicktime")
    expect(localStore.localAssetContentType("unknown.bin")).toBe(
      "application/octet-stream",
    )
  })

  test("identifies reference and previewable local assets by extension", () => {
    expect(localStore.isReferenceImage("LOGO.PNG")).toBe(true)
    expect(localStore.isReferenceImage("clip.mp4")).toBe(false)
    expect(localStore.isPreviewableLocalAsset("clip.MP4")).toBe(true)
    expect(localStore.isPreviewableLocalAsset("notes.txt")).toBe(false)
  })

  test("parses byte ranges for video streaming and rejects bad ones", () => {
    expect(localStore.parseByteRange("bytes=0-499", 1000)).toEqual({
      start: 0,
      end: 499,
    })
    // Open-ended range clamps to the last byte.
    expect(localStore.parseByteRange("bytes=500-", 1000)).toEqual({
      start: 500,
      end: 999,
    })
    // End beyond EOF is clamped.
    expect(localStore.parseByteRange("bytes=900-5000", 1000)).toEqual({
      start: 900,
      end: 999,
    })
    // Suffix range: the final N bytes.
    expect(localStore.parseByteRange("bytes=-200", 1000)).toEqual({
      start: 800,
      end: 999,
    })
    // Unsatisfiable / malformed → null (caller answers 416).
    expect(localStore.parseByteRange("bytes=1000-1200", 1000)).toBe(null)
    expect(localStore.parseByteRange("bytes=-", 1000)).toBe(null)
    expect(localStore.parseByteRange("items=0-10", 1000)).toBe(null)
  })

  test("stores an explicit Assetwell output root", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })

    await expect(localStore.chooseAssetwellOutputRoot()).resolves.toEqual({
      outputRoot,
    })
    await expect(localStore.getAssetwellSettings()).resolves.toEqual({
      outputRoot,
    })
    expect(openDialogCalls[0]?.[0]).toMatchObject({
      title: "Choose Assetwell library folder",
      properties: ["openDirectory", "createDirectory"],
    })
  })

  test("exports a local video through the save dialog", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    const sourceRoot = path.join(userDataRoot, "sources")
    await mkdir(sourceRoot, { recursive: true })
    const sourcePath = path.join(sourceRoot, "clip.mp4")
    await writeFile(sourcePath, "video-bytes")

    const targetPath = path.join(userDataRoot, "Downloads", "clip-copy.mp4")
    setNextSaveDialogResult({ canceled: false, filePath: targetPath })

    await expect(
      localStore.exportVideo({ path: sourcePath, title: "Launch Clip" }),
    ).resolves.toEqual({ filePath: targetPath })

    expect(await readFile(targetPath, "utf8")).toBe("video-bytes")
    expect(saveDialogCalls[0]?.[0]).toMatchObject({
      title: "Download video",
      defaultPath: path.join(outputRoot, "launch-clip.mp4"),
    })
  })

  test("uses the Uploads workspace output scope for export defaults", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    const sourceRoot = path.join(userDataRoot, "sources")
    await mkdir(sourceRoot, { recursive: true })
    const sourcePath = path.join(sourceRoot, "clip.mp4")
    await writeFile(sourcePath, "video-bytes")

    const targetPath = path.join(userDataRoot, "Downloads", "clip-copy.mp4")
    setNextSaveDialogResult({ canceled: false, filePath: targetPath })

    await localStore.exportVideo({
      path: sourcePath,
      title: "Launch Clip",
      uploadWorkspaceId: "Brand A",
    })

    expect(saveDialogCalls[0]?.[0]).toMatchObject({
      title: "Download video",
      defaultPath: path.join(
        outputRoot,
        "Outputs",
        "brand-a",
        "launch-clip.mp4",
      ),
    })
  })

  test("imports, sanitizes, dedupes, lists, and deletes Uploads images per workspace", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    await expect(localStore.getUploadWorkspaceState()).resolves.toMatchObject({
      activeWorkspaceId: "Default",
      workspaces: [{ id: "Default", name: "Default", isDefault: true }],
    })
    await localStore.createUploadWorkspace({ name: "Brand A" })

    const sourceRoot = path.join(userDataRoot, "sources")
    await mkdir(sourceRoot, { recursive: true })
    const firstSource = path.join(sourceRoot, "Logo Final.png")
    const secondSource = path.join(sourceRoot, "Logo Final!!.png")
    const ignoredSource = path.join(sourceRoot, "notes.txt")
    await writeFile(firstSource, "one")
    await writeFile(secondSource, "two")
    await writeFile(ignoredSource, "ignore")

    setNextOpenDialogResult({
      canceled: false,
      filePaths: [firstSource, secondSource, ignoredSource],
    })
    const importedSnapshot = await localStore.importReferenceAssets()
    const imported = importedSnapshot.references

    expect(openDialogCalls.at(-1)?.[0]).toMatchObject({
      title: "Add files to Uploads",
      defaultPath: path.join(outputRoot, "Uploads", "Brand A"),
    })
    expect(imported.map((asset) => asset.name)).toEqual([
      "logo-final-2.png",
      "logo-final.png",
    ])
    expect(
      imported.every((asset) => asset.url.startsWith("assetwell-local://")),
    ).toBe(true)
    expect(imported[0].filePath).toContain(path.join("Uploads", "Brand A"))
    expect(await readFile(imported[0].filePath, "utf8")).toBe("two")
    expect(await readFile(imported[1].filePath, "utf8")).toBe("one")

    await localStore.setActiveUploadWorkspace({ id: "Default" })
    expect(await localStore.listReferenceAssets()).toEqual([])

    await localStore.setActiveUploadWorkspace({ id: "Brand A" })
    await expect(localStore.revealReferenceAssets()).resolves.toBe(true)
    expect(openedPaths.at(-1)).toBe(path.join(outputRoot, "Uploads", "Brand A"))

    const afterDelete = await localStore.deleteReferenceAsset({
      id: imported[0].id,
    })
    expect(afterDelete.references.map((asset) => asset.name)).toEqual([
      "logo-final.png",
    ])

    const missingDelete = await localStore.deleteReferenceAsset({
      id: "missing",
    })
    expect(missingDelete.references.map((asset) => asset.name)).toEqual([
      "logo-final.png",
    ])
    expect(
      (await localStore.listReferenceAssets()).map((asset) => asset.name),
    ).toEqual(["logo-final.png"])
  })

  test("stores Uploads workspace display names separately from folder ids", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    const snapshot = await localStore.createUploadWorkspace({
      name: "Brand/A?",
    })

    expect(snapshot.workspaceState.activeWorkspaceId).toBe("Brand-A")
    expect(
      snapshot.workspaceState.workspaces.find(
        (workspace) => workspace.id === "Brand-A",
      ),
    ).toEqual({ id: "Brand-A", name: "Brand/A?", isDefault: false })

    const settings = JSON.parse(
      await readFile(path.join(userDataRoot, "state", "settings.json"), "utf8"),
    ) as { uploadWorkspaces?: unknown[] }
    expect(settings.uploadWorkspaces).toContainEqual({
      id: "Brand-A",
      name: "Brand/A?",
    })
  })

  test("stores Assetwell brand metadata and upload assignments locally", async () => {
    const initial = await localStore.loadBrandState()

    expect(initial).toMatchObject({
      activeBrandId: null,
      activeBrandView: "all",
      brands: [{ id: "brand-default", name: "Default brand", isDefault: true }],
      assignments: [],
    })

    const created = await localStore.createBrand({ name: "Brand/A?" })
    const brand = created.brands.find((item) => item.name === "Brand/A?")
    expect(brand).toMatchObject({ id: "brand-a", isDefault: false })
    expect(created.activeBrandView).toBe("brand")
    expect(created.activeBrandId).toBe("brand-a")

    const assigned = await localStore.assignUploadsToBrand({
      uploadIds: [" upload-1 ", "upload-2", "upload-1"],
      brandId: "brand-a",
    })
    expect(assigned.assignments).toEqual([
      { uploadId: "upload-1", brandId: "brand-a" },
      { uploadId: "upload-2", brandId: "brand-a" },
    ])

    const renamed = await localStore.updateBrand({
      id: "brand-a",
      name: "Brand Alpha",
    })
    expect(renamed.brands).toContainEqual({
      id: "brand-a",
      name: "Brand Alpha",
      isDefault: false,
    })

    const unsorted = await localStore.assignUploadsToBrand({
      uploadIds: ["upload-2"],
      brandId: null,
    })
    expect(unsorted.assignments).toContainEqual({
      uploadId: "upload-2",
      brandId: null,
    })

    const view = await localStore.setActiveBrand({ view: "unsorted" })
    expect(view.activeBrandView).toBe("unsorted")
    expect(view.activeBrandId).toBe(null)

    const stored = JSON.parse(
      await readFile(
        path.join(userDataRoot, "state", "brands.v1.json"),
        "utf8",
      ),
    ) as { brands?: unknown[]; assignments?: unknown[] }
    expect(stored.brands).toContainEqual({
      id: "brand-a",
      name: "Brand Alpha",
    })
    expect(stored.assignments).toContainEqual({
      uploadId: "upload-1",
      brandId: "brand-a",
    })
  })

  test("stores upload folders and upload assignments locally", async () => {
    await expect(localStore.loadUploadFolderState()).resolves.toEqual({
      folders: [],
      assignments: [],
    })

    const created = await localStore.createUploadFolder({ name: "Folder/A?" })
    expect(created.folders).toContainEqual({
      id: "folder-a",
      name: "Folder/A?",
    })

    const createdWithDuplicateSlug = await localStore.createUploadFolder({
      name: "Folder A",
    })
    expect(createdWithDuplicateSlug.folders).toContainEqual({
      id: "folder-a-2",
      name: "Folder A",
    })

    await expect(
      localStore.createUploadFolder({ name: " folder/a? " }),
    ).rejects.toThrow("A folder with that name already exists.")

    const renamed = await localStore.updateUploadFolder({
      id: "folder-a",
      name: "Folder Alpha",
    })
    expect(renamed.folders).toContainEqual({
      id: "folder-a",
      name: "Folder Alpha",
    })

    await expect(
      localStore.updateUploadFolder({ id: "folder-a-2", name: "folder alpha" }),
    ).rejects.toThrow("A folder with that name already exists.")

    const assigned = await localStore.assignUploadsToFolder({
      uploadIds: [" upload-1 ", "upload-2", "upload-1"],
      folderId: "folder-a",
    })
    expect(assigned.assignments).toEqual([
      { uploadId: "upload-1", folderId: "folder-a" },
      { uploadId: "upload-2", folderId: "folder-a" },
    ])

    const unassigned = await localStore.assignUploadsToFolder({
      uploadIds: ["upload-2"],
      folderId: null,
    })
    expect(unassigned.assignments).toEqual([
      { uploadId: "upload-1", folderId: "folder-a" },
    ])

    const deleted = await localStore.deleteUploadFolder({ id: "folder-a" })
    expect(deleted.folders).toEqual([{ id: "folder-a-2", name: "Folder A" }])
    expect(deleted.assignments).toEqual([])

    const stored = JSON.parse(
      await readFile(
        path.join(userDataRoot, "state", "upload-folders.v1.json"),
        "utf8",
      ),
    ) as { folders?: unknown[]; assignments?: unknown[] }
    expect(stored.folders).toEqual([{ id: "folder-a-2", name: "Folder A" }])
    expect(stored.assignments).toEqual([])

    await expect(localStore.loadUploadFolderState()).resolves.toEqual({
      folders: [{ id: "folder-a-2", name: "Folder A" }],
      assignments: [],
    })
  })

  test("adds a compatibility Uploads scope when activating a Higgsfield workspace", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    const workspaceId = "54343c6a-aeb7-4499-a546-31bd6c14760c"
    const snapshot = await localStore.setActiveUploadWorkspace({
      id: workspaceId,
      name: "Paid Team",
    })

    expect(snapshot.workspaceState.activeWorkspaceId).toBe(workspaceId)
    expect(snapshot.workspaceState.workspaces).toContainEqual({
      id: workspaceId,
      name: "Paid Team",
      isDefault: false,
    })
    await writeFile(
      path.join(outputRoot, "Uploads", workspaceId, "reference.png"),
      "asset",
    )
    await expect(localStore.listReferenceAssets()).resolves.toMatchObject([
      { name: "reference.png" },
    ])

    const settings = JSON.parse(
      await readFile(path.join(userDataRoot, "state", "settings.json"), "utf8"),
    ) as { activeUploadWorkspaceId?: string; uploadWorkspaces?: unknown[] }
    expect(settings.activeUploadWorkspaceId).toBe(workspaceId)
    expect(settings.uploadWorkspaces).toContainEqual({
      id: workspaceId,
      name: "Paid Team",
    })
  })

  test("rejects duplicate Uploads workspace display names", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    await localStore.createUploadWorkspace({ name: "Brand-A" })
    await localStore.updateUploadWorkspace({ id: "Brand-A", name: "Brand A" })

    await expect(
      localStore.createUploadWorkspace({ name: "Brand A" }),
    ).rejects.toThrow("workspace with that name already exists")
    await expect(
      localStore.updateUploadWorkspace({ id: "Brand-A", name: " default " }),
    ).rejects.toThrow("workspace with that name already exists")
  })

  test("renames and deletes Uploads workspaces", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    await localStore.createUploadWorkspace({ name: "Brand A" })
    await localStore.createUploadWorkspace({ name: "Brand B" })

    const renamed = await localStore.updateUploadWorkspace({
      id: "Brand A",
      name: "Brand Alpha",
    })
    expect(renamed.workspaceState.workspaces).toContainEqual({
      id: "Brand A",
      name: "Brand Alpha",
      isDefault: false,
    })

    await writeFile(
      path.join(outputRoot, "Uploads", "Brand A", "keep.png"),
      "brand-a",
    )
    const afterInactiveDelete = await localStore.deleteUploadWorkspace({
      id: "Brand A",
    })
    expect(afterInactiveDelete.workspaceState.activeWorkspaceId).toBe("Brand B")
    expect(
      afterInactiveDelete.workspaceState.workspaces.some(
        (workspace) => workspace.id === "Brand A",
      ),
    ).toBe(false)
    await expect(
      readFile(path.join(outputRoot, "Uploads", "Brand A", "keep.png")),
    ).rejects.toThrow()

    const afterActiveDelete = await localStore.deleteUploadWorkspace({
      id: "Brand B",
    })
    expect(afterActiveDelete.workspaceState.activeWorkspaceId).toBe("Default")
    expect(afterActiveDelete.workspaceState.workspaces).toEqual([
      { id: "Default", name: "Default", isDefault: true },
    ])

    const renamedDefault = await localStore.updateUploadWorkspace({
      id: "Default",
      name: "Inbox",
    })
    expect(renamedDefault.workspaceState.workspaces).toEqual([
      { id: "Default", name: "Inbox", isDefault: true },
    ])
    await expect(localStore.getUploadWorkspaceState()).resolves.toEqual({
      activeWorkspaceId: "Default",
      workspaces: [{ id: "Default", name: "Inbox", isDefault: true }],
    })
    await expect(
      localStore.deleteUploadWorkspace({ id: "Default" }),
    ).rejects.toThrow("default Uploads workspace cannot be deleted")
  })

  test("shows existing Brand Memory files in the Default Uploads workspace", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

    const legacyRoot = path.join(outputRoot, "Brand Memory")
    await mkdir(legacyRoot, { recursive: true })
    await writeFile(path.join(legacyRoot, "Legacy Logo.png"), "legacy")

    await expect(localStore.getUploadWorkspaceState()).resolves.toMatchObject({
      activeWorkspaceId: "Default",
    })

    const references = await localStore.listReferenceAssets()
    expect(references.map((asset) => asset.name)).toEqual(["Legacy Logo.png"])
    expect(references[0]?.filePath).toBe(
      path.join(outputRoot, "Uploads", "Default", "Legacy Logo.png"),
    )
    expect(await readFile(references[0]?.filePath ?? "", "utf8")).toBe("legacy")
  })

  test("saves and reloads normalized library snapshots", async () => {
    const customPrompts: AssetwellLibrarySnapshot["customPrompts"] = [
      {
        id: "prompt-1",
        title: "Prompt",
        body: "Body",
        kind: "image",
        createdAt: "2026-06-24T00:00:00.000Z",
      },
    ]
    const snapshot: AssetwellLibrarySnapshot = {
      schemaVersion: 1,
      creatives: [
        {
          id: "creative-1",
          title: "Creative",
          prompt: "Prompt",
          ratioId: "1:1",
          ratioW: 1024,
          ratioH: 1024,
          model: "model",
          createdAt: "2026-06-24T00:00:00.000Z",
          heroUrl: "",
          status: "pending",
          takes: [{ id: "take-1", url: "", status: "pending", runId: "run" }],
          selectedTakeId: "",
          placements: [{ size: "300x250", status: "pending", runId: "run" }],
          referenceAssets: [
            {
              id: "reference-1",
              name: "Logo",
              url: "assetwell-local://asset/logo",
            },
          ],
        },
      ],
      videos: [
        {
          id: "video-1",
          size: "1080x1080",
          status: "pending",
          posterUrl: "poster.png",
          prompt: "Prompt",
          createdAt: "2026-06-24T00:00:00.000Z",
          runId: "run",
        },
      ],
      referenceLibrary: [
        {
          id: "reference-1",
          name: "Logo",
          url: "assetwell-local://asset/logo",
        },
      ],
      customPrompts,
      savedAt: "2026-06-24T00:00:00.000Z",
    }

    await expect(localStore.saveLibrarySnapshot(snapshot)).resolves.toBe(true)

    const loaded = await localStore.loadLibrarySnapshot()
    expect(loaded?.creatives).toHaveLength(1)
    expect(loaded?.creatives[0].status).toBe("failed")
    expect(loaded?.creatives[0].takes[0]).toMatchObject({
      status: "failed",
      error:
        "Generation was interrupted before Assetwell received an output. Regenerate when ready.",
    })
    expect("runId" in (loaded?.creatives[0].takes[0] ?? {})).toBe(false)
    expect(loaded?.creatives[0].placements[0]).toMatchObject({
      status: "failed",
      error:
        "Generation was interrupted before Assetwell received an output. Regenerate when ready.",
    })
    expect("runId" in (loaded?.creatives[0].placements[0] ?? {})).toBe(false)
    expect(loaded?.creatives[0].referenceAssets).toHaveLength(1)
    expect(loaded?.videos[0]).toMatchObject({
      status: "failed",
      error:
        "Generation was interrupted before Assetwell received an output. Regenerate when ready.",
    })
    expect("runId" in (loaded?.videos[0] ?? {})).toBe(false)
    expect(loaded?.referenceLibrary).toHaveLength(1)
    expect(loaded?.customPrompts).toEqual(snapshot.customPrompts)
  })
})
