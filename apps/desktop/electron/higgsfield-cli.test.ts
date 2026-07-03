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
const uploadNameStore = await import("./upload-name-store")

async function makeFile(name = "asset.png") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "assetwell-cli-test-"))
  const filePath = path.join(dir, name)
  await writeFile(filePath, "asset")
  return filePath
}

async function waitForSpawnCount(count: number) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (spawnCalls.length >= count) return
    await Promise.resolve()
  }
  throw new Error(
    `Expected ${count} spawned processes, got ${spawnCalls.length}.`,
  )
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
        durationSeconds: 8,
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
      "--duration",
      "8",
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

  test("treats a logged-out auth token check as unauthenticated", async () => {
    const status = cli.getHiggsfieldCliStatus()

    await waitForSpawnCount(1)
    expect(spawnCalls[0].args).toEqual(["version"])
    await completeSpawn(spawnCalls[0], { stdout: "1.0.2\n" })

    await waitForSpawnCount(2)
    expect(spawnCalls[1].args).toEqual(["auth", "token"])
    await completeSpawn(spawnCalls[1], {
      stderr: "Error: not authenticated\n",
      exitCode: 1,
    })

    await expect(status).resolves.toMatchObject({
      installed: true,
      authStatus: "unauthenticated",
      workspaceStatus: "unknown",
      detail: "Sign in to connect your Higgsfield account.",
    })
    expect(spawnCalls).toHaveLength(2)
  })

  test("auto-selects the default workspace during status checks", async () => {
    const status = cli.getHiggsfieldCliStatus()

    await waitForSpawnCount(1)
    expect(spawnCalls[0].args).toEqual(["version"])
    await completeSpawn(spawnCalls[0], { stdout: "1.0.2\n" })

    await waitForSpawnCount(2)
    expect(spawnCalls[1].args).toEqual(["auth", "token"])
    await completeSpawn(spawnCalls[1], { stdout: "redacted-token\n" })

    await waitForSpawnCount(3)
    expect(spawnCalls[2].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[2], {
      stdout: "No workspace selected.\n",
    })

    await waitForSpawnCount(4)
    expect(spawnCalls[3].args).toEqual(["--json", "workspace", "list"])
    await completeSpawn(spawnCalls[3], {
      stdout: `[
        {"id":"workspace-empty","name":"Empty","credits":0,"is_selected":false},
        {"id":"workspace-funded","name":"Funded","credits":42,"is_selected":false}
      ]`,
    })

    await waitForSpawnCount(5)
    expect(spawnCalls[4].args).toEqual(["workspace", "set", "workspace-funded"])
    await completeSpawn(spawnCalls[4])

    await waitForSpawnCount(6)
    expect(spawnCalls[5].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[5], {
      stdout: "Default workspace selected\n",
    })

    await expect(status).resolves.toMatchObject({
      installed: true,
      authStatus: "authenticated",
      workspaceStatus: "verified",
      detail: null,
    })
  })

  test("switches Higgsfield workspaces through the CLI", async () => {
    const context = cli.setHiggsfieldWorkspace({ id: " workspace-funded " })

    await waitForSpawnCount(1)
    expect(spawnCalls[0].args).toEqual(["workspace", "set", "workspace-funded"])
    await completeSpawn(spawnCalls[0])

    await waitForSpawnCount(2)
    expect(spawnCalls[1].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[1], {
      stdout: "Funded workspace selected\n",
    })

    await waitForSpawnCount(3)
    expect(spawnCalls[2].args).toEqual(["--json", "workspace", "list"])
    await completeSpawn(spawnCalls[2], {
      stdout: `[
        {"id":"workspace-empty","name":"Empty","credits":0,"is_selected":false},
        {"id":"workspace-funded","name":"Funded","credits":42,"is_selected":true}
      ]`,
    })

    await expect(context).resolves.toMatchObject({
      selected: {
        id: "workspace-funded",
        name: "Funded",
        credits: 42,
        isSelected: true,
      },
    })
  })

  test("selects the default workspace before checking credits", async () => {
    const account = cli.getHiggsfieldAccountStatus()

    await waitForSpawnCount(1)
    expect(spawnCalls[0].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[0], {
      stdout: "No workspace selected.\n",
    })

    await waitForSpawnCount(2)
    expect(spawnCalls[1].args).toEqual(["--json", "workspace", "list"])
    await completeSpawn(spawnCalls[1], {
      stdout: `[
        {"id":"workspace-empty","name":"Empty","credits":0,"is_selected":false},
        {"id":"workspace-funded","name":"Funded","credits":42,"is_selected":false}
      ]`,
    })

    await waitForSpawnCount(3)
    expect(spawnCalls[2].args).toEqual(["workspace", "set", "workspace-funded"])
    await completeSpawn(spawnCalls[2])

    await waitForSpawnCount(4)
    expect(spawnCalls[3].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[3], {
      stdout: "Default workspace selected\n",
    })

    await waitForSpawnCount(5)
    expect(spawnCalls[4].args).toEqual(["--json", "account", "status"])
    await completeSpawn(spawnCalls[4], {
      stdout: `{"email":"team@example.com","credits":42,"subscription_plan_type":"creator"}`,
    })

    await expect(account).resolves.toMatchObject({
      email: "team@example.com",
      credits: 42,
      plan: "creator",
    })
  })

  test("lists Higgsfield uploads through the selected workspace", async () => {
    const uploads = cli.getHiggsfieldUploads({ mediaKind: "image", size: 100 })

    await waitForSpawnCount(1)
    expect(spawnCalls[0].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[0], {
      stdout: "Funded workspace selected\n",
    })

    await waitForSpawnCount(2)
    expect(spawnCalls[1].args).toEqual([
      "--json",
      "upload",
      "list",
      "--image",
      "--size",
      "100",
    ])
    await completeSpawn(spawnCalls[1], {
      stdout: `{
        "cursor": "next-cursor",
        "items": [{
          "id": "808ccacb-d4be-465e-b02d-432de39b97a8",
          "type": "image",
          "url": "https://cdn.example.com/upload.png"
        }]
      }`,
    })

    await expect(uploads).resolves.toMatchObject({
      cursor: "next-cursor",
      items: [
        {
          uploadId: "808ccacb-d4be-465e-b02d-432de39b97a8",
          name: "upload.png",
          mediaKind: "image",
        },
      ],
    })
  })

  test("overlays stored upload names when listing Higgsfield uploads", async () => {
    const uploadId = "808ccacb-d4be-465e-b02d-432de39b97a8"
    await uploadNameStore.recordUploadName(uploadId, "Local Reference.png")

    const uploads = cli.getHiggsfieldUploads({ mediaKind: "image", size: 100 })

    await waitForSpawnCount(1)
    expect(spawnCalls[0].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[0], {
      stdout: "Funded workspace selected\n",
    })

    await waitForSpawnCount(2)
    expect(spawnCalls[1].args).toEqual([
      "--json",
      "upload",
      "list",
      "--image",
      "--size",
      "100",
    ])
    await completeSpawn(spawnCalls[1], {
      stdout: `{
        "items": [{
          "id": "${uploadId}",
          "type": "image",
          "url": "https://cdn.example.com/user_xxx/${uploadId}.png"
        }]
      }`,
    })

    await expect(uploads).resolves.toMatchObject({
      items: [
        {
          uploadId,
          name: "Local Reference.png",
          mediaKind: "image",
        },
      ],
    })
  })

  test("creates Higgsfield uploads through the CLI", async () => {
    const asset = await makeFile("reference.png")
    const upload = cli.createHiggsfieldUpload({ filePath: asset })

    await waitForSpawnCount(1)
    expect(spawnCalls[0].args).toEqual(["workspace", "status"])
    await completeSpawn(spawnCalls[0], {
      stdout: "Funded workspace selected\n",
    })

    await waitForSpawnCount(2)
    expect(spawnCalls[1].args).toEqual(["--json", "upload", "create", asset])
    await completeSpawn(spawnCalls[1], {
      stdout: `{
        "id": "808ccacb-d4be-465e-b02d-432de39b97a8",
        "type": "image",
        "url": "https://cdn.example.com/upload.png"
      }`,
    })

    await expect(upload).resolves.toMatchObject({
      uploadId: "808ccacb-d4be-465e-b02d-432de39b97a8",
      name: "reference.png",
      url: "https://cdn.example.com/upload.png",
    })
  })

  test("passes Higgsfield upload ids as generation media references", async () => {
    cli.startGenerateCommand(
      {
        model: "image_model",
        prompt: "Use a shared reference",
        mediaKind: "image",
        assetPath: "808ccacb-d4be-465e-b02d-432de39b97a8",
      },
      () => undefined,
    )

    expect(spawnCalls[0].args).toEqual([
      "--json",
      "generate",
      "create",
      "image_model",
      "--prompt",
      "Use a shared reference",
      "--image",
      "808ccacb-d4be-465e-b02d-432de39b97a8",
      "--wait",
    ])
    await completeLastSpawn()
  })

  test("builds sign-out command as a product action", async () => {
    const run = cli.startSignOutCommand(() => undefined)

    expect(run).toMatchObject({ action: "sign-out", title: "Sign out" })
    expect(spawnCalls[0].args).toEqual(["auth", "logout"])
    await completeLastSpawn()
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

  test("surfaces unavailable model details as CLI errors", async () => {
    const details = cli.getHiggsfieldModelDetails({
      model: "soul-v2",
      mediaKind: "image",
    })

    expect(spawnCalls[0].args).toEqual(["--json", "model", "get", "soul-v2"])
    await completeLastSpawn({
      stderr: 'Error: No model with job_set_type "soul-v2".',
      exitCode: 1,
    })

    await expect(details).rejects.toThrow(
      'Error: No model with job_set_type "soul-v2".',
    )
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
      cli.startGenerateCommand(
        {
          model: "video_model",
          prompt: "Prompt",
          mediaKind: "video",
          durationSeconds: 0,
        },
        () => undefined,
      ),
    ).toThrow("Use a whole-second video duration between 1 and 60.")

    expect(() =>
      cli.startUploadAssetCommand(
        { filePath: path.join(userDataRoot, "missing.png") },
        () => undefined,
      ),
    ).toThrow("The selected asset is no longer available.")
    expect(spawnCalls).toHaveLength(0)
  })
})
