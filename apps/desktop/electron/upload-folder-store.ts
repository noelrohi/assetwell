import path from "node:path"
import type {
  AssetwellAssignUploadsToFolderRequest,
  AssetwellCreateUploadFolderRequest,
  AssetwellDeleteUploadFolderRequest,
  AssetwellUpdateUploadFolderRequest,
  AssetwellUploadFolder,
  AssetwellUploadFolderAssignment,
  AssetwellUploadFolderState,
} from "@assetwell/desktop-bridge"

import {
  readJsonFileSync,
  stateDirectory,
  writeJsonFile,
} from "./settings-store"

const UPLOAD_FOLDER_STATE_SCHEMA_VERSION = 1

interface UploadFolderStateFile {
  schemaVersion?: unknown
  folders?: unknown
  assignments?: unknown
  updatedAt?: unknown
}

interface StoredUploadFolder {
  id: string
  name: string
}

interface StoredUploadFolderAssignment {
  uploadId: string
  folderId: string | null
}

export async function loadUploadFolderState(): Promise<AssetwellUploadFolderState> {
  const state = normalizeUploadFolderState(readUploadFolderStateFile())
  await writeUploadFolderStateFile(state)
  return state
}

export async function createUploadFolder(
  request: AssetwellCreateUploadFolderRequest,
): Promise<AssetwellUploadFolderState> {
  const state = normalizeUploadFolderState(readUploadFolderStateFile())
  const name = requireFolderName(request.name)
  assertUniqueFolderName(state.folders, name)

  const folder = {
    id: dedupeFolderId(folderIdFromName(name), state.folders),
    name,
  } satisfies AssetwellUploadFolder

  return writeAndReturn({
    ...state,
    folders: [...state.folders, folder],
  })
}

export async function updateUploadFolder(
  request: AssetwellUpdateUploadFolderRequest,
): Promise<AssetwellUploadFolderState> {
  const state = normalizeUploadFolderState(readUploadFolderStateFile())
  const folder = requireFolder(state.folders, request.id)
  const name = requireFolderName(request.name)
  assertUniqueFolderName(state.folders, name, folder.id)

  return writeAndReturn({
    ...state,
    folders: state.folders.map((current) =>
      current.id === folder.id ? { ...current, name } : current,
    ),
  })
}

export async function deleteUploadFolder(
  request: AssetwellDeleteUploadFolderRequest,
): Promise<AssetwellUploadFolderState> {
  const state = normalizeUploadFolderState(readUploadFolderStateFile())
  const folder = requireFolder(state.folders, request.id)

  return writeAndReturn({
    ...state,
    folders: state.folders.filter((current) => current.id !== folder.id),
    assignments: state.assignments.filter(
      (assignment) => assignment.folderId !== folder.id,
    ),
  })
}

export async function assignUploadsToFolder(
  request: AssetwellAssignUploadsToFolderRequest,
): Promise<AssetwellUploadFolderState> {
  const state = normalizeUploadFolderState(readUploadFolderStateFile())
  const folderId = normalizeNullableFolderId(request.folderId)
  if (folderId) requireFolder(state.folders, folderId)

  const uploadIds = uniqueUploadIds(request.uploadIds)
  if (uploadIds.length === 0) return state

  const assignments = new Map(
    state.assignments.flatMap((assignment) =>
      assignment.folderId
        ? [[assignment.uploadId, assignment.folderId] as const]
        : [],
    ),
  )
  for (const uploadId of uploadIds) {
    if (folderId) {
      assignments.set(uploadId, folderId)
    } else {
      assignments.delete(uploadId)
    }
  }

  return writeAndReturn({
    ...state,
    assignments: Array.from(assignments, ([uploadId, assignedFolderId]) => ({
      uploadId,
      folderId: assignedFolderId,
    })),
  })
}

function readUploadFolderStateFile(): UploadFolderStateFile {
  return readJsonFileSync<UploadFolderStateFile>(uploadFolderStatePath()) ?? {}
}

async function writeAndReturn(state: AssetwellUploadFolderState) {
  await writeUploadFolderStateFile(state)
  return state
}

async function writeUploadFolderStateFile(state: AssetwellUploadFolderState) {
  await writeJsonFile(uploadFolderStatePath(), {
    schemaVersion: UPLOAD_FOLDER_STATE_SCHEMA_VERSION,
    folders: state.folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
    })),
    assignments: state.assignments.flatMap((assignment) =>
      assignment.folderId
        ? [
            {
              uploadId: assignment.uploadId,
              folderId: assignment.folderId,
            },
          ]
        : [],
    ),
    updatedAt: new Date().toISOString(),
  })
}

function normalizeUploadFolderState(
  file: UploadFolderStateFile,
): AssetwellUploadFolderState {
  const folders = normalizeFolders(file.folders)

  return {
    folders,
    assignments: normalizeAssignments(file.assignments, folders),
  }
}

function normalizeFolders(value: unknown): AssetwellUploadFolder[] {
  const savedFolders = Array.isArray(value)
    ? value.flatMap((item) => {
        const folder = storedFolder(item)
        return folder ? [folder] : []
      })
    : []
  const folders: AssetwellUploadFolder[] = []

  for (const folder of savedFolders) {
    addFolder(folders, folder)
  }

  return folders
}

function storedFolder(value: unknown): StoredUploadFolder | null {
  if (!value || typeof value !== "object") return null

  const record = value as { id?: unknown; name?: unknown }
  const id = normalizeFolderId(record.id)
  const name = normalizeFolderName(record.name)
  if (!id || !name) return null

  return { id, name }
}

function normalizeAssignments(
  value: unknown,
  folders: AssetwellUploadFolder[],
): AssetwellUploadFolderAssignment[] {
  if (!Array.isArray(value)) return []

  const assignments = new Map<string, string>()
  for (const item of value) {
    const assignment = storedAssignment(item, folders)
    if (assignment?.folderId) {
      assignments.set(assignment.uploadId, assignment.folderId)
    }
  }

  return Array.from(assignments, ([uploadId, folderId]) => ({
    uploadId,
    folderId,
  }))
}

function storedAssignment(
  value: unknown,
  folders: AssetwellUploadFolder[],
): StoredUploadFolderAssignment | null {
  if (!value || typeof value !== "object") return null

  const record = value as { uploadId?: unknown; folderId?: unknown }
  const uploadId = normalizeUploadId(record.uploadId)
  if (!uploadId) return null

  const folderId = normalizeNullableFolderId(record.folderId)
  if (!folderId || !findFolder(folders, folderId)) return null

  return {
    uploadId,
    folderId,
  }
}

function requireFolder(folders: AssetwellUploadFolder[], value: unknown) {
  const folderId = normalizeFolderId(value)
  const folder = folderId ? findFolder(folders, folderId) : null

  if (!folder) {
    throw new Error("Unknown folder.")
  }

  return folder
}

function requireFolderName(value: unknown) {
  const name = normalizeFolderName(value)

  if (!name) {
    throw new Error("Folder name is required.")
  }

  return name
}

function assertUniqueFolderName(
  folders: AssetwellUploadFolder[],
  name: string,
  exceptFolderId?: string,
) {
  const nameKey = folderNameKey(name)
  const duplicate = folders.find(
    (folder) =>
      folder.id !== exceptFolderId && folderNameKey(folder.name) === nameKey,
  )

  if (duplicate) {
    throw new Error("A folder with that name already exists.")
  }
}

function folderNameKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

function normalizeFolderName(value: unknown) {
  if (typeof value !== "string") return null

  const name = value
    .trim()
    .replace(/[\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim()

  return name || null
}

function normalizeNullableFolderId(value: unknown) {
  if (value === null || value === undefined) return null
  return normalizeFolderId(value)
}

function normalizeFolderId(value: unknown) {
  if (typeof value !== "string") return null

  const folderId = value.trim()
  return isSafeFolderId(folderId) ? folderId : null
}

function folderIdFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)

  const folderId = slug.startsWith("folder-") ? slug : `folder-${slug}`
  return (
    normalizeFolderId(folderId || `folder-${Date.now()}`) ??
    `folder-${Date.now()}`
  )
}

function isSafeFolderId(value: string) {
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

function dedupeFolderId(
  requestedFolderId: string,
  folders: AssetwellUploadFolder[],
) {
  let index = 1
  let candidate = requestedFolderId

  while (findFolder(folders, candidate)) {
    index += 1
    candidate = `${requestedFolderId}-${index}`
  }

  return candidate
}

function findFolder(folders: AssetwellUploadFolder[], folderId: string) {
  return folders.find(
    (folder) => folder.id.toLowerCase() === folderId.toLowerCase(),
  )
}

function addFolder(
  folders: AssetwellUploadFolder[],
  folder: AssetwellUploadFolder,
) {
  if (!findFolder(folders, folder.id)) folders.push(folder)
}

function uniqueUploadIds(value: unknown) {
  if (!Array.isArray(value)) return []

  const uploadIds = new Set<string>()
  for (const item of value) {
    const uploadId = normalizeUploadId(item)
    if (uploadId) uploadIds.add(uploadId)
  }

  return Array.from(uploadIds)
}

function normalizeUploadId(value: unknown) {
  if (typeof value !== "string") return null

  const uploadId = value.trim().slice(0, 200)
  return uploadId || null
}

function uploadFolderStatePath() {
  return path.join(stateDirectory(), "upload-folders.v1.json")
}
