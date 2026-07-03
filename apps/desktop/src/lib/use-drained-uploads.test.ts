import { describe, expect, test } from "bun:test"

import { getUploadDrainDecision } from "./use-drained-uploads"

const baseInput = {
  hasMore: true,
  loadingMore: false,
  requestInFlight: false,
  currentLength: 24,
  previousLength: null,
  stoppedAtLength: null,
  iterationCount: 0,
  maxIterations: 200,
}

describe("getUploadDrainDecision", () => {
  test("drains when more pages are available and no request is active", () => {
    expect(getUploadDrainDecision(baseInput)).toEqual({ action: "drain" })
  })

  test("waits while a provider or hook request is already loading", () => {
    expect(getUploadDrainDecision({ ...baseInput, loadingMore: true })).toEqual(
      { action: "wait" },
    )
    expect(
      getUploadDrainDecision({ ...baseInput, requestInFlight: true }),
    ).toEqual({ action: "wait" })
  })

  test("stops when the provider reports the cursor is exhausted", () => {
    expect(getUploadDrainDecision({ ...baseInput, hasMore: false })).toEqual({
      action: "stop",
      reason: "complete",
    })
  })

  test("keeps draining after a completed request grows the library", () => {
    expect(
      getUploadDrainDecision({
        ...baseInput,
        currentLength: 48,
        previousLength: 24,
        iterationCount: 1,
      }),
    ).toEqual({ action: "drain" })
  })

  test("stops when a completed request makes no progress", () => {
    expect(
      getUploadDrainDecision({
        ...baseInput,
        currentLength: 24,
        previousLength: 24,
        iterationCount: 1,
      }),
    ).toEqual({ action: "stop", reason: "no-progress" })
  })

  test("stops at the defensive iteration cap", () => {
    expect(
      getUploadDrainDecision({ ...baseInput, iterationCount: 200 }),
    ).toEqual({ action: "stop", reason: "max-iterations" })
  })

  test("stays stopped at the same length but re-arms once length changes", () => {
    expect(
      getUploadDrainDecision({ ...baseInput, stoppedAtLength: 24 }),
    ).toEqual({ action: "stop", reason: "stopped" })
    expect(
      getUploadDrainDecision({
        ...baseInput,
        currentLength: 48,
        stoppedAtLength: 24,
      }),
    ).toEqual({ action: "drain" })
  })
})
