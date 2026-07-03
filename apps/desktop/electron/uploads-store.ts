import { statSync } from "node:fs"
import {
  copyFile,
  mkdir,
  readdir,
  rename,
  rm,
  rmdir,
  unlink,
} from "node:fs/promises"
import path from "node:path"
import {
  dialog,
  shell,
  type BrowserWindow,
  type OpenDialogOptions,
} from "electron"
import type {
  AssetwellCreateUploadWorkspaceRequest,
  AssetwellDeleteReferenceAssetRequest,
  AssetwellDeleteUploadWorkspaceRequest,
  AssetwellReferenceAsset,
  AssetwellSetActiveUploadWorkspaceRequest,
  AssetwellUpdateUploadWorkspaceRequest,
  AssetwellUploadsSnapshot,
  AssetwellUploadWorkspaceState,
} from "@assetwell/desktop-bridge"

import { isReferenceImage, localAssetUrl } from "./local-assets"
import {
  readSettingsFileSync,
  settingsOutputRoot,
  writeSettingsFile,
  type SettingsFile,
} from "./settings-store"

const LEGACY_REFERENCE_ASSETS_FOLDER = "Brand Memory"
const UPLOADS_FOLDER = "Uploads"
const DEFAULT_UPLOAD_WORKSPACE_ID = "Default"
interface UploadWorkspaceRecord {
  id: string
  name: string
}

interface NormalizedUploadWorkspaceSettings {
  outputRoot: string
  activeUploadWorkspaceId: string
  uploadWorkspaces: UploadWorkspaceRecord[]
}

const defaultUploadWorkspace: UploadWorkspaceRecord = {
  id: DEFAULT_UPLOAD_WORKSPACE_ID,
  name: DEFAULT_UPLOAD_WORKSPACE_ID,
}

export async function loadUploadsSnapshot(): Promise<AssetwellUploadsSnapshot> {
  return uploadsSnapshot(await ensureUploadWorkspaceSettings())
}

export async function getUploadWorkspaceState(): Promise<AssetwellUploadWorkspaceState> {
  return uploadWorkspaceState(await ensureUploadWorkspaceSettings())
}

export async function setActiveUploadsWorkspace(
  request: AssetwellSetActiveUploadWorkspaceRequest,
): Promise<AssetwellUploadsSnapshot> {
  const settings = await ensureUploadWorkspaceSettings()
  const requestedWorkspaceId = normalizeUploadWorkspaceId(request.id)

  if (!requestedWorkspaceId) {
    throw new Error("Unknown Uploads workspace.")
  }

  const existing = findUploadWorkspace(
    settings.uploadWorkspaces,
    requestedWorkspaceId,
  )
  const workspace = existing ?? {
    id: requestedWorkspaceId,
    name: normalizeUploadWorkspaceName(request.name) ?? requestedWorkspaceId,
  }
  const uploadWorkspaces = existing
    ? settings.uploadWorkspaces.map((current) =>
        current.id === existing.id && request.name
          ? {
              ...current,
              name: normalizeUploadWorkspaceName(request.name) ?? current.name,
            }
          : current,
      )
    : [...settings.uploadWorkspaces, workspace]

  const next = {
    ...settings,
    activeUploadWorkspaceId: workspace.id,
    uploadWorkspaces,
  }
  await mkdir(uploadWorkspaceDirectory(next.outputRoot, workspace.id), {
    recursive: true,
  })
  await writeUploadWorkspaceSettings(readSettingsFileSync(), next)
  return uploadsSnapshot(next)
}

export async function createUploadsWorkspace(
  request: AssetwellCreateUploadWorkspaceRequest,
): Promise<AssetwellUploadsSnapshot> {
  const settings = await ensureUploadWorkspaceSettings()
  const next = planCreateUploadWorkspace(settings, request.name)

  await mkdir(
    uploadWorkspaceDirectory(next.outputRoot, next.activeUploadWorkspaceId),
    {
      recursive: true,
    },
  )
  await writeUploadWorkspaceSettings(readSettingsFileSync(), next)
  return uploadsSnapshot(next)
}

export async function updateUploadsWorkspace(
  request: AssetwellUpdateUploadWorkspaceRequest,
): Promise<AssetwellUploadsSnapshot> {
  const settings = await ensureUploadWorkspaceSettings()
  const next = planRenameUploadWorkspace(settings, request.id, request.name)

  await writeUploadWorkspaceSettings(readSettingsFileSync(), next)
  return uploadsSnapshot(next)
}

export async function deleteUploadsWorkspace(
  request: AssetwellDeleteUploadWorkspaceRequest,
): Promise<AssetwellUploadsSnapshot> {
  const settings = await ensureUploadWorkspaceSettings()
  const workspace = requireUploadWorkspace(
    settings.uploadWorkspaces,
    request.id,
  )

  if (isDefaultUploadWorkspaceId(workspace.id)) {
    throw new Error("The default Uploads workspace cannot be deleted.")
  }

  const uploadWorkspaces = settings.uploadWorkspaces.filter(
    (current) => current.id !== workspace.id,
  )
  const fallbackWorkspace =
    findUploadWorkspace(uploadWorkspaces, DEFAULT_UPLOAD_WORKSPACE_ID) ??
    uploadWorkspaces[0] ??
    defaultUploadWorkspace
  const next = {
    ...settings,
    activeUploadWorkspaceId:
      settings.activeUploadWorkspaceId === workspace.id
        ? fallbackWorkspace.id
        : settings.activeUploadWorkspaceId,
    uploadWorkspaces,
  }

  await rm(uploadWorkspaceDirectory(settings.outputRoot, workspace.id), {
    recursive: true,
    force: true,
  })
  await mkdir(
    uploadWorkspaceDirectory(next.outputRoot, next.activeUploadWorkspaceId),
    {
      recursive: true,
    },
  )
  await writeUploadWorkspaceSettings(readSettingsFileSync(), next)
  return uploadsSnapshot(next)
}

function planCreateUploadWorkspace(
  settings: NormalizedUploadWorkspaceSettings,
  value: unknown,
): NormalizedUploadWorkspaceSettings {
  const name = requireUploadWorkspaceName(value)
  const requestedWorkspaceId = uploadWorkspaceIdFromName(name)

  if (!requestedWorkspaceId) {
    throw new Error("Workspace name is required.")
  }

  assertUniqueUploadWorkspaceName(settings.uploadWorkspaces, name)

  const workspace = {
    id: dedupeUploadWorkspaceId(
      requestedWorkspaceId,
      settings.uploadWorkspaces,
    ),
    name,
  } satisfies UploadWorkspaceRecord

  return {
    ...settings,
    activeUploadWorkspaceId: workspace.id,
    uploadWorkspaces: [...settings.uploadWorkspaces, workspace],
  }
}

function planRenameUploadWorkspace(
  settings: NormalizedUploadWorkspaceSettings,
  id: unknown,
  value: unknown,
): NormalizedUploadWorkspaceSettings {
  const workspace = requireUploadWorkspace(settings.uploadWorkspaces, id)
  const name = requireUploadWorkspaceName(value)
  assertUniqueUploadWorkspaceName(settings.uploadWorkspaces, name, workspace.id)

  return {
    ...settings,
    uploadWorkspaces: settings.uploadWorkspaces.map((current) =>
      current.id === workspace.id ? { ...current, name } : current,
    ),
  }
}

function requireUploadWorkspace(
  workspaces: UploadWorkspaceRecord[],
  value: unknown,
) {
  const workspaceId = normalizeUploadWorkspaceId(value)
  const workspace = workspaceId
    ? findUploadWorkspace(workspaces, workspaceId)
    : null

  if (!workspace) {
    throw new Error("Unknown Uploads workspace.")
  }

  return workspace
}

function requireUploadWorkspaceName(value: unknown) {
  const name = normalizeUploadWorkspaceName(value)

  if (!name) {
    throw new Error("Workspace name is required.")
  }

  return name
}

function assertUniqueUploadWorkspaceName(
  workspaces: UploadWorkspaceRecord[],
  name: string,
  exceptWorkspaceId?: string,
) {
  const duplicate = workspaces.find(
    (current) =>
      current.id !== exceptWorkspaceId &&
      uploadWorkspaceNameKey(current.name) === uploadWorkspaceNameKey(name),
  )

  if (duplicate) {
    throw new Error("A workspace with that name already exists.")
  }
}

function uploadWorkspaceNameKey(name: string) {
  return (normalizeUploadWorkspaceName(name) ?? name.trim()).toLowerCase()
}

export async function listUploadsReferences(
  workspaceId?: string,
): Promise<AssetwellReferenceAsset[]> {
  const settings = await ensureUploadWorkspaceSettings()
  const workspace = workspaceId
    ? findUploadWorkspace(settings.uploadWorkspaces, workspaceId)
    : findUploadWorkspace(
        settings.uploadWorkspaces,
        settings.activeUploadWorkspaceId,
      )

  if (!workspace) {
    throw new Error("Unknown Uploads workspace.")
  }

  return listReferencesInWorkspace(settings.outputRoot, workspace.id)
}

export async function importUploadsReferences(
  owner?: BrowserWindow | null,
): Promise<AssetwellUploadsSnapshot> {
  const settings = await ensureUploadWorkspaceSettings()
  const assetsRoot = uploadWorkspaceDirectory(
    settings.outputRoot,
    settings.activeUploadWorkspaceId,
  )
  await mkdir(assetsRoot, { recursive: true })

  const options: OpenDialogOptions = {
    title: "Add files to Uploads",
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

  if (!result.canceled) {
    await copyReferenceAssetsIntoWorkspace(assetsRoot, result.filePaths)
  }

  return uploadsSnapshot(settings)
}

/**
 * Imports images from absolute file system paths (e.g. resolved from a
 * renderer drag-and-drop), skipping the file picker entirely. Mirrors the
 * dialog-based import's copy-into-library behavior exactly.
 */
export async function importUploadsReferencePaths(
  filePaths: string[],
): Promise<AssetwellUploadsSnapshot> {
  const settings = await ensureUploadWorkspaceSettings()
  const assetsRoot = uploadWorkspaceDirectory(
    settings.outputRoot,
    settings.activeUploadWorkspaceId,
  )
  await mkdir(assetsRoot, { recursive: true })

  await copyReferenceAssetsIntoWorkspace(assetsRoot, filePaths)

  return uploadsSnapshot(settings)
}

async function copyReferenceAssetsIntoWorkspace(
  assetsRoot: string,
  sourcePaths: string[],
) {
  for (const sourcePath of sourcePaths) {
    const safeName = safeReferenceAssetFileName(path.basename(sourcePath))
    if (!safeName) continue
    if (!statSync(sourcePath, { throwIfNoEntry: false })?.isFile()) continue

    const firstTarget = path.join(assetsRoot, safeName)
    if (path.resolve(sourcePath) === path.resolve(firstTarget)) continue

    await copyFile(sourcePath, dedupeReferenceAssetPath(assetsRoot, safeName))
  }
}

export async function revealUploadsReferences() {
  const settings = await ensureUploadWorkspaceSettings()
  const assetsRoot = uploadWorkspaceDirectory(
    settings.outputRoot,
    settings.activeUploadWorkspaceId,
  )
  await mkdir(assetsRoot, { recursive: true })

  const error = await shell.openPath(assetsRoot)
  return error.length === 0
}

export async function deleteUploadsReference(
  request: AssetwellDeleteReferenceAssetRequest,
): Promise<AssetwellUploadsSnapshot> {
  const settings = await ensureUploadWorkspaceSettings()
  const asset = (
    await listReferencesInWorkspace(
      settings.outputRoot,
      settings.activeUploadWorkspaceId,
    )
  ).find((item) => item.id === request.id)

  if (asset) {
    await unlink(asset.filePath)
  }

  return uploadsSnapshot(settings)
}

async function uploadsSnapshot(
  settings: NormalizedUploadWorkspaceSettings,
): Promise<AssetwellUploadsSnapshot> {
  return {
    workspaceState: uploadWorkspaceState(settings),
    references: await listReferencesInWorkspace(
      settings.outputRoot,
      settings.activeUploadWorkspaceId,
    ),
  }
}

async function listReferencesInWorkspace(
  outputRoot: string,
  workspaceId: string,
): Promise<AssetwellReferenceAsset[]> {
  const assetsRoot = uploadWorkspaceDirectory(outputRoot, workspaceId)
  await mkdir(assetsRoot, { recursive: true })
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
          id: referenceAssetId(workspaceId, entry.name),
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

async function ensureUploadWorkspaceSettings(): Promise<NormalizedUploadWorkspaceSettings> {
  const settings = readSettingsFileSync()
  const outputRoot = settingsOutputRoot(settings)

  await mkdir(outputRoot, { recursive: true })
  await migrateLegacyReferenceAssets(outputRoot)

  const discoveredWorkspaces =
    await collectDiscoveredUploadWorkspaces(outputRoot)
  const normalized = normalizeUploadWorkspaceSettings(
    settings,
    outputRoot,
    discoveredWorkspaces,
  )

  await mkdir(
    uploadWorkspaceDirectory(outputRoot, normalized.activeUploadWorkspaceId),
    { recursive: true },
  )
  await writeUploadWorkspaceSettings(settings, normalized)

  return normalized
}

function normalizeUploadWorkspaceSettings(
  settings: SettingsFile,
  outputRoot: string,
  discoveredWorkspaces: UploadWorkspaceRecord[],
): NormalizedUploadWorkspaceSettings {
  const uploadWorkspaces: UploadWorkspaceRecord[] = []
  const savedWorkspaces = savedUploadWorkspaces(settings)
  const savedDefaultWorkspace = savedWorkspaces.find((workspace) =>
    isDefaultUploadWorkspaceId(workspace.id),
  )
  addUploadWorkspace(
    uploadWorkspaces,
    savedDefaultWorkspace ?? defaultUploadWorkspace,
  )

  for (const workspace of savedWorkspaces) {
    if (!isDefaultUploadWorkspaceId(workspace.id)) {
      addUploadWorkspace(uploadWorkspaces, workspace)
    }
  }
  for (const workspace of discoveredWorkspaces) {
    addUploadWorkspace(uploadWorkspaces, workspace)
  }

  const activeUploadWorkspaceId =
    normalizeUploadWorkspaceId(settings.activeUploadWorkspaceId) ??
    DEFAULT_UPLOAD_WORKSPACE_ID
  const activeWorkspace =
    findUploadWorkspace(uploadWorkspaces, activeUploadWorkspaceId) ??
    findUploadWorkspace(uploadWorkspaces, DEFAULT_UPLOAD_WORKSPACE_ID) ??
    defaultUploadWorkspace

  return {
    outputRoot,
    activeUploadWorkspaceId: activeWorkspace.id,
    uploadWorkspaces,
  }
}

function savedUploadWorkspaces(settings: SettingsFile) {
  if (!Array.isArray(settings.uploadWorkspaces)) return []

  return settings.uploadWorkspaces.flatMap((value) => {
    const workspace = storedUploadWorkspace(value)
    return workspace ? [workspace] : []
  })
}

function storedUploadWorkspace(value: unknown): UploadWorkspaceRecord | null {
  if (typeof value === "string") {
    const id = normalizeUploadWorkspaceId(value)
    return id ? { id, name: id } : null
  }

  if (!value || typeof value !== "object") return null

  const record = value as { id?: unknown; name?: unknown }
  const id = normalizeUploadWorkspaceId(record.id)
  if (!id) return null

  return {
    id,
    name: normalizeUploadWorkspaceName(record.name) ?? id,
  }
}

async function collectDiscoveredUploadWorkspaces(outputRoot: string) {
  const uploadsRoot = uploadsDirectory(outputRoot)
  await mkdir(uploadsRoot, { recursive: true })

  return (await readdir(uploadsRoot, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(isSafeUploadWorkspaceId)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, name: id }))
}

async function migrateLegacyReferenceAssets(outputRoot: string) {
  const legacyRoot = path.join(outputRoot, LEGACY_REFERENCE_ASSETS_FOLDER)
  const defaultRoot = uploadWorkspaceDirectory(
    outputRoot,
    DEFAULT_UPLOAD_WORKSPACE_ID,
  )
  const legacyStats = statSync(legacyRoot, { throwIfNoEntry: false })

  if (!legacyStats?.isDirectory()) {
    await mkdir(defaultRoot, { recursive: true })
    return
  }

  await mkdir(uploadsDirectory(outputRoot), { recursive: true })

  if (!statSync(defaultRoot, { throwIfNoEntry: false })) {
    try {
      await rename(legacyRoot, defaultRoot)
      return
    } catch {
      // Fall through to a file-by-file migration if the directory was created
      // by another caller or the platform rejects the direct rename.
    }
  }

  await mkdir(defaultRoot, { recursive: true })
  const entries = await readdir(legacyRoot, { withFileTypes: true }).catch(
    () => [],
  )

  for (const entry of entries) {
    const sourcePath = path.join(legacyRoot, entry.name)
    const targetPath = dedupePath(defaultRoot, entry.name)
    await rename(sourcePath, targetPath).catch(() => undefined)
  }

  await rmdir(legacyRoot).catch(() => undefined)
}

async function writeUploadWorkspaceSettings(
  settings: SettingsFile,
  normalized: NormalizedUploadWorkspaceSettings,
) {
  const currentWorkspaces = savedUploadWorkspaces(settings)

  if (
    settingsOutputRoot(settings) === normalized.outputRoot &&
    normalizeUploadWorkspaceId(settings.activeUploadWorkspaceId) ===
      normalized.activeUploadWorkspaceId &&
    uploadWorkspacesEqual(currentWorkspaces, normalized.uploadWorkspaces)
  ) {
    return
  }

  await writeSettingsFile({
    ...settings,
    outputRoot: normalized.outputRoot,
    activeUploadWorkspaceId: normalized.activeUploadWorkspaceId,
    uploadWorkspaces: normalized.uploadWorkspaces,
  })
}

function uploadWorkspaceState(
  settings: NormalizedUploadWorkspaceSettings,
): AssetwellUploadWorkspaceState {
  return {
    activeWorkspaceId: settings.activeUploadWorkspaceId,
    workspaces: settings.uploadWorkspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      isDefault: isDefaultUploadWorkspaceId(workspace.id),
    })),
  }
}

function uploadsDirectory(outputRoot: string) {
  return path.join(outputRoot, UPLOADS_FOLDER)
}

function uploadWorkspaceDirectory(outputRoot: string, workspaceId: string) {
  return path.join(uploadsDirectory(outputRoot), workspaceId)
}

function normalizeUploadWorkspaceName(value: unknown) {
  if (typeof value !== "string") return null

  const name = value
    .trim()
    .replace(/[\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim()

  return name || null
}

function normalizeUploadWorkspaceId(value: unknown) {
  if (typeof value !== "string") return null

  const workspaceId = value.trim()
  return isSafeUploadWorkspaceId(workspaceId) ? workspaceId : null
}

function uploadWorkspaceIdFromName(name: string) {
  const workspaceId = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 80)
    .trim()

  return normalizeUploadWorkspaceId(workspaceId)
}

function isSafeUploadWorkspaceId(value: string) {
  return (
    value.length > 0 &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !path.isAbsolute(value) &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/[<>:"|?*\u0000-\u001f]/.test(value) &&
    !/[. ]$/.test(value)
  )
}

function addUploadWorkspace(
  workspaceIds: UploadWorkspaceRecord[],
  workspace: UploadWorkspaceRecord,
) {
  if (!findUploadWorkspace(workspaceIds, workspace.id)) {
    workspaceIds.push(workspace)
  }
}

function isDefaultUploadWorkspaceId(workspaceId: string) {
  return workspaceId.toLowerCase() === DEFAULT_UPLOAD_WORKSPACE_ID.toLowerCase()
}

function findUploadWorkspace(
  workspaces: UploadWorkspaceRecord[],
  workspaceId: string,
) {
  return workspaces.find(
    (current) => current.id.toLowerCase() === workspaceId.toLowerCase(),
  )
}

function dedupeUploadWorkspaceId(
  requestedWorkspaceId: string,
  workspaces: UploadWorkspaceRecord[],
) {
  let index = 1
  let candidate = requestedWorkspaceId

  while (findUploadWorkspace(workspaces, candidate)) {
    index += 1
    candidate = `${requestedWorkspaceId} ${index}`
  }

  return candidate
}

function uploadWorkspacesEqual(
  left: UploadWorkspaceRecord[],
  right: UploadWorkspaceRecord[],
) {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        value.id === right[index]?.id && value.name === right[index]?.name,
    )
  )
}

function referenceAssetId(workspaceId: string, fileName: string) {
  return `reference:${encodeURIComponent(workspaceId)}/${encodeURIComponent(
    fileName,
  )}`
}

function safeReferenceAssetFileName(fileName: string) {
  if (!isReferenceImage(fileName)) return null

  const parsed = path.parse(fileName)
  return `${safePathPart(parsed.name || "reference")}${parsed.ext.toLowerCase()}`
}

function dedupeReferenceAssetPath(directory: string, fileName: string) {
  return dedupePath(directory, fileName)
}

function dedupePath(directory: string, fileName: string) {
  const parsed = path.parse(fileName)
  let index = 1
  let candidate = fileName

  while (statSync(path.join(directory, candidate), { throwIfNoEntry: false })) {
    index += 1
    candidate = `${parsed.name}-${index}${parsed.ext}`
  }

  return path.join(directory, candidate)
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
