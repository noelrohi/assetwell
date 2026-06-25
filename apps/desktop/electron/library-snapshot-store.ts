import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DatabaseSync as SqliteDatabase } from "node:sqlite"

import { app } from "electron"
import type {
  AssetwellJobStatus,
  AssetwellLibrarySnapshot,
  AssetwellPersistedCreative,
  AssetwellPersistedPlacement,
  AssetwellPersistedReferenceAsset,
  AssetwellPersistedTake,
  AssetwellPersistedVideo,
} from "@assetwell/desktop-bridge"

const SNAPSHOT_SCHEMA_VERSION = 1
const SQLITE_LIBRARY_SCHEMA_VERSION = 1
const SNAPSHOT_ROW_ID = "library"
const INTERRUPTED_MESSAGE =
  "Generation was interrupted before Assetwell received an output. Regenerate when ready."

interface SnapshotRow {
  schema_version: number
  snapshot_json: string
}

export async function loadLibrarySnapshot(): Promise<AssetwellLibrarySnapshot | null> {
  const sqliteSnapshot = await loadSqliteSnapshot()
  if (sqliteSnapshot) return sqliteSnapshot

  const jsonSnapshot = await loadJsonSnapshot()
  if (jsonSnapshot) {
    await saveSqliteSnapshot(jsonSnapshot)
    return jsonSnapshot
  }

  return null
}

export async function saveLibrarySnapshot(
  snapshot: AssetwellLibrarySnapshot,
): Promise<boolean> {
  const normalized = normalizeSnapshot(snapshot)
  const savedToSqlite = await saveSqliteSnapshot(normalized)

  if (savedToSqlite) {
    await writeJsonFile(jsonSnapshotPath(), normalized).catch(() => undefined)
    return true
  }

  await writeJsonFile(jsonSnapshotPath(), normalized)
  return true
}

async function loadSqliteSnapshot() {
  const database = await openDatabase()
  if (!database) return null

  try {
    const row = database
      .prepare(
        `SELECT schema_version, snapshot_json
         FROM library_snapshots
         WHERE id = ?`,
      )
      .get(SNAPSHOT_ROW_ID) as SnapshotRow | undefined

    if (!row || Number(row.schema_version) !== SNAPSHOT_SCHEMA_VERSION) {
      return null
    }

    return normalizeSnapshot(JSON.parse(row.snapshot_json))
  } catch {
    return null
  } finally {
    database.close()
  }
}

async function saveSqliteSnapshot(snapshot: AssetwellLibrarySnapshot) {
  const database = await openDatabase()
  if (!database) return false

  try {
    database
      .prepare(
        `INSERT INTO library_snapshots (
           id, schema_version, sqlite_schema_version, snapshot_json, saved_at
         ) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           schema_version = excluded.schema_version,
           sqlite_schema_version = excluded.sqlite_schema_version,
           snapshot_json = excluded.snapshot_json,
           saved_at = excluded.saved_at`,
      )
      .run(
        SNAPSHOT_ROW_ID,
        snapshot.schemaVersion,
        SQLITE_LIBRARY_SCHEMA_VERSION,
        JSON.stringify(snapshot),
        snapshot.savedAt,
      )
    return true
  } catch {
    return false
  } finally {
    database.close()
  }
}

async function openDatabase(): Promise<SqliteDatabase | null> {
  let database: SqliteDatabase | null = null

  try {
    const sqlite = await import("node:sqlite")
    await mkdir(stateDirectory(), { recursive: true })
    database = new sqlite.DatabaseSync(sqliteSnapshotPath())
    database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS library_snapshots (
        id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        sqlite_schema_version INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        saved_at TEXT NOT NULL
      );
    `)
    return database
  } catch {
    try {
      database?.close()
    } catch {
      // Ignore cleanup errors; the caller will fall back to JSON.
    }
    return null
  }
}

async function loadJsonSnapshot() {
  const raw = await readJsonFile<unknown>(jsonSnapshotPath())
  if (!raw || typeof raw !== "object") return null

  const snapshot = raw as Partial<AssetwellLibrarySnapshot>
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) return null

  return normalizeSnapshot(snapshot)
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T
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
  snapshot: Partial<AssetwellLibrarySnapshot>,
): AssetwellLibrarySnapshot {
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

function normalizeCreative(value: AssetwellPersistedCreative) {
  if (!value?.id || !value.prompt) return []

  const takes = Array.isArray(value.takes) ? value.takes.map(normalizeTake) : []
  const placements = Array.isArray(value.placements)
    ? value.placements.map(normalizePlacement)
    : []
  const stillPending = takes.some((take) => take.status === "pending")
  const hasReady = takes.some((take) => take.status === "ready")
  const status: AssetwellJobStatus = stillPending
    ? "pending"
    : hasReady
      ? "ready"
      : "failed"

  return [{ ...value, status, takes, placements }]
}

function normalizeTake(take: AssetwellPersistedTake): AssetwellPersistedTake {
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
  placement: AssetwellPersistedPlacement,
): AssetwellPersistedPlacement {
  return placement.status === "pending"
    ? {
        ...placement,
        status: "failed",
        runId: undefined,
        error: INTERRUPTED_MESSAGE,
      }
    : placement
}

function normalizeVideo(video: AssetwellPersistedVideo) {
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

function normalizeReference(reference: AssetwellPersistedReferenceAsset) {
  if (!reference?.id || !reference.name || !reference.url) return []
  return [reference]
}

function stateDirectory() {
  return path.join(app.getPath("userData"), "state")
}

function jsonSnapshotPath() {
  return path.join(stateDirectory(), "library.v1.json")
}

function sqliteSnapshotPath() {
  return path.join(stateDirectory(), "library.v1.sqlite")
}
