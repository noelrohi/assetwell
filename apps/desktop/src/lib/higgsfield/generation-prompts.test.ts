import { describe, expect, test } from "bun:test"

import { buildPlacementPrompt } from "./generation-prompts"

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
