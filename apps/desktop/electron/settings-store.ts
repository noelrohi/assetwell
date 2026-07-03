import { mkdirSync, readFileSync } from "node:fs"
import { mkdir, rename, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { app } from "electron"
import type { AssetwellSettings } from "@assetwell/desktop-bridge"

export interface SettingsFile {
  outputRoot?: unknown
  activeUploadWorkspaceId?: unknown
  uploadWorkspaces?: unknown
}

export function readAssetwellSettingsSync(): AssetwellSettings {
  return { outputRoot: settingsOutputRoot(readSettingsFileSync()) }
}

export function getAssetwellOutputRootSync() {
  const settings = readAssetwellSettingsSync()
  mkdirSync(settings.outputRoot, { recursive: true })
  return settings.outputRoot
}

export function readSettingsFileSync(): SettingsFile {
  return readJsonFileSync<SettingsFile>(settingsPath()) ?? {}
}

export function settingsOutputRoot(settings: SettingsFile) {
  return typeof settings.outputRoot === "string" && settings.outputRoot.trim()
    ? settings.outputRoot.trim()
    : defaultOutputRoot()
}

export async function writeSettingsFile(settings: SettingsFile) {
  await writeJsonFile(settingsPath(), settings)
}

export function readJsonFileSync<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T
  } catch {
    return null
  }
}

const pendingJsonWrites = new Map<string, Promise<void>>()
let jsonWriteSequence = 0

export async function writeJsonFile(filePath: string, value: unknown) {
  // Serialize writes per file: concurrent callers (e.g. a renderer effect
  // double-invoked in dev) otherwise race the temp-file rename below.
  const write = (pendingJsonWrites.get(filePath) ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => {
      await mkdir(path.dirname(filePath), { recursive: true })
      jsonWriteSequence += 1
      const tempPath = `${filePath}.${process.pid}.${jsonWriteSequence}.tmp`
      await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`)
      await rename(tempPath, filePath)
    })

  pendingJsonWrites.set(filePath, write)
  try {
    await write
  } finally {
    if (pendingJsonWrites.get(filePath) === write) {
      pendingJsonWrites.delete(filePath)
    }
  }
}

export function defaultOutputRoot() {
  return path.join(os.homedir(), "Assetwell")
}

export function stateDirectory() {
  return path.join(app.getPath("userData"), "state")
}

export function settingsPath() {
  return path.join(stateDirectory(), "settings.json")
}
