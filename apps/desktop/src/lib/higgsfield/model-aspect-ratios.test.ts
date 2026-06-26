import { describe, expect, test } from "bun:test"

import {
  fallbackAspectRatios,
  nearestHiggsfieldRatio,
} from "./model-aspect-ratios"

describe("model aspect ratio helpers", () => {
  test("chooses the nearest supported Higgsfield ratio", () => {
    expect(nearestHiggsfieldRatio(1200, 628, ["1:1", "300:157", "16:9"])).toBe(
      "300:157",
    )
    expect(nearestHiggsfieldRatio(720, 1280, ["16:9", "9:16"])).toBe("9:16")
  })

  test("ignores auto and invalid ratio IDs before falling back", () => {
    expect(nearestHiggsfieldRatio(1024, 768, ["auto", "not-a-ratio"])).toBe(
      "4:3",
    )
  })

  test("exposes sensible media-specific fallback ratios", () => {
    expect(fallbackAspectRatios("image")).toContain("1:1")
    expect(fallbackAspectRatios("image")).not.toContain("1.91:1")
    expect(fallbackAspectRatios("video")).toEqual([
      "16:9",
      "9:16",
      "1:1",
      "4:3",
      "3:4",
    ])
  })
})
