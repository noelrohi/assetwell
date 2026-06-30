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

export async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`)
  await rename(tempPath, filePath)
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
