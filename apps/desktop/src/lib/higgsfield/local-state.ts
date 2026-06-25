import type {
  HiggsfieldGeneratedArtifact,
  KreeytsLibrarySnapshot,
} from "@kreeyts/desktop-bridge"

import type {
  Creative,
  PlacementResult,
  PromptPreset,
  ReferenceAsset,
  VideoResult,
} from "./types"

export function createSnapshot(
  creatives: Creative[],
  videos: VideoResult[],
  referenceLibrary: ReferenceAsset[],
  customPrompts: PromptPreset[],
): KreeytsLibrarySnapshot {
  return {
    schemaVersion: 1,
    creatives,
    videos,
    referenceLibrary,
    customPrompts,
    savedAt: new Date().toISOString(),
  }
}

export function selectedTake(creative: Creative) {
  return (
    creative.takes.find((take) => take.id === creative.selectedTakeId) ??
    creative.takes.find((take) => take.status === "ready")
  )
}

export function upsertPlacement(
  placements: PlacementResult[],
  next: PlacementResult,
) {
  const found = placements.some((placement) => placement.size === next.size)
  return found
    ? placements.map((placement) =>
        placement.size === next.size ? next : placement,
      )
    : [...placements, next]
}

export function artifactUrl(artifact?: HiggsfieldGeneratedArtifact) {
  if (!artifact) return null
  if (artifact.filePath) return fileUrl(artifact.filePath)
  return artifact.url
}

export function normalizeCreativeUrls(creative: Creative): Creative {
  return {
    ...creative,
    heroUrl: localPreviewUrl(creative.heroUrl),
    takes: creative.takes.map((take) => ({
      ...take,
      url: localPreviewUrl(take.url, take.filePath),
    })),
    placements: creative.placements.map((placement) => ({
      ...placement,
      url: placement.url
        ? localPreviewUrl(placement.url, placement.filePath)
        : placement.url,
    })),
  }
}

export function normalizeVideoUrls(video: VideoResult): VideoResult {
  return {
    ...video,
    url: video.url ? localPreviewUrl(video.url, video.filePath) : video.url,
    posterUrl: localPreviewUrl(video.posterUrl),
  }
}

export function normalizeReferenceUrl(
  reference: ReferenceAsset,
): ReferenceAsset {
  return {
    ...reference,
    url: localPreviewUrl(reference.url, reference.filePath),
  }
}

export function localPreviewUrl(url: string, filePath?: string) {
  if (filePath) return fileUrl(filePath)
  if (url.startsWith("file://")) {
    try {
      return fileUrl(decodeURIComponent(new URL(url).pathname))
    } catch {
      return url
    }
  }
  return url
}

export function fileUrl(filePath: string) {
  if (/^https?:\/\//.test(filePath)) return filePath
  if (filePath.startsWith("kreeyts-local://")) return filePath

  return `kreeyts-local://asset/${encodeURIComponent(filePath)}`
}
