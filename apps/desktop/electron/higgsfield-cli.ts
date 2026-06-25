import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { randomUUID } from "node:crypto"
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { copyFile, mkdir, rename, unlink, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"

import { app, nativeImage } from "electron"
import ffmpegStaticPath from "ffmpeg-static"
import type {
  HiggsfieldAccountStatus,
  HiggsfieldCliStatus,
  HiggsfieldCommandResult,
  HiggsfieldCommandOutputEvent,
  HiggsfieldCommandRun,
  HiggsfieldExecutableSource,
  HiggsfieldGeneratedArtifact,
  HiggsfieldGenerateRequest,
  HiggsfieldMediaKind,
  HiggsfieldModel,
  HiggsfieldModelDetails,
  HiggsfieldModelDetailsRequest,
  HiggsfieldModelListRequest,
  HiggsfieldOutputSize,
  HiggsfieldProductAction,
  HiggsfieldUploadAssetRequest,
  HiggsfieldWorkspaceContext,
  HiggsfieldWorkspaceStatus,
} from "@kreeyts/desktop-bridge"

import {
  bestArtifactExtension,
  parseAccountStatus,
  parseGenerationResult,
  parseModelDetails,
  parseModelList,
  parseWorkspaceContext,
} from "./higgsfield-output"
import { getKreeytsOutputRootSync } from "./local-store"

const GLOBAL_HIGGSFIELD_EXECUTABLE =
  process.platform === "win32" ? "higgsfield.cmd" : "higgsfield"
const VENDORED_HIGGSFIELD_EXECUTABLE =
  process.platform === "win32" ? "hf.exe" : "hf"
const requireFromHere = createRequire(import.meta.url)
const activeRuns = new Map<string, ChildProcessWithoutNullStreams>()
const queuedRuns: QueuedHiggsfieldCommand[] = []

interface ResolvedHiggsfieldExecutable {
  source: Exclude<HiggsfieldExecutableSource, "missing">
  command: string
  bundledVersion: string | null
  bundledDetail: string | null
}

interface BundledCliCandidate {
  packageVersion: string | null
  executablePath: string | null
  detail: string | null
}

interface HiggsfieldActionCommand {
  action: HiggsfieldProductAction
  title: string
  startMessage: string
  args: readonly string[]
  resultMediaKind?: HiggsfieldMediaKind
  outputDirectoryName?: string
  outputFileName?: string
  outputSize?: HiggsfieldOutputSize
}

interface CollectedCommand {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  error?: NodeJS.ErrnoException
  timedOut: boolean
}

interface QueuedHiggsfieldCommand {
  run: HiggsfieldCommandRun
  command: HiggsfieldActionCommand
  executable: ResolvedHiggsfieldExecutable
  emit: CommandOutputEmitter
}

type CommandOutputEmitter = (event: HiggsfieldCommandOutputEvent) => void

export async function getHiggsfieldCliStatus(): Promise<HiggsfieldCliStatus> {
  const executable = resolveHiggsfieldExecutable()
  const versionResult = await collectHiggsfieldOutput(
    executable,
    ["version"],
    5_000,
  )

  if (isMissingExecutable(versionResult.error)) {
    return missingCliStatus(executable.bundledVersion, executable.bundledDetail)
  }

  const fallbackVersionResult =
    versionResult.exitCode === 0
      ? null
      : await collectHiggsfieldOutput(executable, ["--version"], 5_000)
  const effectiveVersionResult =
    fallbackVersionResult?.exitCode === 0
      ? fallbackVersionResult
      : versionResult
  const version = firstMeaningfulLine(
    effectiveVersionResult.stdout,
    effectiveVersionResult.stderr,
  )

  const accountResult = await collectHiggsfieldOutput(
    executable,
    ["account", "status"],
    8_000,
  )
  const accountOutput = `${accountResult.stdout}\n${accountResult.stderr}`
  const authStatus =
    accountResult.exitCode === 0
      ? "authenticated"
      : looksUnauthenticated(accountOutput)
        ? "unauthenticated"
        : "unknown"

  const workspaceResult =
    authStatus === "authenticated"
      ? await collectHiggsfieldOutput(
          executable,
          ["workspace", "status"],
          8_000,
        )
      : null
  const workspaceStatus: HiggsfieldWorkspaceStatus =
    workspaceResult?.exitCode === 0 ? "verified" : "unknown"

  return {
    installed: true,
    version,
    executableSource: executable.source,
    bundledVersion: executable.bundledVersion,
    authStatus,
    workspaceStatus,
    detail: statusDetail(
      executable,
      effectiveVersionResult,
      accountResult,
      workspaceResult,
    ),
    checkedAt: new Date().toISOString(),
  }
}

export async function getHiggsfieldAccountStatus(): Promise<HiggsfieldAccountStatus> {
  const executable = resolveHiggsfieldExecutable()
  const result = await collectHiggsfieldOutput(
    executable,
    ["--json", "account", "status"],
    10_000,
  )

  ensureCommandSucceeded(result, "Check credits")
  return parseAccountStatus(result.stdout)
}

export async function getHiggsfieldWorkspaceContext(): Promise<HiggsfieldWorkspaceContext> {
  const executable = resolveHiggsfieldExecutable()
  const result = await collectHiggsfieldOutput(
    executable,
    ["--json", "workspace", "list"],
    10_000,
  )

  ensureCommandSucceeded(result, "Check workspace")
  return parseWorkspaceContext(result.stdout)
}

export async function getHiggsfieldModels(
  request: HiggsfieldModelListRequest | undefined,
): Promise<HiggsfieldModel[]> {
  const mediaKind = request?.mediaKind ?? "image"
  const args =
    mediaKind === "text"
      ? ["--json", "model", "list", "--text"]
      : ["--json", "model", "list", `--${mediaKind}`]
  const executable = resolveHiggsfieldExecutable()
  const result = await collectHiggsfieldOutput(executable, args, 15_000)

  ensureCommandSucceeded(result, "Load models")
  return parseModelList(result.stdout, mediaKind)
}

export async function getHiggsfieldModelDetails(
  request: HiggsfieldModelDetailsRequest,
): Promise<HiggsfieldModelDetails> {
  const model = normalizeModel(request.model)
  const mediaKind = request.mediaKind ?? "image"
  const executable = resolveHiggsfieldExecutable()
  const result = await collectHiggsfieldOutput(
    executable,
    ["--json", "model", "get", model],
    15_000,
  )

  ensureCommandSucceeded(result, "Load model details")
  return parseModelDetails(result.stdout, model, mediaKind)
}

export function startSignInCommand(emit: CommandOutputEmitter) {
  return startHiggsfieldCommand(
    {
      action: "sign-in",
      title: "Sign in",
      startMessage:
        "Opening Higgsfield sign in. Complete the browser prompt, then return to Kreeyts.",
      args: ["auth", "login"],
    },
    emit,
  )
}

export function startCheckCreditsCommand(emit: CommandOutputEmitter) {
  return startHiggsfieldCommand(
    {
      action: "check-credits",
      title: "Check credits",
      startMessage: "Checking your Higgsfield plan and credits.",
      args: ["account", "status"],
    },
    emit,
  )
}

export function startCheckWorkspaceCommand(emit: CommandOutputEmitter) {
  return startHiggsfieldCommand(
    {
      action: "check-workspace",
      title: "Check workspace",
      startMessage: "Checking the active Higgsfield workspace.",
      args: ["workspace", "status"],
    },
    emit,
  )
}

export function startListModelsCommand(
  request: HiggsfieldModelListRequest | undefined,
  emit: CommandOutputEmitter,
) {
  const mediaKind = request?.mediaKind ?? "image"
  const args =
    mediaKind === "text"
      ? ["model", "list", "--text"]
      : ["model", "list", `--${mediaKind}`]

  return startHiggsfieldCommand(
    {
      action: "list-models",
      title: "Choose model",
      startMessage: `Loading ${mediaKind} models from Higgsfield.`,
      args,
    },
    emit,
  )
}

export function startUploadAssetCommand(
  request: HiggsfieldUploadAssetRequest,
  emit: CommandOutputEmitter,
) {
  const filePath = normalizeFilePath(request.filePath)

  return startHiggsfieldCommand(
    {
      action: "upload-asset",
      title: "Upload asset",
      startMessage: `Uploading ${path.basename(filePath)} to Higgsfield.`,
      args: ["upload", "create", filePath],
    },
    emit,
  )
}

export function startGenerateCommand(
  request: HiggsfieldGenerateRequest,
  emit: CommandOutputEmitter,
) {
  const model = normalizeModel(request.model)
  const prompt = normalizePrompt(request.prompt)
  const mediaKind = request.mediaKind
  const args = ["--json", "generate", "create", model, "--prompt", prompt]

  if (request.aspectRatio?.trim()) {
    args.push("--aspect_ratio", normalizeAspectRatio(request.aspectRatio))
  }

  const assetPaths = [
    ...(request.assetPaths ?? []),
    ...(request.assetPath ? [request.assetPath] : []),
  ]
  for (const assetPath of assetPaths) {
    if (!assetPath.trim()) continue
    args.push(
      mediaFlagForKind(request.assetMediaKind ?? mediaKind),
      normalizeFilePath(assetPath),
    )
  }

  if (request.waitForResult !== false) {
    args.push("--wait")
  }

  return startHiggsfieldCommand(
    {
      action: "generate",
      title: "Generate",
      startMessage: "Sending your brief to Higgsfield.",
      args,
      resultMediaKind: mediaKind,
      outputDirectoryName: request.outputDirectoryName,
      outputFileName: request.outputFileName,
      outputSize: request.outputSize,
    },
    emit,
  )
}

export function cancelHiggsfieldCommand(runId: string): boolean {
  const child = activeRuns.get(runId)

  if (child) {
    child.kill()
    return true
  }

  const queuedIndex = queuedRuns.findIndex(
    (queued) => queued.run.runId === runId,
  )
  if (queuedIndex === -1) return false

  const [queued] = queuedRuns.splice(queuedIndex, 1)
  if (queued) {
    emitCommandOutput(
      queued.emit,
      queued.run.runId,
      "system",
      "Removed from the local queue.\n",
    )
    emitCommandOutput(queued.emit, queued.run.runId, "exit", "Stopped.\n", {
      exitCode: null,
      signal: "SIGTERM",
    })
  }
  return true
}

function startHiggsfieldCommand(
  command: HiggsfieldActionCommand,
  emit: CommandOutputEmitter,
): HiggsfieldCommandRun {
  const queued: QueuedHiggsfieldCommand = {
    executable: resolveHiggsfieldExecutable(),
    command,
    emit,
    run: {
      runId: randomUUID(),
      action: command.action,
      title: command.title,
      startedAt: new Date().toISOString(),
    },
  }

  if (shouldQueueCommand(command)) {
    queuedRuns.push(queued)
    emitCommandOutput(
      emit,
      queued.run.runId,
      "system",
      "Queued locally. Kreeyts will start this when a generation slot is free.\n",
    )
    drainHiggsfieldQueue()
  } else {
    startQueuedHiggsfieldCommand(queued)
  }

  return queued.run
}

function shouldQueueCommand(command: HiggsfieldActionCommand) {
  return (
    command.action === "generate" &&
    (queuedRuns.length > 0 || activeRuns.size >= maxConcurrentHiggsfieldRuns())
  )
}

function drainHiggsfieldQueue() {
  while (
    queuedRuns.length > 0 &&
    activeRuns.size < maxConcurrentHiggsfieldRuns()
  ) {
    const queued = queuedRuns.shift()
    if (queued) startQueuedHiggsfieldCommand(queued)
  }
}

function startQueuedHiggsfieldCommand(queued: QueuedHiggsfieldCommand) {
  const { command, emit, executable, run } = queued
  emitCommandOutput(emit, run.runId, "system", `${command.startMessage}\n`)

  const child = spawn(executable.command, command.args, {
    env: higgsfieldEnvironment(executable),
    windowsHide: true,
  })
  let stdout = ""

  activeRuns.set(run.runId, child)
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")

  child.stdout.on("data", (chunk: string) => {
    stdout += chunk
    emitCommandOutput(emit, run.runId, "stdout", chunk)
  })

  child.stderr.on("data", (chunk: string) => {
    emitCommandOutput(emit, run.runId, "stderr", chunk)
  })

  child.on("error", (error: NodeJS.ErrnoException) => {
    const text = isMissingExecutable(error)
      ? "Higgsfield is not available. Reinstall Kreeyts, or use the global Higgsfield CLI as a temporary fallback.\n"
      : `${error.message}\n`
    emitCommandOutput(emit, run.runId, "system", text)
  })

  child.on("close", async (exitCode, signal) => {
    activeRuns.delete(run.runId)
    if (!signal && exitCode === 0 && command.resultMediaKind) {
      await emitGenerationResult(run.runId, command, stdout, emit)
    }

    emitCommandOutput(emit, run.runId, "exit", exitText(exitCode, signal), {
      exitCode,
      signal,
    })
    drainHiggsfieldQueue()
  })
}

function collectHiggsfieldOutput(
  executable: ResolvedHiggsfieldExecutable,
  args: readonly string[],
  timeoutMs: number,
) {
  return collectProcessOutput(
    executable.command,
    args,
    timeoutMs,
    higgsfieldEnvironment(executable),
  )
}

function collectProcessOutput(
  command: string,
  args: readonly string[],
  timeoutMs: number,
  env = process.env,
) {
  return new Promise<CollectedCommand>((resolve) => {
    const child = spawn(command, args, {
      env,
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    let resolved = false
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      child.kill()
    }, timeoutMs)

    const finish = (
      result: Omit<CollectedCommand, "stdout" | "stderr" | "timedOut">,
    ) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      resolve({
        ...result,
        stdout,
        stderr,
        timedOut,
      })
    }

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
    })

    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({ exitCode: null, signal: null, error })
    })

    child.on("close", (exitCode, signal) => {
      finish({ exitCode, signal })
    })
  })
}

async function emitGenerationResult(
  runId: string,
  command: HiggsfieldActionCommand,
  stdout: string,
  emit: CommandOutputEmitter,
) {
  if (!command.resultMediaKind) return

  const parsed = parseGenerationResult(stdout, command.resultMediaKind)
  if (!parsed) return

  const result = await saveGeneratedArtifacts(parsed, command)
  emitCommandOutput(emit, runId, "result", "Generation finished.\n", { result })
}

async function saveGeneratedArtifacts(
  result: HiggsfieldCommandResult,
  command: HiggsfieldActionCommand,
): Promise<HiggsfieldCommandResult> {
  if (!command.outputDirectoryName && !command.outputFileName) return result

  const outputDirectory = path.join(
    getKreeytsOutputRootSync(),
    safePathPart(command.outputDirectoryName ?? dateSlug()),
  )
  await mkdir(outputDirectory, { recursive: true })

  const artifacts: HiggsfieldGeneratedArtifact[] = []

  for (const [index, artifact] of result.artifacts.entries()) {
    try {
      const extension = bestArtifactExtension(
        artifact,
        command.resultMediaKind ?? "image",
      )
      const fileName = safeOutputFileName(
        command.outputFileName ?? `generation-${index + 1}${extension}`,
        extension,
        index,
      )
      const filePath = path.join(outputDirectory, fileName)
      const savedPath = await saveArtifactToPath(artifact, filePath, command)
      artifacts.push({ ...artifact, filePath: savedPath ?? artifact.filePath })
    } catch {
      artifacts.push(artifact)
    }
  }

  return { artifacts }
}

async function saveArtifactToPath(
  artifact: HiggsfieldGeneratedArtifact,
  targetPath: string,
  command: HiggsfieldActionCommand,
) {
  if (artifact.filePath && existsSync(artifact.filePath)) {
    if (artifact.filePath !== targetPath) {
      await copyFile(artifact.filePath, targetPath)
    }
    await postProcessArtifact(targetPath, command)
    return targetPath
  }

  if (!artifact.url) return null

  const response = await fetch(artifact.url)
  if (!response.ok) return null

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(targetPath, buffer)
  await postProcessArtifact(targetPath, command)
  return targetPath
}

async function postProcessArtifact(
  targetPath: string,
  command: HiggsfieldActionCommand,
) {
  if (!command.outputSize) return

  if (command.resultMediaKind === "image") {
    await writeFile(
      targetPath,
      normalizeImageToExactSize(targetPath, command.outputSize),
    )
    return
  }

  if (command.resultMediaKind === "video") {
    await normalizeVideoToExactSize(targetPath, command.outputSize)
  }
}

function normalizeImageToExactSize(
  imagePath: string,
  target: HiggsfieldOutputSize,
) {
  const image = nativeImage.createFromPath(imagePath)

  if (image.isEmpty()) {
    throw new Error("Generated image could not be opened for sizing.")
  }

  const size = image.getSize()
  const sourceRatio = size.width / size.height
  const targetRatio = target.width / target.height
  const crop =
    sourceRatio > targetRatio
      ? {
          x: Math.floor((size.width - size.height * targetRatio) / 2),
          y: 0,
          width: Math.floor(size.height * targetRatio),
          height: size.height,
        }
      : {
          x: 0,
          y: Math.floor((size.height - size.width / targetRatio) / 2),
          width: size.width,
          height: Math.floor(size.width / targetRatio),
        }

  return image
    .crop(crop)
    .resize({
      width: target.width,
      height: target.height,
      quality: "best",
    })
    .toPNG()
}

async function normalizeVideoToExactSize(
  videoPath: string,
  target: HiggsfieldOutputSize,
) {
  const ffmpegPath = resolveFfmpegExecutable()
  const tempPath = `${videoPath}.${process.pid}.${Date.now()}.tmp.mp4`
  const result = await collectProcessOutput(
    ffmpegPath,
    [
      "-y",
      "-i",
      videoPath,
      "-vf",
      `scale=${target.width}:${target.height}:force_original_aspect_ratio=increase,crop=${target.width}:${target.height}`,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "copy",
      tempPath,
    ],
    15 * 60_000,
  )

  if (result.exitCode !== 0) {
    await unlink(tempPath).catch(() => undefined)
    throw new Error("Generated video could not be prepared at the target size.")
  }

  await rename(tempPath, videoPath)
}

function resolveFfmpegExecutable() {
  if (!ffmpegStaticPath) {
    throw new Error("The bundled video processor is not available.")
  }

  return asUnpackedPath(ffmpegStaticPath)
}

function resolveHiggsfieldExecutable(): ResolvedHiggsfieldExecutable {
  const bundled = resolveBundledCliCandidate()

  if (bundled.executablePath) {
    return {
      source: "bundled",
      command: bundled.executablePath,
      bundledVersion: bundled.packageVersion,
      bundledDetail: null,
    }
  }

  return {
    source: "global",
    command: GLOBAL_HIGGSFIELD_EXECUTABLE,
    bundledVersion: bundled.packageVersion,
    bundledDetail: bundled.detail,
  }
}

function resolveBundledCliCandidate(): BundledCliCandidate {
  try {
    const packageJsonPath = requireFromHere.resolve(
      "@higgsfield/cli/package.json",
    )
    const packageRoot = path.dirname(packageJsonPath)
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      version?: string
    }
    const vendorPath = asUnpackedPath(
      path.join(packageRoot, "vendor", VENDORED_HIGGSFIELD_EXECUTABLE),
    )

    if (existsSync(vendorPath)) {
      return {
        packageVersion: packageJson.version ?? null,
        executablePath: vendorPath,
        detail: null,
      }
    }

    return {
      packageVersion: packageJson.version ?? null,
      executablePath: null,
      detail:
        "The bundled Higgsfield engine is present, but its native executable is missing.",
    }
  } catch {
    return {
      packageVersion: null,
      executablePath: null,
      detail: "The bundled Higgsfield CLI package was not found.",
    }
  }
}

function asUnpackedPath(filePath: string) {
  const asarSegment = `${path.sep}app.asar${path.sep}`
  if (!filePath.includes(asarSegment)) return filePath
  return filePath.replace(
    asarSegment,
    `${path.sep}app.asar.unpacked${path.sep}`,
  )
}

function maxConcurrentHiggsfieldRuns() {
  const configured = Number(process.env.KREEYTS_MAX_HIGGSFIELD_RUNS)
  if (Number.isInteger(configured) && configured > 0) return configured
  return 3
}

function higgsfieldEnvironment(executable: ResolvedHiggsfieldExecutable) {
  return {
    ...process.env,
    XDG_CONFIG_HOME: ensureHiggsfieldConfigHome(),
    HIGGSFIELD_INSTALL_METHOD:
      executable.source === "bundled" ? "kreeyts" : "global",
    HIGGSFIELD_PACKAGE_MANAGER: "bun",
  }
}

function ensureHiggsfieldConfigHome() {
  const configHome = path.join(app.getPath("userData"), "higgsfield-cli-config")
  const credentialsPath = path.join(
    configHome,
    "higgsfield",
    "credentials.json",
  )

  if (!existsSync(credentialsPath)) {
    const legacyCredentialsPath = path.join(
      process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
      "higgsfield",
      "credentials.json",
    )

    if (
      legacyCredentialsPath !== credentialsPath &&
      existsSync(legacyCredentialsPath)
    ) {
      mkdirSync(path.dirname(credentialsPath), { recursive: true })
      copyFileSync(legacyCredentialsPath, credentialsPath)
    }
  }

  return configHome
}

function missingCliStatus(
  bundledVersion: string | null,
  bundledDetail: string | null,
): HiggsfieldCliStatus {
  return {
    installed: false,
    version: null,
    executableSource: "missing",
    bundledVersion,
    authStatus: "unknown",
    workspaceStatus: "unknown",
    detail:
      bundledDetail ??
      "Higgsfield is not available. Reinstall Kreeyts or contact support.",
    checkedAt: new Date().toISOString(),
  }
}

function normalizeModel(value: string) {
  const model = value.trim()

  if (!model) {
    throw new Error("Choose a Higgsfield model before generating.")
  }

  if (!/^[a-zA-Z0-9_.:-]+$/.test(model)) {
    throw new Error("Use a model name from the Higgsfield model list.")
  }

  return model
}

function normalizePrompt(value: string) {
  const prompt = value.trim()

  if (!prompt) {
    throw new Error("Write a prompt before generating.")
  }

  return prompt
}

function normalizeAspectRatio(value: string) {
  const aspectRatio = value.trim()

  if (!/^[0-9]+(?:\.[0-9]+)?:[0-9]+(?:\.[0-9]+)?$/.test(aspectRatio)) {
    throw new Error("Use an aspect ratio from the picker before generating.")
  }

  return aspectRatio
}

function normalizeFilePath(value: string) {
  const filePath = value.trim()

  if (!filePath) {
    throw new Error("Choose an asset before continuing.")
  }

  if (!existsSync(filePath)) {
    throw new Error("The selected asset is no longer available.")
  }

  return filePath
}

function mediaFlagForKind(mediaKind: HiggsfieldMediaKind) {
  if (mediaKind === "video") return "--video"
  if (mediaKind === "audio") return "--audio"
  return "--image"
}

function ensureCommandSucceeded(result: CollectedCommand, title: string) {
  if (isMissingExecutable(result.error)) {
    throw new Error(
      "Higgsfield is not available. Reinstall Kreeyts, or sign in through the Higgsfield CLI.",
    )
  }

  if (result.exitCode === 0) return

  if (looksUnauthenticated(`${result.stdout}\n${result.stderr}`)) {
    throw new Error("Sign in to Higgsfield before continuing.")
  }

  if (result.timedOut) {
    throw new Error(`${title} timed out. Try again in a moment.`)
  }

  const detail = firstMeaningfulLine(result.stderr, result.stdout)
  throw new Error(detail ?? `${title} failed. Try again in a moment.`)
}

function safePathPart(value: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return safe || dateSlug()
}

function safeOutputFileName(value: string, extension: string, index: number) {
  const parsed = path.parse(value.trim())
  const base = safePathPart(parsed.name || `generation-${index + 1}`)
  const suffix = index > 0 ? `-${index + 1}` : ""
  const ext = parsed.ext || extension

  return `${base}${suffix}${ext}`
}

function dateSlug() {
  return new Date().toISOString().slice(0, 10)
}

function firstMeaningfulLine(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const line = value
      ?.split(/\r?\n/)
      .map((part) => part.trim())
      .find(Boolean)

    if (line) return line
  }

  return null
}

function statusDetail(
  executable: ResolvedHiggsfieldExecutable,
  versionResult: CollectedCommand,
  accountResult: CollectedCommand,
  workspaceResult: CollectedCommand | null,
) {
  const fallbackDetail =
    executable.source === "global" && executable.bundledDetail
      ? `${executable.bundledDetail} Using the global Higgsfield fallback.`
      : null

  if (accountResult.exitCode === 0) {
    if (workspaceResult?.exitCode === 0) return fallbackDetail

    const workspaceDetail = firstMeaningfulLine(
      workspaceResult?.stderr,
      workspaceResult?.stdout,
    )
    return workspaceDetail ?? fallbackDetail
  }

  if (
    looksUnauthenticated(`${accountResult.stdout}\n${accountResult.stderr}`)
  ) {
    return "Sign in to connect your Higgsfield account."
  }

  const accountDetail = firstMeaningfulLine(
    accountResult.stderr,
    accountResult.stdout,
  )
  if (accountDetail) return accountDetail

  if (accountResult.timedOut)
    return "Timed out while checking your Higgsfield account."

  const installDetail = firstMeaningfulLine(
    versionResult.stderr,
    versionResult.stdout,
  )
  return installDetail ?? fallbackDetail
}

function looksUnauthenticated(output: string) {
  return /\b(auth|authenticate|login|sign in|not authenticated|unauthorized|token)\b/i.test(
    output,
  )
}

function isMissingExecutable(error: NodeJS.ErrnoException | undefined) {
  return error?.code === "ENOENT"
}

function emitCommandOutput(
  emit: CommandOutputEmitter,
  runId: string,
  kind: HiggsfieldCommandOutputEvent["kind"],
  text: string,
  extras: Partial<
    Pick<HiggsfieldCommandOutputEvent, "exitCode" | "signal" | "result">
  > = {},
) {
  emit({
    runId,
    kind,
    text,
    timestamp: new Date().toISOString(),
    ...extras,
  })
}

function exitText(exitCode: number | null, signal: NodeJS.Signals | null) {
  if (signal) return "Stopped.\n"
  if (exitCode === 0) return "Finished.\n"
  return "Higgsfield stopped with an error. Check the messages above and try again.\n"
}
