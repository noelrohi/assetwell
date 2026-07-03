import { beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { HiggsfieldUploadedAsset } from "@assetwell/desktop-bridge"

import {
  resetElectronMock,
  setElectronUserDataRoot,
} from "./test-support/electron-mock"

const uploadNameStore = await import("./upload-name-store")

async function makeTempDir() {
  return mkdtemp(path.join(os.tmpdir(), "assetwell-upload-name-test-"))
}

describe("upload name store", () => {
  let userDataRoot = ""

  beforeEach(async () => {
    userDataRoot = await makeTempDir()
    resetElectronMock()
    setElectronUserDataRoot(userDataRoot)
  })

  test("persists and sanitizes upload names", async () => {
    await expect(
      uploadNameStore.recordUploadName(
        " upload-1 ",
        "\u0000Spring\nHero.png\t",
      ),
    ).resolves.toBe("SpringHero.png")
    await expect(
      uploadNameStore.recordUploadName("upload-2", ` ${"a".repeat(130)} `),
    ).resolves.toBe("a".repeat(120))
    await expect(
      uploadNameStore.recordUploadName("upload-empty", "\u0000\n\t"),
    ).resolves.toBeNull()

    await expect(uploadNameStore.loadUploadNames()).resolves.toEqual({
      "upload-1": "SpringHero.png",
      "upload-2": "a".repeat(120),
    })

    const stored = JSON.parse(
      await readFile(uploadNameStatePath(userDataRoot), "utf8"),
    ) as { schemaVersion?: unknown; entries?: unknown }
    expect(stored.schemaVersion).toBe(1)
    expect(stored.entries).toEqual({
      "upload-1": "SpringHero.png",
      "upload-2": "a".repeat(120),
    })
  })

  test("reloads normalized names and drops empty entries", async () => {
    await mkdir(path.dirname(uploadNameStatePath(userDataRoot)), {
      recursive: true,
    })
    await writeFile(
      uploadNameStatePath(userDataRoot),
      JSON.stringify({
        schemaVersion: 1,
        entries: {
          " upload-3 ": " Reloaded.png ",
          "upload-empty": "\u0000\n\t",
          "": "No id.png",
        },
      }),
    )

    await expect(uploadNameStore.loadUploadNames()).resolves.toEqual({
      "upload-3": "Reloaded.png",
    })

    const stored = JSON.parse(
      await readFile(uploadNameStatePath(userDataRoot), "utf8"),
    ) as { entries?: unknown }
    expect(stored.entries).toEqual({ "upload-3": "Reloaded.png" })
  })

  test("applies stored names and leaves unknown upload ids untouched", () => {
    const items: HiggsfieldUploadedAsset[] = [
      uploadAsset("upload-1", "Upload upload-1"),
      uploadAsset("upload-2", "remote-name.png"),
    ]

    expect(
      uploadNameStore.applyUploadNames(items, {
        "upload-1": "SpringHero.png",
        unknown: "Unknown.png",
      }),
    ).toEqual([{ ...items[0], name: "SpringHero.png" }, items[1]])
    expect(uploadNameStore.uploadNameFor("missing", {})).toBeNull()
  })
})

function uploadAsset(uploadId: string, name: string): HiggsfieldUploadedAsset {
  return {
    id: uploadId,
    uploadId,
    name,
    url: `https://cdn.example.com/${uploadId}.png`,
    mediaKind: "image",
    createdAt: null,
    sizeBytes: null,
  }
}

function uploadNameStatePath(userDataRoot: string) {
  return path.join(userDataRoot, "state", "upload-names.v1.json")
}
