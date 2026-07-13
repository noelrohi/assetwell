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
  test("asks for a top-aligned strip occupying 15% of the working frame", () => {
    const prompt = buildNarrowBannerPlacementPrompt({
      originalPrompt: "A clean headphones product shot",
      placement: "728x90",
      sourceAspectRatio: "16:9",
    })

    expect(prompt).toContain("728x90 web leaderboard")
    expect(prompt).toContain("Use only the supplied source image")
    expect(prompt).toContain("16:9 frame")
    expect(prompt).toContain("only fill the top 15%")
    expect(prompt).toContain("flush against the top edge")
    expect(prompt).toContain("Do not add new logos")
    expect(prompt).toContain("Original brief: A clean headphones product shot")
  })
})
