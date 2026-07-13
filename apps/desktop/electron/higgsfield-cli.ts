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
  HiggsfieldOutputCrop,
  HiggsfieldOutputSize,
  HiggsfieldProductAction,
  HiggsfieldSetWorkspaceRequest,
  HiggsfieldUploadedAsset,
  HiggsfieldUploadAssetRequest,
  HiggsfieldUploadListRequest,
  HiggsfieldUploadListResult,
  HiggsfieldUploadMediaKind,
  HiggsfieldWorkspaceContext,
  HiggsfieldWorkspaceStatus,
} from "@assetwell/desktop-bridge"

import { detectBannerContentBand } from "./banner-band"
import {
  bestArtifactExtension,
  parseAccountStatus,
  parseGenerationResult,
  parseModelDetails,
  parseModelList,
  parseUpload,
  parseUploadList,
  parseWorkspaceContext,
} from "./higgsfield-output"
import { getAssetwellOutputRootSync } from "./local-store"
import {
  applyUploadNames,
  loadUploadNames,
  recordUploadName,
} from "./upload-name-store"

const GLOBAL_HIGGSFIELD_EXECUTABLE =
  process.platform === "win32" ? "higgsfield.cmd" : "higgsfield"
const VENDORED_HIGGSFIELD_EXECUTABLE =
  process.platform === "win32" ? "hf.exe" : "hf"
const requireFromHere = createRequire(import.meta.url)
const activeRuns = new Map<string, ChildProcessWithoutNullStreams>()
const preparingRuns = new Map<string, ChildProcessWithoutNullStreams>()
const cancelledPreparingRuns = new Set<string>()
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

interface ProtectedSourceComposition {
  argIndex: number
  sourcePath: string
  nativeAspectRatio: string
  target: HiggsfieldOutputSize
}

interface HiggsfieldActionCommand {
  action: HiggsfieldProductAction
  title: string
  startMessage: string
  args: readonly string[]
  resultMediaKind?: HiggsfieldMediaKind
  uploadWorkspaceId?: string
  outputDirectoryName?: string
  outputFileName?: string
  outputSize?: HiggsfieldOutputSize
  outputCrop?: HiggsfieldOutputCrop
  protectedSource?: ProtectedSourceComposition
  temporarySourcePath?: string
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

  const authResult = await collectHiggsfieldOutput(
    executable,
    ["auth", "token"],
    5_000,
  )
  const authStatus =
    authResult.exitCode === 0 &&
    firstMeaningfulLine(authResult.stdout, authResult.stderr)
      ? "authenticated"
      : authResult.timedOut
        ? "unknown"
        : "unauthenticated"

  const workspaceResult =
    authStatus === "authenticated"
      ? await ensureHiggsfieldWorkspaceSelected(executable)
      : null
  const workspaceStatus: HiggsfieldWorkspaceStatus =
    workspaceResult?.exitCode === 0 &&
    !looksWorkspaceUnselected(workspaceResult)
      ? "verified"
      : "unknown"

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
      authResult,
      workspaceResult,
    ),
    checkedAt: new Date().toISOString(),
  }
}

export async function getHiggsfieldAccountStatus(): Promise<HiggsfieldAccountStatus> {
  const executable = resolveHiggsfieldExecutable()
  const workspaceResult = await ensureHiggsfieldWorkspaceSelected(executable)
  ensureWorkspaceReady(workspaceResult, "Check workspace")

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
  const workspaceResult = await ensureHiggsfieldWorkspaceSelected(executable)
  ensureWorkspaceReady(workspaceResult, "Check workspace")

  const result = await collectHiggsfieldOutput(
    executable,
    ["--json", "workspace", "list"],
    10_000,
  )

  ensureCommandSucceeded(result, "Check workspace")
  return parseWorkspaceContext(result.stdout)
}

export async function setHiggsfieldWorkspace(
  request: HiggsfieldSetWorkspaceRequest,
): Promise<HiggsfieldWorkspaceContext> {
  const workspaceId = normalizeWorkspaceId(request.id)
  const executable = resolveHiggsfieldExecutable()
  const result = await collectHiggsfieldOutput(
    executable,
    ["workspace", "set", workspaceId],
    10_000,
  )

  ensureCommandSucceeded(result, "Switch workspace")
  return getHiggsfieldWorkspaceContext()
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

export async function getHiggsfieldUploads(
  request: HiggsfieldUploadListRequest | undefined,
): Promise<HiggsfieldUploadListResult> {
  const mediaKind = normalizeUploadMediaKind(request?.mediaKind ?? "image")
  const size = normalizeUploadListSize(request?.size ?? 100)
  const cursor = normalizeOptionalCursor(request?.cursor)
  const executable = resolveHiggsfieldExecutable()
  const workspaceResult = await ensureHiggsfieldWorkspaceSelected(executable)
  ensureWorkspaceReady(workspaceResult, "Load uploads")

  const args = ["--json", "upload", "list", `--${mediaKind}`, "--size", size]
  if (cursor) args.push("--cursor", cursor)

  const result = await collectHiggsfieldOutput(executable, args, 20_000)

  ensureCommandSucceeded(result, "Load uploads")
  const uploads = parseUploadList(result.stdout, mediaKind)
  const uploadNames = await loadUploadNames()
  return { ...uploads, items: applyUploadNames(uploads.items, uploadNames) }
}

export async function createHiggsfieldUpload(
  request: HiggsfieldUploadAssetRequest,
): Promise<HiggsfieldUploadedAsset> {
  const filePath = normalizeFilePath(request.filePath)
  const mediaKind = inferUploadMediaKind(filePath)
  const executable = resolveHiggsfieldExecutable()
  const workspaceResult = await ensureHiggsfieldWorkspaceSelected(executable)
  ensureWorkspaceReady(workspaceResult, "Upload asset")

  const result = await collectHiggsfieldOutput(
    executable,
    ["--json", "upload", "create", filePath],
    120_000,
  )

  ensureCommandSucceeded(result, "Upload asset")
  const asset = parseUpload(result.stdout, mediaKind)
  const uploadedName = await recordUploadName(
    asset.uploadId,
    path.basename(filePath),
  )
  return uploadedName ? { ...asset, name: uploadedName } : asset
}

export function startSignInCommand(emit: CommandOutputEmitter) {
  return startHiggsfieldCommand(
    {
      action: "sign-in",
      title: "Sign in",
      startMessage:
        "Opening Higgsfield sign in. Complete the browser prompt, then return to Assetwell.",
      args: ["auth", "login"],
    },
    emit,
  )
}

export function startSignOutCommand(emit: CommandOutputEmitter) {
  return startHiggsfieldCommand(
    {
      action: "sign-out",
      title: "Sign out",
      startMessage: "Signing out of Higgsfield.",
      args: ["auth", "logout"],
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

  const aspectRatio = request.aspectRatio?.trim()
    ? normalizeAspectRatio(request.aspectRatio)
    : undefined
  if (aspectRatio) {
    args.push("--aspect_ratio", aspectRatio)
  }

  if (mediaKind === "video" && request.durationSeconds !== undefined) {
    args.push("--duration", normalizeDurationSeconds(request.durationSeconds))
  }
  if (mediaKind === "video" && request.videoQuality !== undefined) {
    args.push("--mode", normalizeVideoQuality(request.videoQuality))
  }
  if (mediaKind === "video" && request.videoSound !== undefined) {
    args.push("--sound", normalizeVideoSound(request.videoSound))
  }

  const assetPaths = [
    ...(request.assetPaths ?? []),
    ...(request.assetPath ? [request.assetPath] : []),
  ]
  let protectedSource: ProtectedSourceComposition | undefined
  for (const assetPath of assetPaths) {
    if (!assetPath.trim()) continue
    const mediaReference = normalizeMediaReference(assetPath)
    const argIndex = args.length + 1
    args.push(
      mediaFlagForKind(request.assetMediaKind ?? mediaKind),
      mediaReference,
    )

    if (
      !protectedSource &&
      request.protectSourceComposition &&
      mediaKind === "video" &&
      request.assetMediaKind === "image" &&
      aspectRatio &&
      request.outputSize &&
      existsSync(mediaReference) &&
      needsProtectedSourceComposition(
        mediaReference,
        aspectRatio,
        request.outputSize,
      )
    ) {
      protectedSource = {
        argIndex,
        sourcePath: mediaReference,
        nativeAspectRatio: aspectRatio,
        target: request.outputSize,
      }
    }
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
      uploadWorkspaceId: request.uploadWorkspaceId,
      outputDirectoryName: request.outputDirectoryName,
      outputFileName: request.outputFileName,
      outputSize: request.outputSize,
      outputCrop: request.outputCrop,
      protectedSource,
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

  const preparingChild = preparingRuns.get(runId)
  if (preparingChild) {
    cancelledPreparingRuns.add(runId)
    preparingChild.kill()
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
      "Queued locally. Assetwell will start this when a generation slot is free.\n",
    )
    drainHiggsfieldQueue()
  } else {
    startQueuedHiggsfieldCommand(queued)
  }

  return queued.run
}

function runningHiggsfieldRunCount() {
  return activeRuns.size + preparingRuns.size
}

function shouldQueueCommand(command: HiggsfieldActionCommand) {
  return (
    command.action === "generate" &&
    (queuedRuns.length > 0 ||
      runningHiggsfieldRunCount() >= maxConcurrentHiggsfieldRuns())
  )
}

function drainHiggsfieldQueue() {
  while (
    queuedRuns.length > 0 &&
    runningHiggsfieldRunCount() < maxConcurrentHiggsfieldRuns()
  ) {
    const queued = queuedRuns.shift()
    if (queued) startQueuedHiggsfieldCommand(queued)
  }
}

function startQueuedHiggsfieldCommand(queued: QueuedHiggsfieldCommand) {
  const { command, emit, run } = queued
  emitCommandOutput(emit, run.runId, "system", `${command.startMessage}\n`)

  if (command.protectedSource) {
    void prepareAndStartHiggsfieldCommand(queued)
    return
  }

  spawnQueuedHiggsfieldCommand(queued)
}

async function prepareAndStartHiggsfieldCommand(
  queued: QueuedHiggsfieldCommand,
) {
  const { command, emit, run } = queued

  try {
    emitCommandOutput(
      emit,
      run.runId,
      "system",
      "Protecting the source framing for this size.\n",
    )
    const temporarySourcePath = await prepareProtectedSourceComposition(
      command.protectedSource!,
      run.runId,
      (child) => preparingRuns.set(run.runId, child),
    )
    preparingRuns.delete(run.runId)

    if (cancelledPreparingRuns.delete(run.runId)) {
      await unlink(temporarySourcePath).catch(() => undefined)
      emitCommandOutput(emit, run.runId, "system", "Stopped.\n")
      emitCommandOutput(emit, run.runId, "exit", "Stopped.\n", {
        exitCode: null,
        signal: "SIGTERM",
      })
      drainHiggsfieldQueue()
      return
    }

    const args = [...command.args]
    args[command.protectedSource!.argIndex] = temporarySourcePath
    command.args = args
    command.temporarySourcePath = temporarySourcePath
    command.protectedSource = undefined
    spawnQueuedHiggsfieldCommand(queued)
  } catch {
    preparingRuns.delete(run.runId)
    const wasCancelled = cancelledPreparingRuns.delete(run.runId)
    emitCommandOutput(
      emit,
      run.runId,
      "system",
      wasCancelled
        ? "Stopped.\n"
        : "The source image could not be prepared for protected framing.\n",
    )
    emitCommandOutput(
      emit,
      run.runId,
      "exit",
      wasCancelled ? "Stopped.\n" : "Generation failed.\n",
      {
        exitCode: wasCancelled ? null : 1,
        signal: wasCancelled ? "SIGTERM" : null,
      },
    )
    drainHiggsfieldQueue()
  }
}

function spawnQueuedHiggsfieldCommand(queued: QueuedHiggsfieldCommand) {
  const { command, emit, executable, run } = queued
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
      ? "Higgsfield is not available. Reinstall Assetwell, or use the global Higgsfield CLI as a temporary fallback.\n"
      : `${error.message}\n`
    emitCommandOutput(emit, run.runId, "system", text)
  })

  child.on("close", async (exitCode, signal) => {
    activeRuns.delete(run.runId)
    if (!signal && exitCode === 0 && command.resultMediaKind) {
      await emitGenerationResult(run.runId, command, stdout, emit)
    }
    if (command.temporarySourcePath) {
      await unlink(command.temporarySourcePath).catch(() => undefined)
    }

    emitCommandOutput(emit, run.runId, "exit", exitText(exitCode, signal), {
      exitCode,
      signal,
    })
    drainHiggsfieldQueue()
  })
}

async function ensureHiggsfieldWorkspaceSelected(
  executable: ResolvedHiggsfieldExecutable,
): Promise<CollectedCommand> {
  const statusResult = await collectHiggsfieldOutput(
    executable,
    ["workspace", "status"],
    8_000,
  )

  if (!looksWorkspaceUnselected(statusResult)) return statusResult

  // The Higgsfield CLI currently prints "No workspace selected." with a
  // successful exit code, so inspect output before trusting exit status.
  const listResult = await collectHiggsfieldOutput(
    executable,
    ["--json", "workspace", "list"],
    10_000,
  )
  if (listResult.exitCode !== 0) return statusResult

  const workspace = defaultHiggsfieldWorkspace(listResult.stdout)
  if (!workspace) return statusResult

  const setResult = await collectHiggsfieldOutput(
    executable,
    ["workspace", "set", workspace.id],
    10_000,
  )
  if (setResult.exitCode !== 0) return statusResult

  return collectHiggsfieldOutput(executable, ["workspace", "status"], 8_000)
}

function defaultHiggsfieldWorkspace(stdout: string) {
  const context = parseWorkspaceContext(stdout)
  const workspacesByCredits = [...context.workspaces].sort(
    (left, right) => (right.credits ?? 0) - (left.credits ?? 0),
  )

  return context.selected ?? workspacesByCredits[0] ?? null
}

function ensureWorkspaceReady(result: CollectedCommand, action: string) {
  ensureCommandSucceeded(result, action)
  if (looksWorkspaceUnselected(result)) {
    throw new Error("No Higgsfield workspace is selected.")
  }
}

function looksWorkspaceUnselected(result: CollectedCommand) {
  return /\bno workspace selected\b/i.test(`${result.stdout}\n${result.stderr}`)
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
  onSpawn?: (child: ChildProcessWithoutNullStreams) => void,
) {
  return new Promise<CollectedCommand>((resolve) => {
    const child = spawn(command, args, {
      env,
      windowsHide: true,
    })
    onSpawn?.(child)
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
    commandOutputRoot(command),
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

function commandOutputRoot(command: HiggsfieldActionCommand) {
  if (!command.uploadWorkspaceId) return getAssetwellOutputRootSync()

  return path.join(
    getAssetwellOutputRootSync(),
    "Outputs",
    safePathPart(command.uploadWorkspaceId),
  )
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

function needsProtectedSourceComposition(
  sourcePath: string,
  nativeAspectRatio: string,
  target: HiggsfieldOutputSize,
) {
  const image = nativeImage.createFromPath(sourcePath)
  if (image.isEmpty()) return true

  const size = image.getSize()
  if (size.width <= 0 || size.height <= 0) return true

  const sourceRatio = size.width / size.height
  const targetRatio = target.width / target.height
  const nativeRatio = aspectRatioValue(nativeAspectRatio)
  return (
    Math.abs(Math.log(sourceRatio / targetRatio)) >= 0.005 ||
    Math.abs(Math.log(targetRatio / nativeRatio)) >= 0.005
  )
}

async function prepareProtectedSourceComposition(
  source: ProtectedSourceComposition,
  runId: string,
  onSpawn: (child: ChildProcessWithoutNullStreams) => void,
) {
  const nativeRatio = aspectRatioValue(source.nativeAspectRatio)
  const targetRatio = source.target.width / source.target.height
  const canvas = protectedSourceCanvas(nativeRatio, targetRatio)
  const ffmpegPath = resolveFfmpegExecutable()
  const outputPath = path.join(
    os.tmpdir(),
    `assetwell-protected-source-${runId}.png`,
  )
  const filter =
    `[0:v]scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=increase,` +
    `crop=${canvas.width}:${canvas.height},gblur=sigma=24[bg];` +
    `[0:v]scale=${canvas.safeWidth}:${canvas.safeHeight}:force_original_aspect_ratio=decrease[fg];` +
    `[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto[out]`
  const result = await collectProcessOutput(
    ffmpegPath,
    [
      "-y",
      "-i",
      source.sourcePath,
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-frames:v",
      "1",
      outputPath,
    ],
    60_000,
    process.env,
    onSpawn,
  )

  if (result.exitCode !== 0) {
    await unlink(outputPath).catch(() => undefined)
    throw new Error("The source image could not be prepared.")
  }

  return outputPath
}

function protectedSourceCanvas(nativeRatio: number, targetRatio: number) {
  const maxEdge = 1280
  const width = evenDimension(
    nativeRatio >= 1 ? maxEdge : maxEdge * nativeRatio,
  )
  const height = evenDimension(
    nativeRatio >= 1 ? maxEdge / nativeRatio : maxEdge,
  )
  const safeWidth = evenDimension(
    targetRatio >= nativeRatio ? width : height * targetRatio,
  )
  const safeHeight = evenDimension(
    targetRatio >= nativeRatio ? width / targetRatio : height,
  )

  return {
    width,
    height,
    safeWidth: Math.min(width, safeWidth),
    safeHeight: Math.min(height, safeHeight),
  }
}

function evenDimension(value: number) {
  return Math.max(2, Math.round(value / 2) * 2)
}

function aspectRatioValue(aspectRatio: string) {
  const match = aspectRatio.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) throw new Error("The model returned an invalid aspect ratio.")

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    throw new Error("The model returned an invalid aspect ratio.")
  }

  return width / height
}

async function postProcessArtifact(
  targetPath: string,
  command: HiggsfieldActionCommand,
) {
  if (!command.outputSize) return

  if (command.resultMediaKind === "image") {
    await writeFile(
      targetPath,
      normalizeImageToExactSize(
        targetPath,
        command.outputSize,
        command.outputCrop,
      ),
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
  outputCrop: HiggsfieldOutputCrop = "center",
) {
  let image = nativeImage.createFromPath(imagePath)

  if (image.isEmpty()) {
    throw new Error("Generated image could not be opened for sizing.")
  }

  if (outputCrop === "band") {
    image = cropToBannerContentBand(image)
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
          y:
            outputCrop === "top"
              ? 0
              : Math.floor((size.height - size.width / targetRatio) / 2),
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

function cropToBannerContentBand(image: Electron.NativeImage) {
  const size = image.getSize()
  const band = detectBannerContentBand(
    size.width,
    size.height,
    image.toBitmap(),
  )
  if (!band) return image

  return image.crop({
    x: 0,
    y: band.top,
    width: size.width,
    height: band.bottom - band.top,
  })
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
  const configured = Number(process.env.ASSETWELL_MAX_HIGGSFIELD_RUNS)
  if (Number.isInteger(configured) && configured > 0) return configured
  return 3
}

function higgsfieldEnvironment(executable: ResolvedHiggsfieldExecutable) {
  return {
    ...process.env,
    XDG_CONFIG_HOME: ensureHiggsfieldConfigHome(),
    HIGGSFIELD_INSTALL_METHOD:
      executable.source === "bundled" ? "assetwell" : "global",
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
      "Higgsfield is not available. Reinstall Assetwell or contact support.",
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

function normalizeWorkspaceId(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Choose a Higgsfield workspace before continuing.")
  }

  const workspaceId = value.trim()
  if (!workspaceId) {
    throw new Error("Choose a Higgsfield workspace before continuing.")
  }

  return workspaceId
}

function normalizeUploadMediaKind(value: unknown): HiggsfieldUploadMediaKind {
  if (value === "image" || value === "video" || value === "audio") {
    return value
  }

  return "image"
}

function normalizeUploadListSize(value: unknown) {
  const size = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(size) || size < 1 || size > 500) {
    throw new Error("Choose between 1 and 500 uploads to load.")
  }

  return `${size}`
}

function normalizeOptionalCursor(value: unknown) {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return null

  const cursor = value.trim()
  return cursor || null
}

function inferUploadMediaKind(filePath: string): HiggsfieldUploadMediaKind {
  const extension = path.extname(filePath).toLowerCase()
  if ([".mp4", ".mov", ".webm", ".m4v"].includes(extension)) {
    return "video"
  }
  if ([".mp3", ".wav", ".m4a", ".aac", ".flac"].includes(extension)) {
    return "audio"
  }

  return "image"
}

function normalizeAspectRatio(value: string) {
  const aspectRatio = value.trim()

  if (!/^[0-9]+(?:\.[0-9]+)?:[0-9]+(?:\.[0-9]+)?$/.test(aspectRatio)) {
    throw new Error("Use an aspect ratio from the picker before generating.")
  }

  return aspectRatio
}

function normalizeDurationSeconds(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 60
  ) {
    throw new Error("Use a whole-second video duration between 1 and 60.")
  }

  return `${value}`
}

function normalizeVideoQuality(value: unknown) {
  const values = {
    standard: "std",
    pro: "pro",
    "4k": "4k",
  } as const

  if (typeof value !== "string" || !(value in values)) {
    throw new Error("Use a supported video quality before generating.")
  }

  return values[value as keyof typeof values]
}

function normalizeVideoSound(value: unknown) {
  if (typeof value !== "boolean") {
    throw new Error("Choose whether the generated video should include sound.")
  }

  return value ? "on" : "off"
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

function normalizeMediaReference(value: string) {
  const reference = value.trim()

  if (!reference) {
    throw new Error("Choose an asset before continuing.")
  }

  if (isHiggsfieldUploadId(reference)) return reference
  return normalizeFilePath(reference)
}

function isHiggsfieldUploadId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  )
}

function mediaFlagForKind(mediaKind: HiggsfieldMediaKind) {
  if (mediaKind === "video") return "--video"
  if (mediaKind === "audio") return "--audio"
  return "--image"
}

function ensureCommandSucceeded(result: CollectedCommand, title: string) {
  if (isMissingExecutable(result.error)) {
    throw new Error(
      "Higgsfield is not available. Reinstall Assetwell, or sign in through the Higgsfield CLI.",
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
  authResult: CollectedCommand,
  workspaceResult: CollectedCommand | null,
) {
  const fallbackDetail =
    executable.source === "global" && executable.bundledDetail
      ? `${executable.bundledDetail} Using the global Higgsfield fallback.`
      : null

  if (
    authResult.exitCode === 0 &&
    firstMeaningfulLine(authResult.stdout, authResult.stderr)
  ) {
    if (
      workspaceResult?.exitCode === 0 &&
      !looksWorkspaceUnselected(workspaceResult)
    )
      return fallbackDetail

    const workspaceDetail = firstMeaningfulLine(
      workspaceResult?.stderr,
      workspaceResult?.stdout,
    )
    return workspaceDetail ?? fallbackDetail
  }

  if (authResult.timedOut) {
    return "Timed out while checking your Higgsfield sign-in."
  }

  if (
    looksUnauthenticated(`${authResult.stdout}\n${authResult.stderr}`) ||
    authResult.exitCode !== 0
  ) {
    return "Sign in to connect your Higgsfield account."
  }

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
