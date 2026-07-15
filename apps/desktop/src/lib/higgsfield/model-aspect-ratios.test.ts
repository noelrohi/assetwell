import { describe, expect, test } from "bun:test"

import {
  fallbackAspectRatios,
  matchesHiggsfieldRatio,
  nearestHiggsfieldRatio,
} from "./model-aspect-ratios"

describe("model aspect ratio helpers", () => {
  test("chooses the nearest supported Higgsfield ratio", () => {
    expect(nearestHiggsfieldRatio(1200, 628, ["1:1", "300:157", "16:9"])).toBe(
      "300:157",
    )
    expect(nearestHiggsfieldRatio(720, 1280, ["16:9", "9:16"])).toBe("9:16")
  })

  test("distinguishes native ratios from adapted output ratios", () => {
    expect(matchesHiggsfieldRatio(1280, 720, "16:9")).toBe(true)
    expect(matchesHiggsfieldRatio(1080, 1080, "1:1")).toBe(true)
    expect(matchesHiggsfieldRatio(300, 250, "4:3")).toBe(false)
  })

  test("ignores auto and invalid ratio IDs before falling back", () => {
    expect(nearestHiggsfieldRatio(1024, 768, ["auto", "not-a-ratio"])).toBe(
      "4:3",
    )
  })

  test("exposes sensible media-specific fallback ratios", () => {
    const imageRatios = fallbackAspectRatios("image")

    expect(imageRatios).toContain("1:1")
    expect(imageRatios).toContain("16:9")
    expect(imageRatios).not.toContain("1.91:1")
    expect(imageRatios).not.toContain("2:1")
    expect(imageRatios).not.toContain("6:5")
    expect(fallbackAspectRatios("video")).toEqual([
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4",
    ])
  })

  test("chooses native source ratios for crop-backed base sizes", () => {
    const imageRatios = fallbackAspectRatios("image")

    expect(nearestHiggsfieldRatio(1080, 900, imageRatios)).toBe("5:4")
    expect(nearestHiggsfieldRatio(1200, 600, imageRatios)).toBe("16:9")
  })
})
