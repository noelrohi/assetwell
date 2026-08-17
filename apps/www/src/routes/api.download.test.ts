import { describe, expect, test } from "bun:test"

import type { DownloadRedirectInput } from "../lib/analytics.server"
import { RELEASES_URL } from "../lib/constants"
import { resolveDownloadResponse } from "./api.download"

const release = (assets: string[], tag = "v0.0.16") =>
  new Response(
    JSON.stringify({
      tag_name: tag,
      html_url: `https://github.com/noelrohi/assetwell/releases/tag/${tag}`,
      assets: assets.map((name) => ({
        name,
        browser_download_url: `https://example.com/${name}`,
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  )

const recorder = () => {
  const events: DownloadRedirectInput[] = []

  return {
    events,
    capture: async (input: DownloadRedirectInput) => {
      events.push(input)
    },
  }
}

describe("download redirect route", () => {
  test("redirects macOS to the dmg and records an installer event", async () => {
    const analytics = recorder()

    const response = await resolveDownloadResponse("macos", {
      fetchRelease: async () =>
        release(["latest-mac.yml", "Assetwell-0.0.16.dmg"]),
      capture: analytics.capture,
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe(
      "https://example.com/Assetwell-0.0.16.dmg",
    )
    expect(analytics.events).toEqual([
      {
        platform: "macos",
        releaseTag: "v0.0.16",
        assetName: "Assetwell-0.0.16.dmg",
        outcome: "installer",
      },
    ])
  })

  test("redirects Windows to the exe and records an installer event", async () => {
    const analytics = recorder()

    const response = await resolveDownloadResponse("windows", {
      fetchRelease: async () =>
        release(["Assetwell-0.0.16.exe.blockmap", "Assetwell-0.0.16.exe"]),
      capture: analytics.capture,
    })

    expect(response.headers.get("Location")).toBe(
      "https://example.com/Assetwell-0.0.16.exe",
    )
    expect(analytics.events[0]?.outcome).toBe("installer")
    expect(analytics.events[0]?.assetName).toBe("Assetwell-0.0.16.exe")
  })

  test("falls back to the release page when no asset matches", async () => {
    const analytics = recorder()

    const response = await resolveDownloadResponse("linux", {
      fetchRelease: async () => release(["Assetwell-0.0.16.dmg"]),
      capture: analytics.capture,
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe(
      "https://github.com/noelrohi/assetwell/releases/tag/v0.0.16",
    )
    expect(analytics.events).toEqual([
      {
        platform: "linux",
        releaseTag: "v0.0.16",
        assetName: null,
        outcome: "fallback",
      },
    ])
  })

  test("falls back when GitHub returns non-OK", async () => {
    const analytics = recorder()

    const response = await resolveDownloadResponse("macos", {
      fetchRelease: async () => new Response("rate limited", { status: 403 }),
      capture: analytics.capture,
    })

    expect(response.headers.get("Location")).toBe(RELEASES_URL)
    expect(analytics.events).toEqual([
      { platform: "macos", outcome: "fallback" },
    ])
  })

  test("falls back when the GitHub request throws", async () => {
    const analytics = recorder()

    const response = await resolveDownloadResponse("macos", {
      fetchRelease: async () => {
        throw new Error("network down")
      },
      capture: analytics.capture,
    })

    expect(response.headers.get("Location")).toBe(RELEASES_URL)
    expect(analytics.events).toEqual([
      { platform: "macos", outcome: "fallback" },
    ])
  })

  test("returns the same redirect when analytics rejects", async () => {
    const response = await resolveDownloadResponse("macos", {
      fetchRelease: async () => release(["Assetwell-0.0.16.dmg"]),
      capture: async () => {
        throw new Error("posthog is down")
      },
    })

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe(
      "https://example.com/Assetwell-0.0.16.dmg",
    )
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })

  test("successful redirects are never publicly cached", async () => {
    const response = await resolveDownloadResponse("macos", {
      fetchRelease: async () => release(["Assetwell-0.0.16.dmg"]),
      capture: async () => {},
    })

    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })
})
