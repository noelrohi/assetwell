import { statSync } from "node:fs"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { dialog, shell, type BrowserWindow } from "electron"
import { zipSync } from "fflate"
import type {
  AssetwellChooseOutputRootResult,
  AssetwellExportCreativeZipRequest,
  AssetwellExportCreativeZipResult,
  AssetwellExportVideoRequest,
  AssetwellExportVideoResult,
  AssetwellSettings,
} from "@assetwell/desktop-bridge"

import {
  readAssetwellSettingsSync,
  readSettingsFileSync,
  settingsOutputRoot,
  writeSettingsFile,
} from "./settings-store"

export {
  LOCAL_ASSET_PROTOCOL,
  isPreviewableLocalAsset,
  isReferenceImage,
  localAssetContentType,
  localAssetUrl,
  resolveLocalAssetUrl,
} from "./local-assets"
export { getAssetwellOutputRootSync } from "./settings-store"
export {
  assignUploadsToBrand,
  createBrand,
  loadBrandState,
  setActiveBrand,
  updateBrand,
} from "./brand-store"
export {
  assignUploadsToFolder,
  createUploadFolder,
  deleteUploadFolder,
  loadUploadFolderState,
  updateUploadFolder,
} from "./upload-folder-store"
export {
  createUploadsWorkspace as createUploadWorkspace,
  deleteUploadsReference as deleteReferenceAsset,
  deleteUploadsWorkspace as deleteUploadWorkspace,
  getUploadWorkspaceState,
  importUploadsReferencePaths as importReferenceAssetPaths,
  importUploadsReferences as importReferenceAssets,
  listUploadsReferences as listReferenceAssets,
  loadUploadsSnapshot,
  revealUploadsReferences as revealReferenceAssets,
  setActiveUploadsWorkspace as setActiveUploadWorkspace,
  updateUploadsWorkspace as updateUploadWorkspace,
} from "./uploads-store"
export {
  loadLibrarySnapshot,
  saveLibrarySnapshot,
} from "./library-snapshot-store"

const VIDEO_EXPORT_EXTENSIONS = new Set([".m4v", ".mov", ".mp4", ".webm"])

export async function getAssetwellSettings(): Promise<AssetwellSettings> {
  const settings = readAssetwellSettingsSync()
  await mkdir(settings.outputRoot, { recursive: true })
  return settings
}

export async function chooseAssetwellOutputRoot(
  owner?: BrowserWindow | null,
): Promise<AssetwellChooseOutputRootResult | null> {
  const settings = readSettingsFileSync()
  const current = { outputRoot: settingsOutputRoot(settings) }
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
  await writeSettingsFile({ ...settings, outputRoot })

  return { outputRoot }
}

export async function revealAssetwellOutputRoot() {
  const { outputRoot } = await getAssetwellSettings()
  const error = await shell.openPath(outputRoot)
  return error.length === 0
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
  const exportRoot = scopedOutputRoot(outputRoot, request.uploadWorkspaceId)
  const defaultDir = request.outputDirectoryName
    ? path.join(exportRoot, safePathPart(request.outputDirectoryName))
    : exportRoot
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

function scopedOutputRoot(outputRoot: string, uploadWorkspaceId?: string) {
  return uploadWorkspaceId
    ? path.join(outputRoot, "Outputs", safePathPart(uploadWorkspaceId))
    : outputRoot
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
  const exportRoot = scopedOutputRoot(outputRoot, request.uploadWorkspaceId)
  await mkdir(exportRoot, { recursive: true })

  const result = owner
    ? await dialog.showSaveDialog(
        owner,
        saveVideoDialogOptions(request, exportRoot, sourceExt),
      )
    : await dialog.showSaveDialog(
        saveVideoDialogOptions(request, exportRoot, sourceExt),
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
