import type { HiggsfieldMediaKind } from "@assetwell/desktop-bridge"

import type { ModelOption } from "./types"

const MODEL_OPTIONS_STORAGE_KEY = "assetwell.model-options.v1"
const MODEL_OPTIONS_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface StoredModelOptionsCache {
  schemaVersion: 1
  entries: Partial<
    Record<
      HiggsfieldMediaKind,
      {
        savedAt: number
        options: ModelOption[]
      }
    >
  >
}

export function readCachedModelOptions(
  mediaKind: HiggsfieldMediaKind,
): ModelOption[] | null {
  if (typeof window === "undefined") return null

  try {
    const value = window.localStorage.getItem(MODEL_OPTIONS_STORAGE_KEY)
    const parsed = value
      ? (JSON.parse(value) as Partial<StoredModelOptionsCache>)
      : null
    const entry =
      parsed?.schemaVersion === 1 ? parsed.entries?.[mediaKind] : null
    if (
      !entry ||
      !Array.isArray(entry.options) ||
      typeof entry.savedAt !== "number"
    ) {
      return null
    }
    if (Date.now() - entry.savedAt > MODEL_OPTIONS_CACHE_MAX_AGE_MS) {
      return null
    }

    const options = normalizeModelOptions(entry.options)
    return options.length ? options : null
  } catch {
    return null
  }
}

export function writeCachedModelOptions(
  mediaKind: HiggsfieldMediaKind,
  options: ModelOption[],
): void {
  if (typeof window === "undefined") return

  try {
    const value = window.localStorage.getItem(MODEL_OPTIONS_STORAGE_KEY)
    const parsed = value
      ? (JSON.parse(value) as Partial<StoredModelOptionsCache>)
      : null
    const cache: StoredModelOptionsCache = {
      schemaVersion: 1,
      entries:
        parsed?.schemaVersion === 1 && parsed.entries ? parsed.entries : {},
    }
    cache.entries[mediaKind] = {
      savedAt: Date.now(),
      options,
    }
    window.localStorage.setItem(
      MODEL_OPTIONS_STORAGE_KEY,
      JSON.stringify(cache),
    )
  } catch {
    // A warm cache is a nicety; model loading should never depend on localStorage.
  }
}

export function clearCachedModelOptions(): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(MODEL_OPTIONS_STORAGE_KEY)
  } catch {
    // A warm cache is a nicety; model loading should never depend on localStorage.
  }
}

function normalizeModelOptions(options: readonly unknown[]): ModelOption[] {
  return options.flatMap((option) => {
    if (!option || typeof option !== "object") return []
    if (
      !("id" in option) ||
      typeof option.id !== "string" ||
      !option.id.trim()
    ) {
      return []
    }
    if (
      !("label" in option) ||
      typeof option.label !== "string" ||
      !option.label.trim()
    ) {
      return []
    }
    if (
      !("hint" in option) ||
      (typeof option.hint !== "string" && option.hint !== null)
    ) {
      return []
    }
    if (
      "badges" in option &&
      option.badges !== undefined &&
      (!Array.isArray(option.badges) ||
        option.badges.some((badge) => typeof badge !== "string"))
    ) {
      return []
    }

    const badges =
      "badges" in option && Array.isArray(option.badges)
        ? (option.badges as string[])
        : undefined
    return [
      {
        id: option.id.trim(),
        label: option.label.trim(),
        hint: option.hint,
        ...(badges?.length ? { badges } : {}),
      },
    ]
  })
}
