// @ts-nocheck
import { describe, expect, test } from "bun:test"

import {
  baseRatios,
  defaultVideoSizes,
  isNarrowBannerPlacement,
  isNativeBaseRatio,
  isUnavailableImagePlacement,
  nearestVideoPlacement,
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
  test("recognizes a native ratio by exact id", () => {
    const ratio = baseRatios.find((item) => item.id === "1:1")!

    expect(isNativeBaseRatio(ratio, ["1:1"])).toBe(true)
  })

  test("recognizes a native ratio by numeric equivalence", () => {
    const ratio = baseRatios.find((item) => item.id === "1.91:1")!

    expect(isNativeBaseRatio(ratio, ["300:157"])).toBe(true)
  })

  test("rejects a ratio the model does not support", () => {
    const ratio = baseRatios.find((item) => item.id === "2:1")!

    expect(isNativeBaseRatio(ratio, ["1:1", "16:9"])).toBe(false)
  })

  test("rejects a ratio when the supported list is empty", () => {
    const ratio = baseRatios.find((item) => item.id === "1:1")!

    expect(isNativeBaseRatio(ratio, [])).toBe(false)
  })

  test("ignores auto and blank ratio ids", () => {
    const ratio = baseRatios.find((item) => item.id === "1:1")!

    expect(isNativeBaseRatio(ratio, ["auto", "", " "])).toBe(false)
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
