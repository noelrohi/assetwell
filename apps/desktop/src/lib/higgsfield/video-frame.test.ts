import { describe, expect, test } from "bun:test"

import { needsVideoReframe, videoFrameOutputSize } from "./video-frame"

describe("video frame output size", () => {
  test.each([
    [
      { width: 1280, height: 720 },
      { width: 1280, height: 720 },
    ],
    [
      { width: 720, height: 1280 },
      { width: 720, height: 1280 },
    ],
    [
      { width: 1080, height: 1080 },
      { width: 1080, height: 1080 },
    ],
  ])("keeps full-size placements unchanged", (spec, expected) => {
    expect(videoFrameOutputSize(spec)).toEqual(expected)
  })

  test("upscales small placements to an even, high-resolution frame", () => {
    const output = videoFrameOutputSize({ width: 300, height: 250 })

    expect(output).toEqual({ width: 1152, height: 960 })
    expect(Math.min(output.width, output.height)).toBeGreaterThanOrEqual(960)
    expect(output.width % 2).toBe(0)
    expect(output.height % 2).toBe(0)
    expect(output.width / output.height).toBeCloseTo(6 / 5)
  })
})

describe("video reframe detection", () => {
  test("skips reframing when source and target ratios match", () => {
    expect(
      needsVideoReframe({ width: 1280, height: 720 }, { aspectRatio: "16:9" }),
    ).toBe(false)
  })

  test("reframes when source and target ratios differ", () => {
    expect(
      needsVideoReframe({ width: 1280, height: 720 }, { aspectRatio: "9:16" }),
    ).toBe(true)
  })

  test("reframes when source dimensions are missing", () => {
    expect(needsVideoReframe({}, { aspectRatio: "1:1" })).toBe(true)
  })
})
