import { describe, expect, test } from "bun:test"

import {
  ANALYTICS_REQUEST_TIMEOUT_MS,
  buildDownloadRedirectEvent,
  captureDownloadRedirect,
  DEFAULT_POSTHOG_HOST,
  normalizeReleaseVersion,
  readAnalyticsConfig,
  resolveDownloadAssetKind,
} from "./analytics.server"

const config = { projectKey: "phc_test", host: DEFAULT_POSTHOG_HOST }

const recordingClient = () => {
  const calls: Array<Record<string, unknown>> = []

  return {
    calls,
    captureImmediate: async (payload: Record<string, unknown>) => {
      calls.push(payload)
    },
  }
}

describe("analytics configuration", () => {
  test("is disabled without a project key", () => {
    expect(readAnalyticsConfig({})).toBeNull()
    expect(readAnalyticsConfig({ POSTHOG_PROJECT_KEY: "   " })).toBeNull()
  })

  test("defaults the host and trims values", () => {
    expect(readAnalyticsConfig({ POSTHOG_PROJECT_KEY: " phc_x " })).toEqual({
      projectKey: "phc_x",
      host: DEFAULT_POSTHOG_HOST,
    })
    expect(
      readAnalyticsConfig({
        POSTHOG_PROJECT_KEY: "phc_x",
        POSTHOG_HOST: "https://eu.i.posthog.com",
      })?.host,
    ).toBe("https://eu.i.posthog.com")
  })

  test("keeps the request timeout at or below one second", () => {
    expect(ANALYTICS_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(1000)
  })
})

describe("download redirect event construction", () => {
  test("normalizes release versions", () => {
    expect(normalizeReleaseVersion("v0.0.16")).toBe("0.0.16")
    expect(normalizeReleaseVersion("0.0.16")).toBe("0.0.16")
    expect(normalizeReleaseVersion(null)).toBe("unknown")
    expect(normalizeReleaseVersion("  ")).toBe("unknown")
  })

  test("maps asset names to coarse kinds", () => {
    expect(resolveDownloadAssetKind("macos", "Assetwell-0.0.16.dmg")).toBe(
      "dmg",
    )
    expect(resolveDownloadAssetKind("windows", "Assetwell-0.0.16.exe")).toBe(
      "exe",
    )
    expect(resolveDownloadAssetKind("linux", "Assetwell-0.0.16.AppImage")).toBe(
      "appimage",
    )
    expect(resolveDownloadAssetKind("macos", null)).toBe("release_page")
    expect(resolveDownloadAssetKind("macos", "Assetwell-0.0.16-mac.zip")).toBe(
      "dmg",
    )
  })

  test("emits exactly the allowlisted properties", () => {
    const event = buildDownloadRedirectEvent({
      platform: "macos",
      releaseTag: "v0.0.16",
      assetName: "Assetwell-0.0.16.dmg",
      outcome: "installer",
    })

    expect(event.event).toBe("download redirected")
    expect(event.properties).toEqual({
      platform: "macos",
      release_version: "0.0.16",
      asset_kind: "dmg",
      outcome: "installer",
      $process_person_profile: false,
    })
    expect(Object.keys(event.properties).sort()).toEqual([
      "$process_person_profile",
      "asset_kind",
      "outcome",
      "platform",
      "release_version",
    ])
  })

  test("a fallback never reports an installer asset kind", () => {
    expect(
      buildDownloadRedirectEvent({
        platform: "windows",
        releaseTag: null,
        assetName: "Assetwell-0.0.16.exe",
        outcome: "fallback",
      }).properties,
    ).toEqual({
      platform: "windows",
      release_version: "unknown",
      asset_kind: "release_page",
      outcome: "fallback",
      $process_person_profile: false,
    })
  })
})

describe("capture", () => {
  test("no-ops when unconfigured", async () => {
    const client = recordingClient()

    const captured = await captureDownloadRedirect(
      { platform: "macos", outcome: "fallback" },
      { config: null, client },
    )

    expect(captured).toBe(false)
    expect(client.calls).toHaveLength(0)
  })

  test("sends an anonymous random distinct ID with GeoIP disabled", async () => {
    const client = recordingClient()

    const captured = await captureDownloadRedirect(
      {
        platform: "linux",
        releaseTag: "v1.2.3",
        assetName: "Assetwell-1.2.3.AppImage",
        outcome: "installer",
      },
      { config, client, newDistinctId: () => "random-id" },
    )

    expect(captured).toBe(true)
    expect(client.calls).toEqual([
      {
        distinctId: "random-id",
        event: "download redirected",
        properties: {
          platform: "linux",
          release_version: "1.2.3",
          asset_kind: "appimage",
          outcome: "installer",
          $process_person_profile: false,
        },
        disableGeoip: true,
      },
    ])
  })

  test("uses a fresh distinct ID per event by default", async () => {
    const client = recordingClient()

    await captureDownloadRedirect(
      { platform: "macos", outcome: "fallback" },
      { config, client },
    )
    await captureDownloadRedirect(
      { platform: "macos", outcome: "fallback" },
      { config, client },
    )

    expect(client.calls[0]?.distinctId).not.toBe(client.calls[1]?.distinctId)
  })

  test("swallows SDK failures", async () => {
    const captured = await captureDownloadRedirect(
      { platform: "macos", outcome: "installer", assetName: "a.dmg" },
      {
        config,
        client: {
          captureImmediate: async () => {
            throw new Error("posthog is down")
          },
        },
      },
    )

    expect(captured).toBe(false)
  })
})
