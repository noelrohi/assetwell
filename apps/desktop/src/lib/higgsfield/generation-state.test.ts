import { describe, expect, test } from "bun:test"

import {
  applyGenerationResultToCreatives,
  applyGenerationResultToVideos,
  markRunFailedInCreatives,
  markRunFailedInVideos,
} from "./generation-state"
import type { Creative, VideoResult } from "./types"

function creative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: "creative-1",
    title: "Launch creative",
    prompt: "A crisp product launch visual",
    ratioId: "1:1",
    ratioW: 1024,
    ratioH: 1024,
    model: "image-model",
    createdAt: "2026-06-24T00:00:00.000Z",
    heroUrl: "",
    status: "pending",
    takes: [
      { id: "take-1", url: "", status: "pending" },
      { id: "take-2", url: "", status: "pending" },
    ],
    selectedTakeId: "",
    placements: [
      { size: "1200x628", status: "pending" },
      { size: "300x250", status: "pending" },
    ],
    ...overrides,
  }
}

describe("generation state reducers", () => {
  test("applies a completed take and selects the first ready output", () => {
    const [updated] = applyGenerationResultToCreatives(
      [creative()],
      { kind: "take", creativeId: "creative-1", takeId: "take-1" },
      {
        url: "assetwell-local://asset/take-1.png",
        filePath: "/tmp/take-1.png",
      },
    )

    expect(updated.status).toBe("pending")
    expect(updated.selectedTakeId).toBe("take-1")
    expect(updated.heroUrl).toBe("assetwell-local://asset/take-1.png")
    expect(updated.takes[0]).toMatchObject({
      status: "ready",
      url: "assetwell-local://asset/take-1.png",
      filePath: "/tmp/take-1.png",
    })
  })

  test("marks a creative ready once all takes have settled with at least one ready", () => {
    const [updated] = applyGenerationResultToCreatives(
      [
        creative({
          takes: [
            { id: "take-1", url: "ready.png", status: "ready" },
            { id: "take-2", url: "", status: "pending" },
          ],
          selectedTakeId: "take-1",
        }),
      ],
      { kind: "take", creativeId: "creative-1", takeId: "take-2" },
      { url: "ready-2.png" },
    )

    expect(updated.status).toBe("ready")
    expect(updated.selectedTakeId).toBe("take-1")
    expect(updated.heroUrl).toBe("ready.png")
  })

  test("updates only the matching placement", () => {
    const [updated] = applyGenerationResultToCreatives(
      [creative()],
      { kind: "placement", creativeId: "creative-1", placement: "300x250" },
      { url: "placement.png", filePath: "/tmp/placement.png" },
    )

    expect(updated.placements).toEqual([
      { size: "1200x628", status: "pending" },
      {
        size: "300x250",
        status: "ready",
        url: "placement.png",
        filePath: "/tmp/placement.png",
      },
    ])
  })

  test("marks failed takes without failing a creative that still has ready output", () => {
    const [updated] = markRunFailedInCreatives(
      [
        creative({
          status: "pending",
          takes: [
            { id: "take-1", url: "ready.png", status: "ready" },
            { id: "take-2", url: "", status: "pending" },
          ],
        }),
      ],
      { kind: "take", creativeId: "creative-1", takeId: "take-2" },
      "Network failed",
    )

    expect(updated.status).toBe("ready")
    expect(updated.takes[1]).toMatchObject({
      status: "failed",
      error: "Network failed",
    })
  })

  test("updates video success and failure states", () => {
    const videos: VideoResult[] = [
      {
        id: "video-1",
        size: "1080x1080",
        status: "pending",
        posterUrl: "poster.png",
        prompt: "Slow push in",
        createdAt: "2026-06-24T00:00:00.000Z",
      },
    ]

    expect(
      applyGenerationResultToVideos(
        videos,
        { kind: "video", videoId: "video-1" },
        { url: "video.mp4", filePath: "/tmp/video.mp4" },
      )[0],
    ).toMatchObject({
      status: "ready",
      url: "video.mp4",
      filePath: "/tmp/video.mp4",
    })

    expect(
      markRunFailedInVideos(
        videos,
        { kind: "video", videoId: "video-1" },
        "Render failed",
      )[0],
    ).toMatchObject({ status: "failed", error: "Render failed" })
  })
})
