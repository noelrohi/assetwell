// @ts-nocheck
import { describe, expect, test } from "bun:test"

import { detectBannerContentBand } from "./banner-band"

const WIDTH = 64
const HEIGHT = 100

function frame(rowColors: (y: number) => [number, number, number]) {
  const bgra = new Uint8Array(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    const [blue, green, red] = rowColors(y)
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4
      bgra[offset] = blue
      bgra[offset + 1] = green
      bgra[offset + 2] = red
      bgra[offset + 3] = 255
    }
  }
  return bgra
}

function noisyContentRow(): [number, number, number] {
  // Any color far from the filler references; per-row flatness is irrelevant
  // for content rows, only their distance from the filler color matters.
  return [30, 200, 120]
}

describe("banner content band detection", () => {
  test("trims flat filler above and below the composed strip", () => {
    const bgra = frame((y) =>
      y >= 30 && y < 70 ? noisyContentRow() : [255, 0, 255],
    )

    expect(detectBannerContentBand(WIDTH, HEIGHT, bgra)).toEqual({
      top: 30,
      bottom: 70,
    })
  })

  test("handles different filler colors on top and bottom", () => {
    const bgra = frame((y) => {
      if (y < 20) return [255, 0, 255]
      if (y >= 80) return [0, 220, 255]
      return noisyContentRow()
    })

    expect(detectBannerContentBand(WIDTH, HEIGHT, bgra)).toEqual({
      top: 20,
      bottom: 80,
    })
  })

  test("tolerates slight compression noise inside the filler", () => {
    const bgra = frame((y) =>
      y >= 40 && y < 60 ? noisyContentRow() : [250, 4, 251],
    )
    // Nudge a few filler pixels the way lossy round-trips do.
    for (const offset of [4 * 4, (25 * WIDTH + 10) * 4, (90 * WIDTH + 3) * 4]) {
      bgra[offset] = 240
      bgra[offset + 2] = 255
    }

    expect(detectBannerContentBand(WIDTH, HEIGHT, bgra)).toEqual({
      top: 40,
      bottom: 60,
    })
  })

  test("returns null when the frame has no letterbox filler", () => {
    const bgra = frame(() => noisyContentRow())

    expect(detectBannerContentBand(WIDTH, HEIGHT, bgra)).toBeNull()
  })

  test("returns null when the whole frame is filler", () => {
    const bgra = frame(() => [255, 0, 255])

    expect(detectBannerContentBand(WIDTH, HEIGHT, bgra)).toBeNull()
  })

  test("returns null when the detected band is implausibly slim", () => {
    const bgra = frame((y) => (y === 50 ? noisyContentRow() : [255, 0, 255]))

    expect(detectBannerContentBand(WIDTH, HEIGHT, bgra)).toBeNull()
  })

  test("returns null for a truncated bitmap", () => {
    expect(
      detectBannerContentBand(WIDTH, HEIGHT, new Uint8Array(WIDTH * 4)),
    ).toBeNull()
  })
})
