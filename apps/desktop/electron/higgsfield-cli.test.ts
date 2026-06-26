import { beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { HiggsfieldCommandOutputEvent } from "@assetwell/desktop-bridge"

import {
  resetElectronMock,
  setElectronUserDataRoot,
} from "./test-support/electron-mock"
import {
  completeLastSpawn,
  completeSpawn,
  resetSpawnMock,
  spawnCalls,
} from "./test-support/spawn-mock"

const cli = await import("./higgsfield-cli")

async function makeFile(name = "asset.png") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assetwell-cli-test-"))
  const filePath = path.join(dir, name)
  await writeFile(filePath, "asset")
  return filePath
}

describe("Higgsfield CLI commands", () => {
  let userDataRoot = ""

  beforeEach(async () => {
    userDataRoot = await mkdtemp(path.join(os.tmpdir(), "assetwell-cli-user-"))
    resetElectronMock()
    setElectronUserDataRoot(userDataRoot)
    resetSpawnMock()
  })

  test("builds generate commands as argument arrays and emits parsed results", async () => {
    const firstAsset = await makeFile("first.png")
    const secondAsset = await makeFile("second.png")
    const events: HiggsfieldCommandOutputEvent[] = []

    const run = cli.startGenerateCommand(
      {
        model: " veo3_1_lite ",
        prompt: "  Animate the product  ",
        mediaKind: "video",
        assetPaths: [firstAsset],
        assetPath: secondAsset,
        assetMediaKind: "image",
        aspectRatio: " 9:16 ",
      },
      (event) => events.push(event),
    )

    expect(run).toMatchObject({ action: "generate", title: "Generate" })
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].args).toEqual([
      "--json",
      "generate",
      "create",
      "veo3_1_lite",
      "--prompt",
      "Animate the product",
      "--aspect_ratio",
      "9:16",
      "--image",
      firstAsset,
      "--image",
      secondAsset,
      "--wait",
    ])
    expect(spawnCalls[0].options.windowsHide).toBe(true)
    expect(spawnCalls[0].options.env?.HIGGSFIELD_PACKAGE_MANAGER).toBe("bun")
    expect(spawnCalls[0].options.env?.XDG_CONFIG_HOME).toContain(userDataRoot)

    await completeLastSpawn({
      stdout: "Result: https://cdn.example.com/output.mp4\n",
    })

    expect(events.map((event) => event.kind)).toEqual([
      "system",
      "stdout",
      "result",
      "exit",
    ])
    expect(events.find((event) => event.kind === "result")?.result).toEqual({
      artifacts: [
        {
          url: "https://cdn.example.com/output.mp4",
          filePath: null,
          id: null,
          mediaKind: "video",
        },
      ],
    })
  })

  test("can skip waiting for generation results", async () => {
    const events: HiggsfieldCommandOutputEvent[] = []

    cli.startGenerateCommand(
      {
        model: "image_model",
        prompt: "Make an image",
        mediaKind: "image",
        waitForResult: false,
      },
      (event) => events.push(event),
    )

    expect(spawnCalls[0].args).toEqual([
      "--json",
      "generate",
      "create",
      "image_model",
      "--prompt",
      "Make an image",
    ])
    await completeLastSpawn()
    expect(events.at(-1)).toMatchObject({ kind: "exit", exitCode: 0 })
  })

  test("builds list-model and upload commands", async () => {
    const asset = await makeFile("reference.png")

    cli.startListModelsCommand({ mediaKind: "text" }, () => undefined)
    cli.startUploadAssetCommand({ filePath: asset }, () => undefined)

    expect(spawnCalls.map((call) => call.args)).toEqual([
      ["model", "list", "--text"],
      ["upload", "create", asset],
    ])
    for (const call of spawnCalls) await completeSpawn(call)
  })

  test("validates renderer-provided generation inputs before spawning", () => {
    expect(() =>
      cli.startGenerateCommand(
        { model: "bad model", prompt: "Prompt", mediaKind: "image" },
        () => undefined,
      ),
    ).toThrow("Use a model name from the Higgsfield model list.")

    expect(() =>
      cli.startGenerateCommand(
        { model: "image_model", prompt: "   ", mediaKind: "image" },
        () => undefined,
      ),
    ).toThrow("Write a prompt before generating.")

    expect(() =>
      cli.startGenerateCommand(
        {
          model: "image_model",
          prompt: "Prompt",
          mediaKind: "image",
          aspectRatio: "16/9",
        },
        () => undefined,
      ),
    ).toThrow("Use an aspect ratio from the picker before generating.")

    expect(() =>
      cli.startUploadAssetCommand(
        { filePath: path.join(userDataRoot, "missing.png") },
        () => undefined,
      ),
    ).toThrow("The selected asset is no longer available.")
    expect(spawnCalls).toHaveLength(0)
  })
})
