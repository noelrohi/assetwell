import path from "node:path"
import type { HiggsfieldUploadedAsset } from "@assetwell/desktop-bridge"

import {
  readJsonFileSync,
  stateDirectory,
  writeJsonFile,
} from "./settings-store"

const UPLOAD_NAME_STATE_SCHEMA_VERSION = 1

export type UploadNameEntries = Record<string, string>

interface UploadNameStateFile {
  schemaVersion?: unknown
  entries?: unknown
  updatedAt?: unknown
}

export async function loadUploadNames(): Promise<UploadNameEntries> {
  const names = normalizeUploadNames(readUploadNameStateFile())
  await writeUploadNameStateFile(names)
  return names
}

export async function recordUploadName(
  uploadId: unknown,
  name: unknown,
): Promise<string | null> {
  const normalizedUploadId = normalizeUploadId(uploadId)
  const normalizedName = normalizeUploadName(name)
  if (!normalizedUploadId || !normalizedName) return null

  const names = normalizeUploadNames(readUploadNameStateFile())
  names[normalizedUploadId] = normalizedName
  await writeUploadNameStateFile(names)
  return normalizedName
}

export function applyUploadNames(
  items: readonly HiggsfieldUploadedAsset[],
  names: UploadNameEntries,
): HiggsfieldUploadedAsset[] {
  return items.map((item) => {
    const name = uploadNameFor(item.uploadId, names)
    return name && item.name !== name ? { ...item, name } : item
  })
}

export function uploadNameFor(
  uploadId: unknown,
  names: UploadNameEntries,
): string | null {
  const normalizedUploadId = normalizeUploadId(uploadId)
  if (!normalizedUploadId) return null

  return names[normalizedUploadId] ?? null
}

function readUploadNameStateFile(): UploadNameStateFile {
  return readJsonFileSync<UploadNameStateFile>(uploadNameStatePath()) ?? {}
}

async function writeUploadNameStateFile(names: UploadNameEntries) {
  await writeJsonFile(uploadNameStatePath(), {
    schemaVersion: UPLOAD_NAME_STATE_SCHEMA_VERSION,
    entries: sortedUploadNames(names),
    updatedAt: new Date().toISOString(),
  })
}

function normalizeUploadNames(file: UploadNameStateFile): UploadNameEntries {
  if (!file.entries || typeof file.entries !== "object") return {}
  if (Array.isArray(file.entries)) return {}

  const names: UploadNameEntries = {}
  for (const [rawUploadId, rawName] of Object.entries(file.entries)) {
    const uploadId = normalizeUploadId(rawUploadId)
    const name = normalizeUploadName(rawName)
    if (uploadId && name) names[uploadId] = name
  }

  return names
}

function sortedUploadNames(names: UploadNameEntries): UploadNameEntries {
  return Object.fromEntries(
    Object.entries(names).sort(([left], [right]) => left.localeCompare(right)),
  ) as UploadNameEntries
}

function normalizeUploadId(value: unknown) {
  if (typeof value !== "string") return null

  const uploadId = value.trim().slice(0, 200)
  return uploadId || null
}

function normalizeUploadName(value: unknown) {
  if (typeof value !== "string") return null

  const name = value
    .trim()
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, "")
    .slice(0, 120)
    .trim()

  return name || null
}

function uploadNameStatePath() {
  return path.join(stateDirectory(), "upload-names.v1.json")
}
