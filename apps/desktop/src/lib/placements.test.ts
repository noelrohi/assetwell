// @ts-nocheck
import { describe, expect, test } from "bun:test"

import {
  baseRatios,
  isNarrowBannerPlacement,
  isUnavailableImagePlacement,
  nearestBaseRatio,
  supportedBaseRatios,
} from "./placements"

describe("base ratio helpers", () => {
  test("falls back to the full base ratio set when a model has no explicit sizes", () => {
    expect(supportedBaseRatios([]).map((ratio) => ratio.id)).toEqual(
      baseRatios.map((ratio) => ratio.id),
    )
    expect(supportedBaseRatios(["auto"]).map((ratio) => ratio.id)).toEqual(
      baseRatios.map((ratio) => ratio.id),
    )
  })

  test("filters base ratios to model-supported sizes", () => {
    expect(
      supportedBaseRatios(["1:1", "16:9", "9:16"]).map((ratio) => ratio.id),
    ).toEqual(["1:1", "16:9", "9:16"])
  })

  test("matches equivalent ratio labels from model metadata", () => {
    expect(supportedBaseRatios(["300:157"]).map((ratio) => ratio.id)).toEqual([
      "1.91:1",
    ])
  })

  test("chooses the closest available ratio instead of snapping to the first option", () => {
    const current = baseRatios.find((ratio) => ratio.id === "4:5")!
    const options = supportedBaseRatios(["1:1", "3:4", "16:9"])

    expect(nearestBaseRatio(current, options).id).toBe("3:4")
  })

  test("offers every image placement, including narrow banners", () => {
    expect(isUnavailableImagePlacement("728x90")).toBe(false)
    expect(isUnavailableImagePlacement("320x50")).toBe(false)
    expect(isUnavailableImagePlacement("1200x628")).toBe(false)
  })

  test("routes only leaderboard sizes through the narrow-banner pipeline", () => {
    expect(isNarrowBannerPlacement("728x90")).toBe(true)
    expect(isNarrowBannerPlacement("320x50")).toBe(true)
    expect(isNarrowBannerPlacement("1200x628")).toBe(false)
    expect(isNarrowBannerPlacement("600x300")).toBe(false)
  })
})
