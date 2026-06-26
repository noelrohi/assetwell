import { beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { AssetwellLibrarySnapshot } from "@assetwell/desktop-bridge"

import {
  openDialogCalls,
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

  test("imports, sanitizes, dedupes, lists, and deletes Brand Memory images", async () => {
    const outputRoot = path.join(userDataRoot, "Library")
    setNextOpenDialogResult({ canceled: false, filePaths: [outputRoot] })
    await localStore.chooseAssetwellOutputRoot()

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
    const imported = await localStore.importReferenceAssets()

    expect(imported.map((asset) => asset.name)).toEqual([
      "logo-final-2.png",
      "logo-final.png",
    ])
    expect(
      imported.every((asset) => asset.url.startsWith("assetwell-local://")),
    ).toBe(true)
    expect(await readFile(imported[0].filePath, "utf8")).toBe("two")
    expect(await readFile(imported[1].filePath, "utf8")).toBe("one")

    expect(await localStore.deleteReferenceAsset({ id: imported[0].id })).toBe(
      true,
    )
    expect(await localStore.deleteReferenceAsset({ id: "missing" })).toBe(false)
    expect(
      (await localStore.listReferenceAssets()).map((asset) => asset.name),
    ).toEqual(["logo-final.png"])
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
