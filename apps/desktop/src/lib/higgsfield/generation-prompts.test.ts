import { describe, expect, test } from "bun:test"

import {
  buildNarrowBannerPlacementPrompt,
  buildPlacementPrompt,
  buildVideoFramePrompt,
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

describe("video frame prompt builder", () => {
  test("includes the placement, aspect ratio, and optional original brief", () => {
    const prompt = buildVideoFramePrompt({
      originalPrompt: "A clean headphones product shot",
      placement: "720x1280",
      aspectRatio: "9:16",
    })

    expect(prompt).toContain("Target size: 720x1280")
    expect(prompt).toContain("Aspect ratio: 9:16")
    expect(prompt).toContain("Original brief: A clean headphones product shot")
  })

  test("omits the original brief when none is available", () => {
    const prompt = buildVideoFramePrompt({
      placement: "1080x1080",
      aspectRatio: "1:1",
    })

    expect(prompt).not.toContain("Original brief:")
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
