import { mkdirSync, readFileSync, statSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { app, dialog, shell, type BrowserWindow } from "electron"
import { zipSync } from "fflate"
import type {
  KreeytsChooseOutputRootResult,
  KreeytsExportCreativeZipRequest,
  KreeytsExportCreativeZipResult,
  KreeytsJobStatus,
  KreeytsLibrarySnapshot,
  KreeytsPersistedCreative,
  KreeytsPersistedPlacement,
  KreeytsPersistedReferenceAsset,
  KreeytsPersistedTake,
  KreeytsPersistedVideo,
  KreeytsSettings,
} from "@kreeyts/desktop-bridge"

const SNAPSHOT_SCHEMA_VERSION = 1
const INTERRUPTED_MESSAGE =
  "Generation was interrupted before Kreeyts received an output. Regenerate when ready."

interface SettingsFile {
  outputRoot?: unknown
}

export async function loadLibrarySnapshot(): Promise<KreeytsLibrarySnapshot | null> {
  const raw = await readJsonFile<unknown>(snapshotPath())
  if (!raw || typeof raw !== "object") return null

  const snapshot = raw as Partial<KreeytsLibrarySnapshot>
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return null

  return normalizeSnapshot(snapshot)
}

export async function saveLibrarySnapshot(
  snapshot: KreeytsLibrarySnapshot,
): Promise<boolean> {
  await writeJsonFile(snapshotPath(), normalizeSnapshot(snapshot))
  return true
}

export async function getKreeytsSettings(): Promise<KreeytsSettings> {
  const settings = readSettingsSync()
  await mkdir(settings.outputRoot, { recursive: true })
  return settings
}

export function getKreeytsOutputRootSync() {
  const settings = readSettingsSync()
  mkdirSync(settings.outputRoot, { recursive: true })
  return settings.outputRoot
}

export async function chooseKreeytsOutputRoot(
  owner?: BrowserWindow | null,
): Promise<KreeytsChooseOutputRootResult | null> {
  const current = readSettingsSync()
  const result = owner
    ? await dialog.showOpenDialog(owner, {
        title: "Choose Kreeyts library folder",
        defaultPath: current.outputRoot,
        properties: ["openDirectory", "createDirectory"],
      })
    : await dialog.showOpenDialog({
        title: "Choose Kreeyts library folder",
        defaultPath: current.outputRoot,
        properties: ["openDirectory", "createDirectory"],
      })

  if (result.canceled || !result.filePaths[0]) return null

  const outputRoot = result.filePaths[0]
  await mkdir(outputRoot, { recursive: true })
  await writeJsonFile(settingsPath(), { outputRoot })

  return { outputRoot }
}

export async function revealKreeytsOutputRoot() {
  const { outputRoot } = await getKreeytsSettings()
  const error = await shell.openPath(outputRoot)
  return error.length === 0
}

export async function exportCreativeZip(
  request: KreeytsExportCreativeZipRequest,
  owner?: BrowserWindow | null,
): Promise<KreeytsExportCreativeZipResult | null> {
  const files = request.files
    .map((file) => ({
      path: file.path.trim(),
      name: safeZipEntryName(file.name),
    }))
    .filter(
      (file) =>
        file.path &&
        file.name &&
        statSync(file.path, { throwIfNoEntry: false })?.isFile(),
    )

  if (files.length === 0) return null

  const { outputRoot } = await getKreeytsSettings()
  const defaultDir = request.outputDirectoryName
    ? path.join(outputRoot, safePathPart(request.outputDirectoryName))
    : outputRoot
  await mkdir(defaultDir, { recursive: true })

  const result = owner
    ? await dialog.showSaveDialog(
        owner,
        saveZipDialogOptions(request, defaultDir),
      )
    : await dialog.showSaveDialog(saveZipDialogOptions(request, defaultDir))

  if (result.canceled || !result.filePath) return null

  const entries: Record<string, Uint8Array> = {}
  for (const file of files) {
    entries[dedupeZipEntryName(file.name, entries)] = await readFile(file.path)
  }

  await writeFile(result.filePath, zipSync(entries, { level: 6 }))
  return { filePath: result.filePath }
}

function saveZipDialogOptions(
  request: KreeytsExportCreativeZipRequest,
  defaultDir: string,
) {
  return {
    title: "Export creative ZIP",
    defaultPath: path.join(defaultDir, `${safePathPart(request.title)}.zip`),
    filters: [{ name: "ZIP archive", extensions: ["zip"] }],
  }
}

function readSettingsSync(): KreeytsSettings {
  const raw = readJsonFileSync<SettingsFile>(settingsPath())
  const outputRoot =
    typeof raw?.outputRoot === "string" && raw.outputRoot.trim()
      ? raw.outputRoot.trim()
      : defaultOutputRoot()

  return { outputRoot }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T
  } catch {
    return null
  }
}

function readJsonFileSync<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T
  } catch {
    return null
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`)
  await rename(tempPath, filePath)
}

function normalizeSnapshot(
  snapshot: Partial<KreeytsLibrarySnapshot>,
): KreeytsLibrarySnapshot {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    creatives: Array.isArray(snapshot.creatives)
      ? snapshot.creatives.flatMap(normalizeCreative)
      : [],
    videos: Array.isArray(snapshot.videos)
      ? snapshot.videos.flatMap(normalizeVideo)
      : [],
    referenceLibrary: Array.isArray(snapshot.referenceLibrary)
      ? snapshot.referenceLibrary.flatMap(normalizeReference)
      : [],
    customPrompts: Array.isArray(snapshot.customPrompts)
      ? snapshot.customPrompts
      : [],
    savedAt:
      typeof snapshot.savedAt === "string"
        ? snapshot.savedAt
        : new Date().toISOString(),
  }
}

function normalizeCreative(value: KreeytsPersistedCreative) {
  if (!value?.id || !value.prompt) return []

  const takes = Array.isArray(value.takes) ? value.takes.map(normalizeTake) : []
  const placements = Array.isArray(value.placements)
    ? value.placements.map(normalizePlacement)
    : []
  const stillPending = takes.some((take) => take.status === "pending")
  const hasReady = takes.some((take) => take.status === "ready")
  const status: KreeytsJobStatus = stillPending
    ? "pending"
    : hasReady
      ? "ready"
      : "failed"

  return [
    {
      ...value,
      status,
      takes,
      placements,
    },
  ]
}

function normalizeTake(take: KreeytsPersistedTake): KreeytsPersistedTake {
  return take.status === "pending"
    ? {
        ...take,
        status: "failed",
        runId: undefined,
        error: INTERRUPTED_MESSAGE,
      }
    : take
}

function normalizePlacement(
  placement: KreeytsPersistedPlacement,
): KreeytsPersistedPlacement {
  return placement.status === "pending"
    ? {
        ...placement,
        status: "failed",
        runId: undefined,
        error: INTERRUPTED_MESSAGE,
      }
    : placement
}

function normalizeVideo(video: KreeytsPersistedVideo) {
  if (!video?.id || !video.prompt) return []
  return [
    video.status === "pending"
      ? {
          ...video,
          status: "failed" as const,
          runId: undefined,
          error: INTERRUPTED_MESSAGE,
        }
      : video,
  ]
}

function normalizeReference(reference: KreeytsPersistedReferenceAsset) {
  if (!reference?.id || !reference.name || !reference.url) return []
  return [reference]
}

function defaultOutputRoot() {
  return path.join(os.homedir(), "Kreeyts")
}

function stateDirectory() {
  return path.join(app.getPath("userData"), "state")
}

function snapshotPath() {
  return path.join(stateDirectory(), "library.v1.json")
}

function settingsPath() {
  return path.join(stateDirectory(), "settings.json")
}

function safePathPart(value: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return safe || new Date().toISOString().slice(0, 10)
}

function safeZipEntryName(value: string) {
  const parsed = path.parse(value.trim())
  const name = safePathPart(parsed.name || "creative")
  const ext = parsed.ext.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "") || ".png"
  return `${name}${ext}`
}

function dedupeZipEntryName(name: string, entries: Record<string, Uint8Array>) {
  if (!(name in entries)) return name

  const parsed = path.parse(name)
  let index = 2
  let next = `${parsed.name}-${index}${parsed.ext}`
  while (next in entries) {
    index += 1
    next = `${parsed.name}-${index}${parsed.ext}`
  }
  return next
}
