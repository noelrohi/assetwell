import { mkdirSync, readFileSync, statSync } from "node:fs"
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  app,
  dialog,
  shell,
  type BrowserWindow,
  type OpenDialogOptions,
} from "electron"
import { zipSync } from "fflate"
import type {
  AssetwellChooseOutputRootResult,
  AssetwellDeleteReferenceAssetRequest,
  AssetwellExportCreativeZipRequest,
  AssetwellExportCreativeZipResult,
  AssetwellExportVideoRequest,
  AssetwellExportVideoResult,
  AssetwellReferenceAsset,
  AssetwellSettings,
} from "@assetwell/desktop-bridge"

export {
  loadLibrarySnapshot,
  saveLibrarySnapshot,
} from "./library-snapshot-store"

const REFERENCE_ASSETS_FOLDER = "Brand Memory"
export const LOCAL_ASSET_PROTOCOL = "assetwell-local"
const LOCAL_ASSET_HOST = "asset"
const REFERENCE_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
])
const VIDEO_EXPORT_EXTENSIONS = new Set([".m4v", ".mov", ".mp4", ".webm"])
const LOCAL_ASSET_PREVIEW_EXTENSIONS = new Set([
  ...REFERENCE_IMAGE_EXTENSIONS,
  ".mov",
  ".mp4",
  ".webm",
])
interface SettingsFile {
  outputRoot?: unknown
}

export async function getAssetwellSettings(): Promise<AssetwellSettings> {
  const settings = readSettingsSync()
  await mkdir(settings.outputRoot, { recursive: true })
  return settings
}

export function getAssetwellOutputRootSync() {
  const settings = readSettingsSync()
  mkdirSync(settings.outputRoot, { recursive: true })
  return settings.outputRoot
}

export async function chooseAssetwellOutputRoot(
  owner?: BrowserWindow | null,
): Promise<AssetwellChooseOutputRootResult | null> {
  const current = readSettingsSync()
  const result = owner
    ? await dialog.showOpenDialog(owner, {
        title: "Choose Assetwell library folder",
        defaultPath: current.outputRoot,
        properties: ["openDirectory", "createDirectory"],
      })
    : await dialog.showOpenDialog({
        title: "Choose Assetwell library folder",
        defaultPath: current.outputRoot,
        properties: ["openDirectory", "createDirectory"],
      })

  if (result.canceled || !result.filePaths[0]) return null

  const outputRoot = result.filePaths[0]
  await mkdir(outputRoot, { recursive: true })
  await writeJsonFile(settingsPath(), { outputRoot })

  return { outputRoot }
}

export async function revealAssetwellOutputRoot() {
  const { outputRoot } = await getAssetwellSettings()
  const error = await shell.openPath(outputRoot)
  return error.length === 0
}

export async function listReferenceAssets(): Promise<
  AssetwellReferenceAsset[]
> {
  const assetsRoot = await referenceAssetsDirectory()
  const entries = await readdir(assetsRoot, { withFileTypes: true }).catch(
    () => [],
  )

  return entries
    .flatMap((entry) => {
      if (!entry.isFile() || !isReferenceImage(entry.name)) return []

      const filePath = path.join(assetsRoot, entry.name)
      const stats = statSync(filePath, { throwIfNoEntry: false })
      if (!stats?.isFile()) return []

      return [
        {
          id: referenceAssetId(entry.name),
          name: entry.name,
          url: localAssetUrl(filePath),
          filePath,
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        },
      ]
    })
    .sort(
      (a, b) =>
        Date.parse(b.modifiedAt ?? "") - Date.parse(a.modifiedAt ?? "") ||
        a.name.localeCompare(b.name),
    )
}

export async function importReferenceAssets(
  owner?: BrowserWindow | null,
): Promise<AssetwellReferenceAsset[]> {
  const assetsRoot = await referenceAssetsDirectory()
  const options: OpenDialogOptions = {
    title: "Add files to Brand Memory",
    defaultPath: assetsRoot,
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "avif"],
      },
    ],
  }
  const result = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled) return listReferenceAssets()

  for (const sourcePath of result.filePaths) {
    const safeName = safeReferenceAssetFileName(path.basename(sourcePath))
    if (!safeName) continue

    const firstTarget = path.join(assetsRoot, safeName)
    if (path.resolve(sourcePath) === path.resolve(firstTarget)) continue

    await copyFile(sourcePath, dedupeReferenceAssetPath(assetsRoot, safeName))
  }

  return listReferenceAssets()
}

export async function revealReferenceAssets() {
  const assetsRoot = await referenceAssetsDirectory()
  const error = await shell.openPath(assetsRoot)
  return error.length === 0
}

export async function deleteReferenceAsset(
  request: AssetwellDeleteReferenceAssetRequest,
) {
  const asset = (await listReferenceAssets()).find(
    (item) => item.id === request.id,
  )
  if (!asset) return false

  await unlink(asset.filePath)
  return true
}

export async function exportCreativeZip(
  request: AssetwellExportCreativeZipRequest,
  owner?: BrowserWindow | null,
): Promise<AssetwellExportCreativeZipResult | null> {
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

  const { outputRoot } = await getAssetwellSettings()
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
  request: AssetwellExportCreativeZipRequest,
  defaultDir: string,
) {
  return {
    title: "Export creative ZIP",
    defaultPath: path.join(defaultDir, `${safePathPart(request.title)}.zip`),
    filters: [{ name: "ZIP archive", extensions: ["zip"] }],
  }
}

export async function exportVideo(
  request: AssetwellExportVideoRequest,
  owner?: BrowserWindow | null,
): Promise<AssetwellExportVideoResult | null> {
  const sourcePath = request.path.trim()
  const sourceExt = path.extname(sourcePath).toLowerCase()
  const stats = statSync(sourcePath, { throwIfNoEntry: false })
  if (
    !sourcePath ||
    !stats?.isFile() ||
    !VIDEO_EXPORT_EXTENSIONS.has(sourceExt)
  ) {
    return null
  }

  const { outputRoot } = await getAssetwellSettings()
  await mkdir(outputRoot, { recursive: true })

  const result = owner
    ? await dialog.showSaveDialog(
        owner,
        saveVideoDialogOptions(request, outputRoot, sourceExt),
      )
    : await dialog.showSaveDialog(
        saveVideoDialogOptions(request, outputRoot, sourceExt),
      )

  if (result.canceled || !result.filePath) return null

  await mkdir(path.dirname(result.filePath), { recursive: true })
  if (path.resolve(sourcePath) !== path.resolve(result.filePath)) {
    await copyFile(sourcePath, result.filePath)
  }

  return { filePath: result.filePath }
}

function saveVideoDialogOptions(
  request: AssetwellExportVideoRequest,
  defaultDir: string,
  sourceExt: string,
) {
  return {
    title: "Download video",
    defaultPath: path.join(
      defaultDir,
      `${safePathPart(request.title || "video")}${sourceExt}`,
    ),
    filters: [
      {
        name: "Video",
        extensions: Array.from(VIDEO_EXPORT_EXTENSIONS).map((ext) =>
          ext.slice(1),
        ),
      },
    ],
  }
}

function readSettingsSync(): AssetwellSettings {
  const raw = readJsonFileSync<SettingsFile>(settingsPath())
  const outputRoot =
    typeof raw?.outputRoot === "string" && raw.outputRoot.trim()
      ? raw.outputRoot.trim()
      : defaultOutputRoot()

  return { outputRoot }
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

function defaultOutputRoot() {
  return path.join(os.homedir(), "Assetwell")
}

function stateDirectory() {
  return path.join(app.getPath("userData"), "state")
}

function settingsPath() {
  return path.join(stateDirectory(), "settings.json")
}

async function referenceAssetsDirectory() {
  const { outputRoot } = await getAssetwellSettings()
  const assetsRoot = path.join(outputRoot, REFERENCE_ASSETS_FOLDER)
  await mkdir(assetsRoot, { recursive: true })
  return assetsRoot
}

export function isReferenceImage(filePath: string) {
  return REFERENCE_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function isPreviewableLocalAsset(filePath: string) {
  return LOCAL_ASSET_PREVIEW_EXTENSIONS.has(
    path.extname(filePath).toLowerCase(),
  )
}

function referenceAssetId(fileName: string) {
  return `reference:${encodeURIComponent(fileName)}`
}

function safeReferenceAssetFileName(fileName: string) {
  const parsed = path.parse(fileName)
  const ext = parsed.ext.toLowerCase()
  if (!REFERENCE_IMAGE_EXTENSIONS.has(ext)) return null

  return `${safePathPart(parsed.name || "reference")}${ext}`
}

function dedupeReferenceAssetPath(directory: string, fileName: string) {
  const parsed = path.parse(fileName)
  let index = 1
  let candidate = fileName

  while (statSync(path.join(directory, candidate), { throwIfNoEntry: false })) {
    index += 1
    candidate = `${parsed.name}-${index}${parsed.ext}`
  }

  return path.join(directory, candidate)
}

export function localAssetUrl(filePath: string) {
  return `${LOCAL_ASSET_PROTOCOL}://${LOCAL_ASSET_HOST}/${encodeURIComponent(
    path.resolve(filePath),
  )}`
}

export function resolveLocalAssetUrl(assetUrl: string) {
  try {
    const url = new URL(assetUrl)
    if (url.protocol !== `${LOCAL_ASSET_PROTOCOL}:`) return null
    if (url.hostname !== LOCAL_ASSET_HOST) return null

    const filePath = decodeURIComponent(url.pathname.slice(1))
    if (!filePath || !path.isAbsolute(filePath)) return null

    return filePath
  } catch {
    return null
  }
}

export interface ByteRange {
  start: number
  end: number
}

/**
 * Parses a single-range HTTP `Range` header against a known file size.
 *
 * Chromium's `<video>` element streams media with range requests, so the local
 * asset protocol must honor them; images never need this. Returns `null` for
 * unsupported or unsatisfiable ranges (the caller answers those with 416).
 */
export function parseByteRange(
  rangeHeader: string,
  fileSize: number,
): ByteRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return null

  const [, startRaw, endRaw] = match
  if (startRaw === "" && endRaw === "") return null

  let start: number
  let end: number
  if (startRaw === "") {
    // Suffix range: the final N bytes of the file.
    const suffixLength = Number(endRaw)
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null
    start = Math.max(fileSize - suffixLength, 0)
    end = fileSize - 1
  } else {
    start = Number(startRaw)
    end = endRaw === "" ? fileSize - 1 : Number(endRaw)
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (start > end || start >= fileSize) return null

  return { start, end: Math.min(end, fileSize - 1) }
}

export function localAssetContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".avif":
      return "image/avif"
    case ".gif":
      return "image/gif"
    case ".jpeg":
    case ".jpg":
      return "image/jpeg"
    case ".mov":
      return "video/quicktime"
    case ".mp4":
      return "video/mp4"
    case ".png":
      return "image/png"
    case ".webm":
      return "video/webm"
    case ".webp":
      return "image/webp"
    default:
      return "application/octet-stream"
  }
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
