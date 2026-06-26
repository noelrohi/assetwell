import { describe, expect, test } from "bun:test"

import type { HiggsfieldCommandOutputEvent } from "@assetwell/desktop-bridge"

import { friendlyError, friendlyExit, slug, titleFromPrompt } from "./text"

function exitEvent(
  overrides: Pick<HiggsfieldCommandOutputEvent, "exitCode" | "signal">,
): HiggsfieldCommandOutputEvent {
  return {
    runId: "run-1",
    kind: "exit",
    text: "Finished.",
    timestamp: "2026-06-24T00:00:00.000Z",
    ...overrides,
  }
}

describe("Higgsfield text helpers", () => {
  test("returns humane error and exit messages", () => {
    expect(friendlyError(new Error("Use a model first"))).toBe(
      "Use a model first",
    )
    expect(friendlyError("unknown")).toBe(
      "Higgsfield could not finish that request. Try again in a moment.",
    )
    expect(friendlyExit(exitEvent({ exitCode: null, signal: "SIGTERM" }))).toBe(
      "Generation was stopped.",
    )
    expect(friendlyExit(exitEvent({ exitCode: 0, signal: null }))).toBe(
      "Higgsfield finished without returning an output.",
    )
    expect(friendlyExit(exitEvent({ exitCode: 1, signal: null }))).toBe(
      "Higgsfield could not generate this output.",
    )
  })

  test("creates compact titles and filesystem-safe slugs", () => {
    expect(titleFromPrompt("  Short   prompt  ")).toBe("Short prompt")
    expect(
      titleFromPrompt(
        "A very long prompt that should be compacted before it appears in cards",
      ),
    ).toBe("A very long prompt that should be compacte...")
    expect(slug("  Citrus spritz — summer set!!  ")).toBe(
      "citrus-spritz-summer-set",
    )
    expect(slug("!!!")).toBe("creative")
  })
})
