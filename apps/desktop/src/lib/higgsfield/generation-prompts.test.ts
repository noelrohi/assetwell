import { describe, expect, test } from "bun:test"

import {
  buildNarrowBannerPlacementPrompt,
  buildPlacementPrompt,
} from "./generation-prompts"

describe("placement prompt builder", () => {
  test("includes the target placement, aspect ratio, source-use guardrails, and original brief", () => {
    const prompt = buildPlacementPrompt({
      originalPrompt: "A clean headphones product shot",
      placement: "300x250",
      aspectRatio: "6:5",
    })

    expect(prompt).toContain("Use only the supplied source image")
    expect(prompt).toContain("Target placement size: 300x250")
    expect(prompt).toContain("Aspect ratio: 6:5")
    expect(prompt).toContain("Do not add new logos")
    expect(prompt).toContain("Original brief: A clean headphones product shot")
  })
})

describe("narrow banner prompt builder", () => {
  test("asks for a letterboxed slim strip the host can detect and crop", () => {
    const prompt = buildNarrowBannerPlacementPrompt({
      originalPrompt: "A clean headphones product shot",
      placement: "728x90",
      sourceAspectRatio: "16:9",
    })

    expect(prompt).toContain("728x90 web leaderboard")
    expect(prompt).toContain("Use only the supplied source image")
    expect(prompt).toContain("flat, uniform, pure magenta")
    expect(prompt).toContain("Everything must stay inside the stripe")
    expect(prompt).toContain("Keep a safe margin inside the stripe")
    expect(prompt).toContain("Do not add new logos")
    expect(prompt).toContain("Original brief: A clean headphones product shot")
  })

  test("sizes the stripe so it always ends up taller than the target ratio", () => {
    // 16:9 frame over 8.09:1 target needs ≥22% before margin; 6.4:1 needs ≥28%.
    expect(
      buildNarrowBannerPlacementPrompt({
        originalPrompt: "brief",
        placement: "728x90",
        sourceAspectRatio: "16:9",
      }),
    ).toContain("about 30% of the image height")
    expect(
      buildNarrowBannerPlacementPrompt({
        originalPrompt: "brief",
        placement: "320x50",
        sourceAspectRatio: "16:9",
      }),
    ).toContain("about 35% of the image height")
    // The wider 21:9 frame needs a proportionally taller stripe.
    expect(
      buildNarrowBannerPlacementPrompt({
        originalPrompt: "brief",
        placement: "728x90",
        sourceAspectRatio: "21:9",
      }),
    ).toContain("about 40% of the image height")
  })
})
