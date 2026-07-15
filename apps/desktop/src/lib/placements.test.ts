// @ts-nocheck
import { describe, expect, test } from "bun:test"

import {
  baseRatios,
  defaultVideoSizes,
  isNarrowBannerPlacement,
  isUnavailableImagePlacement,
  nearestBaseRatio,
  nearestVideoPlacement,
  supportedBaseRatios,
} from "./placements"

describe("default video sizes", () => {
  test("defaults to wide without a source", () => {
    expect(defaultVideoSizes()).toEqual(["1280x720"])
  })

  test("defaults to portrait for a portrait source", () => {
    expect(defaultVideoSizes(720, 1280)).toEqual(["720x1280"])
  })

  test("defaults to square for a square source", () => {
    expect(defaultVideoSizes(1080, 1080)).toEqual(["1080x1080"])
  })
})

describe("base ratio helpers", () => {
  test("falls back to the full base ratio set when a model has no explicit sizes", () => {
    expect(supportedBaseRatios([]).map((ratio) => ratio.id)).toEqual(
      baseRatios.map((ratio) => ratio.id),
    )
    expect(supportedBaseRatios(["auto"]).map((ratio) => ratio.id)).toEqual(
      baseRatios.map((ratio) => ratio.id),
    )
  })

  test("filters base ratios to model-supported and crop-backed sizes", () => {
    expect(
      supportedBaseRatios(["1:1", "16:9", "9:16"]).map((ratio) => ratio.id),
    ).toEqual(["1:1", "16:9", "9:16", "2:1", "6:5"])
  })

  test("always offers crop-backed sizes for a recognized model ratio", () => {
    expect(supportedBaseRatios(["1:1"]).map((ratio) => ratio.id)).toEqual([
      "1:1",
      "2:1",
      "6:5",
    ])
  })

  test("falls back to every base ratio when model metadata is unrecognized", () => {
    expect(supportedBaseRatios(["not-a-ratio"])).toHaveLength(baseRatios.length)
  })

  test("keeps crop-backed sizes in base-ratio declaration order", () => {
    const cropBackedIds = ["2:1", "6:5"]
    const resultOrder = supportedBaseRatios(["1:1"])
      .map((ratio) => ratio.id)
      .filter((id) => cropBackedIds.includes(id))
    const declarationOrder = baseRatios
      .map((ratio) => ratio.id)
      .filter((id) => cropBackedIds.includes(id))

    expect(resultOrder).toEqual(declarationOrder)
  })

  test("matches equivalent ratio labels from model metadata", () => {
    expect(supportedBaseRatios(["300:157"]).map((ratio) => ratio.id)).toEqual([
      "1.91:1",
      "2:1",
      "6:5",
    ])
  })

  test("chooses the closest available ratio instead of snapping to the first option", () => {
    const current = baseRatios.find((ratio) => ratio.id === "4:5")!
    const options = supportedBaseRatios(["1:1", "3:4", "16:9"])

    expect(nearestBaseRatio(current, options).id).toBe("3:4")
  })

  test("chooses a video size close to the attached source ratio", () => {
    expect(nearestVideoPlacement(1024, 1024)).toBe("1080x1080")
    expect(nearestVideoPlacement(1920, 1080)).toBe("1280x720")
    expect(nearestVideoPlacement(1080, 1920)).toBe("720x1280")
    expect(nearestVideoPlacement(300, 250)).toBe("300x250")
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
