import { beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import {
  resetElectronMock,
  setElectronUserDataRoot,
} from "./test-support/electron-mock"

const settingsStore = await import("./settings-store")

async function makeTempDir() {
  return mkdtemp(path.join(os.tmpdir(), "assetwell-settings-test-"))
}

describe("settings store", () => {
  let tempDir = ""

  beforeEach(async () => {
    tempDir = await makeTempDir()
    resetElectronMock()
    setElectronUserDataRoot(tempDir)
  })

  test("serializes concurrent writes to the same JSON file", async () => {
    const filePath = path.join(tempDir, "state", "concurrent.json")

    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        settingsStore.writeJsonFile(filePath, { index }),
      ),
    )

    const written = JSON.parse(await readFile(filePath, "utf8")) as {
      index: number
    }
    expect(written.index).toBe(24)
  })

  test("keeps independent files writable in parallel", async () => {
    const first = path.join(tempDir, "state", "a.json")
    const second = path.join(tempDir, "state", "b.json")

    await Promise.all([
      settingsStore.writeJsonFile(first, { file: "a" }),
      settingsStore.writeJsonFile(second, { file: "b" }),
    ])

    expect(JSON.parse(await readFile(first, "utf8"))).toEqual({ file: "a" })
    expect(JSON.parse(await readFile(second, "utf8"))).toEqual({ file: "b" })
  })
})
