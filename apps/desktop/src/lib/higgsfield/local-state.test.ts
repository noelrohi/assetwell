import { describe, expect, test } from "bun:test"

import {
  artifactUrl,
  createSnapshot,
  fileUrl,
  localPreviewUrl,
  normalizeCreativeUrls,
  normalizeReferenceUrl,
  normalizeVideoUrls,
  selectedTake,
  upsertPlacement,
} from "./local-state"
import type { Creative } from "./types"

function makeCreative(overrides: Partial<Creative> = {}): Creative {
  return {
    id: "creative-1",
    title: "Creative",
    prompt: "Prompt",
    ratioId: "1:1",
    ratioW: 1024,
    ratioH: 1024,
    model: "model",
    createdAt: "2026-06-24T00:00:00.000Z",
    heroUrl: "hero.png",
    status: "ready",
    takes: [{ id: "take-1", status: "ready", url: "one.png" }],
    selectedTakeId: "take-1",
    placements: [],
    ...overrides,
  }
}

describe("local state helpers", () => {
  test("creates persisted snapshots with the expected schema", () => {
    const snapshot = createSnapshot([], [], [], [])

    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.creatives).toEqual([])
    expect(snapshot.videos).toEqual([])
    expect(snapshot.referenceLibrary).toEqual([])
    expect(snapshot.customPrompts).toEqual([])
    expect(Date.parse(snapshot.savedAt)).not.toBeNaN()
  })

  test("selects the explicit take before falling back to a ready take", () => {
    const creative = makeCreative({
      selectedTakeId: "take-2",
      takes: [
        { id: "take-1", status: "ready", url: "one.png" },
        { id: "take-2", status: "ready", url: "two.png" },
      ],
    })

    expect(selectedTake(creative)?.id).toBe("take-2")
    expect(selectedTake({ ...creative, selectedTakeId: "missing" })?.id).toBe(
      "take-1",
    )
  })

  test("upserts placements without changing unrelated sizes", () => {
    expect(
      upsertPlacement(
        [
          { size: "1200x628", status: "ready", url: "old.png" },
          { size: "300x250", status: "pending" },
        ],
        { size: "1200x628", status: "failed", error: "Nope" },
      ),
    ).toEqual([
      { size: "1200x628", status: "failed", error: "Nope" },
      { size: "300x250", status: "pending" },
    ])

    expect(upsertPlacement([], { size: "300x250", status: "pending" })).toEqual(
      [{ size: "300x250", status: "pending" }],
    )
  })

  test("normalizes local file paths into assetwell preview URLs", () => {
    expect(fileUrl("https://cdn.example.com/output.png")).toBe(
      "https://cdn.example.com/output.png",
    )
    expect(fileUrl("assetwell-local://asset/%2Ftmp%2Foutput.png")).toBe(
      "assetwell-local://asset/%2Ftmp%2Foutput.png",
    )
    expect(fileUrl("/tmp/Asset Well/output.png")).toBe(
      "assetwell-local://asset/%2Ftmp%2FAsset%20Well%2Foutput.png",
    )
    expect(localPreviewUrl("file:///tmp/Asset%20Well/output.png")).toBe(
      "assetwell-local://asset/%2Ftmp%2FAsset%20Well%2Foutput.png",
    )
  })

  test("prefers saved artifact file paths over remote URLs", () => {
    expect(
      artifactUrl({
        url: "https://cdn.example.com/output.png",
        filePath: "/tmp/output.png",
        id: null,
        mediaKind: "image",
      }),
    ).toBe("assetwell-local://asset/%2Ftmp%2Foutput.png")
    expect(artifactUrl(undefined)).toBeNull()
  })

  test("normalizes saved creative, video, and reference URLs", () => {
    const creative = normalizeCreativeUrls(
      makeCreative({
        heroUrl: "file:///tmp/hero.png",
        takes: [
          {
            id: "take-1",
            status: "ready",
            url: "stale.png",
            filePath: "/tmp/take-1.png",
          },
        ],
        selectedTakeId: "take-1",
        placements: [
          {
            size: "300x250",
            status: "ready",
            url: "stale-placement.png",
            filePath: "/tmp/placement.png",
          },
        ],
        referenceAssets: [
          {
            id: "reference-1",
            name: "Logo",
            url: "stale-reference.png",
            filePath: "/tmp/logo.png",
          },
        ],
      }),
    )

    expect(creative.heroUrl).toBe("assetwell-local://asset/%2Ftmp%2Fhero.png")
    expect(creative.takes[0].url).toBe(
      "assetwell-local://asset/%2Ftmp%2Ftake-1.png",
    )
    expect(creative.placements[0].url).toBe(
      "assetwell-local://asset/%2Ftmp%2Fplacement.png",
    )
    expect(creative.referenceAssets?.[0]?.url).toBe(
      "assetwell-local://asset/%2Ftmp%2Flogo.png",
    )

    expect(
      normalizeVideoUrls({
        id: "video-1",
        size: "1080x1080",
        status: "ready",
        posterUrl: "file:///tmp/poster.png",
        prompt: "Prompt",
        createdAt: "2026-06-24T00:00:00.000Z",
        url: "stale-video.mp4",
        filePath: "/tmp/video.mp4",
      }).url,
    ).toBe("assetwell-local://asset/%2Ftmp%2Fvideo.mp4")

    expect(
      normalizeReferenceUrl({
        id: "reference-1",
        name: "Logo",
        url: "stale-reference.png",
        filePath: "/tmp/logo.png",
      }).url,
    ).toBe("assetwell-local://asset/%2Ftmp%2Flogo.png")
  })
})
