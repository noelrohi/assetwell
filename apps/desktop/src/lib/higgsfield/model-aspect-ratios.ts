import * as React from "react"
import type { HiggsfieldMediaKind } from "@kreeyts/desktop-bridge"

import { baseRatios } from "@/lib/placements"

import type { HiggsfieldBridge } from "./types"

const MODEL_ASPECT_RATIOS_STORAGE_KEY = "kreeyts.model-aspect-ratios.v1"
const MODEL_ASPECT_RATIOS_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface StoredModelAspectRatioCache {
  schemaVersion: 1
  entries: Record<
    string,
    {
      savedAt: number
      ratios: string[]
    }
  >
}

const HIGGSFIELD_RATIOS = [
  { id: "1:1", value: 1 },
  { id: "3:2", value: 3 / 2 },
  { id: "2:3", value: 2 / 3 },
  { id: "4:3", value: 4 / 3 },
  { id: "3:4", value: 3 / 4 },
  { id: "4:5", value: 4 / 5 },
  { id: "5:4", value: 5 / 4 },
  { id: "9:16", value: 9 / 16 },
  { id: "16:9", value: 16 / 9 },
  { id: "21:9", value: 21 / 9 },
  { id: "9:21", value: 9 / 21 },
  { id: "300:157", value: 300 / 157 },
  { id: "364:45", value: 364 / 45 },
  { id: "32:5", value: 32 / 5 },
] as const

export function useModelAspectRatios(bridge?: HiggsfieldBridge) {
  const cache = React.useRef(new Map<string, string[]>())
  const requests = React.useRef(new Map<string, Promise<string[]>>())

  return React.useCallback(
    async (model: string, mediaKind: HiggsfieldMediaKind) => {
      const fallback = fallbackAspectRatios(mediaKind)
      if (!model) return fallback

      const cacheKey = modelAspectRatioCacheKey(model, mediaKind)
      const memoryCached = cache.current.get(cacheKey)
      if (memoryCached) return memoryCached

      const stored = readStoredModelAspectRatios(cacheKey)
      if (stored) {
        cache.current.set(cacheKey, stored)
        return stored
      }

      if (!bridge) return fallback

      const pending = requests.current.get(cacheKey)
      if (pending) return pending

      const request = bridge
        .getModelDetails({ model, mediaKind })
        .then((details) => {
          const ratios = normalizeAspectRatioIds(
            details.aspectRatios.length ? details.aspectRatios : fallback,
            fallback,
          )
          cache.current.set(cacheKey, ratios)
          writeStoredModelAspectRatios(cacheKey, ratios)
          return ratios
        })
        .catch(() => fallback)
        .finally(() => {
          requests.current.delete(cacheKey)
        })

      requests.current.set(cacheKey, request)
      return request
    },
    [bridge],
  )
}

export function nearestHiggsfieldRatio(
  width: number,
  height: number,
  supportedRatios = fallbackAspectRatios("image"),
) {
  const ratio = width / height
  const candidates = supportedRatios
    .flatMap((id) => {
      const value = ratioValue(id)
      return value ? [{ id, value }] : []
    })
    .filter((candidate) => candidate.id !== "auto")
  const ratios = candidates.length
    ? candidates
    : HIGGSFIELD_RATIOS.filter((item) =>
        fallbackAspectRatios("image").includes(item.id),
      )

  return ratios.reduce((best, next) => {
    const currentDistance = Math.abs(Math.log(ratio / best.value))
    const nextDistance = Math.abs(Math.log(ratio / next.value))
    return nextDistance < currentDistance ? next : best
  }).id
}

export function fallbackAspectRatios(mediaKind: HiggsfieldMediaKind) {
  if (mediaKind === "video") return ["16:9", "9:16", "1:1", "4:3", "3:4"]
  return baseRatios
    .map((ratio) => ratio.id)
    .filter((ratio) => ratio !== "1.91:1")
}

function modelAspectRatioCacheKey(
  model: string,
  mediaKind: HiggsfieldMediaKind,
) {
  return `${mediaKind}:${model}`
}

function normalizeAspectRatioIds(
  ratios: readonly string[],
  fallback: readonly string[],
) {
  const seen = new Set<string>()
  const normalized = ratios.flatMap((ratio) => {
    if (typeof ratio !== "string") return []
    const trimmed = ratio.trim()
    if (!trimmed || trimmed === "auto" || seen.has(trimmed)) return []
    seen.add(trimmed)
    return [trimmed]
  })

  return normalized.length ? normalized : [...fallback]
}

function readStoredModelAspectRatios(cacheKey: string) {
  if (typeof window === "undefined") return null

  try {
    const value = window.localStorage.getItem(MODEL_ASPECT_RATIOS_STORAGE_KEY)
    const parsed = value
      ? (JSON.parse(value) as Partial<StoredModelAspectRatioCache>)
      : null
    const entry = parsed?.entries?.[cacheKey]
    if (
      !entry ||
      !Array.isArray(entry.ratios) ||
      typeof entry.savedAt !== "number"
    ) {
      return null
    }
    if (Date.now() - entry.savedAt > MODEL_ASPECT_RATIOS_CACHE_MAX_AGE_MS) {
      return null
    }

    const ratios = normalizeAspectRatioIds(entry.ratios, [])
    return ratios.length ? ratios : null
  } catch {
    return null
  }
}

function writeStoredModelAspectRatios(cacheKey: string, ratios: string[]) {
  if (typeof window === "undefined") return

  try {
    const value = window.localStorage.getItem(MODEL_ASPECT_RATIOS_STORAGE_KEY)
    const parsed = value
      ? (JSON.parse(value) as Partial<StoredModelAspectRatioCache>)
      : null
    const cache: StoredModelAspectRatioCache = {
      schemaVersion: 1,
      entries: parsed?.entries ?? {},
    }
    cache.entries[cacheKey] = {
      savedAt: Date.now(),
      ratios,
    }
    window.localStorage.setItem(
      MODEL_ASPECT_RATIOS_STORAGE_KEY,
      JSON.stringify(cache),
    )
  } catch {
    // A warm cache is a nicety; generation should never depend on localStorage.
  }
}

function ratioValue(id: string) {
  const known = HIGGSFIELD_RATIOS.find((ratio) => ratio.id === id)?.value
  if (known) return known

  const match = id.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) {
    return null
  }

  return width / height
}
