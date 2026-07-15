import type { Creative, PendingRun, VideoResult } from "./types"

interface ReadyGenerationResult {
  url: string
  filePath?: string
}

export function applyGenerationResultToCreatives(
  creatives: Creative[],
  pending: PendingRun,
  result: ReadyGenerationResult,
): Creative[] {
  if (pending.kind === "take" && pending.creativeId && pending.takeId) {
    return creatives.map((creative) => {
      if (creative.id !== pending.creativeId) return creative
      const takes = creative.takes.map((take) =>
        take.id === pending.takeId
          ? {
              ...take,
              status: "ready" as const,
              url: result.url,
              filePath: result.filePath,
            }
          : take,
      )
      const readyTakes = takes.filter((take) => take.status === "ready")
      const selectedTakeId =
        creative.selectedTakeId || readyTakes[0]?.id || pending.takeId || ""
      const selectedTake =
        takes.find((take) => take.id === selectedTakeId) ?? readyTakes[0]
      const stillPending = takes.some((take) => take.status === "pending")
      const hasReady = readyTakes.length > 0

      return {
        ...creative,
        takes,
        selectedTakeId,
        heroUrl: selectedTake?.url ?? creative.heroUrl,
        status: stillPending ? "pending" : hasReady ? "ready" : "failed",
      }
    })
  }

  if (pending.kind === "placement" && pending.creativeId && pending.placement) {
    return creatives.map((creative) =>
      creative.id === pending.creativeId
        ? {
            ...creative,
            placements: creative.placements.map((placement) =>
              placement.size === pending.placement
                ? {
                    ...placement,
                    status: "ready" as const,
                    url: result.url,
                    filePath: result.filePath,
                  }
                : placement,
            ),
          }
        : creative,
    )
  }

  return creatives
}

export function applyGenerationResultToVideos(
  videos: VideoResult[],
  pending: PendingRun,
  result: ReadyGenerationResult,
): VideoResult[] {
  if (pending.kind === "video-frame" && pending.videoId) {
    return videos.map((video) =>
      video.id === pending.videoId
        ? {
            ...video,
            posterUrl: result.url,
            framePath: result.filePath,
            stage: "animating" as const,
          }
        : video,
    )
  }

  if (pending.kind !== "video" || !pending.videoId) return videos

  return videos.map((video) =>
    video.id === pending.videoId
      ? {
          ...video,
          status: "ready" as const,
          url: result.url,
          filePath: result.filePath,
        }
      : video,
  )
}

export function markRunFailedInCreatives(
  creatives: Creative[],
  pending: PendingRun,
  error: string,
): Creative[] {
  if (pending.kind === "take" && pending.creativeId && pending.takeId) {
    return creatives.map((creative) => {
      if (creative.id !== pending.creativeId) return creative
      const takes = creative.takes.map((take) =>
        take.id === pending.takeId
          ? { ...take, status: "failed" as const, error }
          : take,
      )
      const stillPending = takes.some((take) => take.status === "pending")
      const hasReady = takes.some((take) => take.status === "ready")
      return {
        ...creative,
        takes,
        status: stillPending ? "pending" : hasReady ? "ready" : "failed",
      }
    })
  }

  if (pending.kind === "placement" && pending.creativeId && pending.placement) {
    return creatives.map((creative) =>
      creative.id === pending.creativeId
        ? {
            ...creative,
            placements: creative.placements.map((placement) =>
              placement.size === pending.placement
                ? { ...placement, status: "failed" as const, error }
                : placement,
            ),
          }
        : creative,
    )
  }

  return creatives
}

export function markRunFailedInVideos(
  videos: VideoResult[],
  pending: PendingRun,
  error: string,
): VideoResult[] {
  if (pending.kind !== "video" || !pending.videoId) return videos

  return videos.map((video) =>
    video.id === pending.videoId
      ? { ...video, status: "failed" as const, error }
      : video,
  )
}
