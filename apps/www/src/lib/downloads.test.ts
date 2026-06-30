import { describe, expect, test } from "bun:test"

import {
  pickDownloadReleaseAsset,
  resolveDownloadPlatform,
} from "@assetwell/product/downloads"

const asset = (name: string) => ({
  name,
  browser_download_url: `https://example.com/${name}`,
})

describe("download release asset selection", () => {
  test("picks the macOS installer and ignores updater metadata", () => {
    const picked = pickDownloadReleaseAsset(
      [
        asset("latest-mac.yml"),
        asset("Assetwell-0.0.4.dmg.blockmap"),
        asset("Assetwell-0.0.4.dmg"),
      ],
      "macos",
    )

    expect(picked?.name).toBe("Assetwell-0.0.4.dmg")
  })

  test("does not fall back to an unrelated asset for macOS", () => {
    const picked = pickDownloadReleaseAsset(
      [asset("Assetwell-0.0.4.exe"), asset("Assetwell-0.0.4-linux.zip")],
      "macos",
    )

    expect(picked).toBeNull()
  })

  test("picks Windows and Linux installers", () => {
    expect(
      pickDownloadReleaseAsset(
        [
          asset("latest.yml"),
          asset("Assetwell-0.0.4.exe.blockmap"),
          asset("Assetwell-0.0.4.exe"),
          asset("Assetwell-0.0.4.dmg"),
        ],
        "windows",
      )?.name,
    ).toBe("Assetwell-0.0.4.exe")
    expect(
      pickDownloadReleaseAsset(
        [
          asset("latest-linux.yml"),
          asset("Assetwell-0.0.4.AppImage.blockmap"),
          asset("Assetwell-0.0.4.AppImage"),
          asset("Assetwell-0.0.4.dmg"),
        ],
        "linux",
      )?.name,
    ).toBe("Assetwell-0.0.4.AppImage")
  })

  test("resolves request aliases and user-agent fallback through the registry", () => {
    expect(resolveDownloadPlatform("darwin", null)).toBe("macos")
    expect(resolveDownloadPlatform(null, "Mozilla/5.0 Windows NT 10.0")).toBe(
      "windows",
    )
    expect(resolveDownloadPlatform(null, "unknown browser")).toBe("macos")
  })
})
