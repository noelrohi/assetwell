import { describe, expect, test } from "bun:test"
import type { HiggsfieldCliStatus } from "@assetwell/desktop-bridge"

import {
  isHiggsfieldLaunchResolved,
  isHiggsfieldSessionReady,
  shouldShowHiggsfieldSignIn,
} from "./session-readiness"

const baseStatus: HiggsfieldCliStatus = {
  installed: true,
  version: "1.0.2",
  executableSource: "bundled",
  bundledVersion: "1.0.2",
  authStatus: "authenticated",
  workspaceStatus: "verified",
  detail: null,
  checkedAt: "2026-07-01T00:00:00.000Z",
}

describe("Higgsfield session readiness", () => {
  test("requires both authentication and a verified workspace before opening the app", () => {
    expect(isHiggsfieldSessionReady(baseStatus)).toBe(true)
    expect(isHiggsfieldLaunchResolved(baseStatus)).toBe(true)

    const missingWorkspace: HiggsfieldCliStatus = {
      ...baseStatus,
      workspaceStatus: "unknown",
      detail: "No workspace selected.",
    }

    expect(isHiggsfieldSessionReady(missingWorkspace)).toBe(false)
    expect(isHiggsfieldLaunchResolved(missingWorkspace)).toBe(false)
  })

  test("resolves to the sign-in screen only for missing CLI or unauthenticated users", () => {
    expect(
      shouldShowHiggsfieldSignIn({
        ...baseStatus,
        authStatus: "unauthenticated",
        workspaceStatus: "unknown",
      }),
    ).toBe(true)

    expect(
      shouldShowHiggsfieldSignIn({
        ...baseStatus,
        installed: false,
        version: null,
        executableSource: "missing",
        authStatus: "unknown",
        workspaceStatus: "unknown",
      }),
    ).toBe(true)

    expect(
      shouldShowHiggsfieldSignIn({
        ...baseStatus,
        authStatus: "unknown",
        workspaceStatus: "unknown",
      }),
    ).toBe(false)
  })
})
