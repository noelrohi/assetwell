// @ts-nocheck
import { describe, expect, test } from "bun:test"

import {
  baseRatios,
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

  test("marks narrow banners as temporarily unavailable", () => {
    expect(isUnavailableImagePlacement("728x90")).toBe(true)
    expect(isUnavailableImagePlacement("320x50")).toBe(true)
    expect(isUnavailableImagePlacement("1200x628")).toBe(false)
  })
})
