import { describe, expect, test } from "bun:test"

import {
  imageExtensionForType,
  imageExtensionFromUrl,
  imageFileName,
  sanitizeDownloadName,
} from "./image-actions"

describe("image actions", () => {
  test("sanitizes download names", () => {
    expect(sanitizeDownloadName("  Spring <Hero>: 01\n")).toBe(
      "Spring -Hero- 01",
    )
    expect(sanitizeDownloadName("...")).toBe("")
    expect(sanitizeDownloadName(`${"a".repeat(90)}.png`)).toHaveLength(80)
  })

  test("derives image filenames from names, URLs, and content types", () => {
    expect(
      imageFileName({
        name: "Spring Hero",
        url: "https://cdn.test/asset.webp",
      }),
    ).toBe("Spring Hero.webp")
    expect(
      imageFileName(
        { name: "Launch Card", url: "assetwell-local://asset/output" },
        "image/jpeg",
      ),
    ).toBe("Launch Card.jpg")
    expect(
      imageFileName({ name: "Logo.PNG", url: "https://cdn.test/ignored.webp" }),
    ).toBe("Logo.PNG")
    expect(imageFileName({ name: "...", url: "not a url" })).toBe(
      "assetwell-image.png",
    )
  })

  test("maps image extensions from URLs and content types", () => {
    expect(imageExtensionFromUrl("https://cdn.test/HERO.JPEG?cache=1")).toBe(
      ".jpeg",
    )
    expect(imageExtensionFromUrl("not a url")).toBeNull()

    expect(imageExtensionForType("image/avif")).toBe(".avif")
    expect(imageExtensionForType("image/gif")).toBe(".gif")
    expect(imageExtensionForType("image/jpeg")).toBe(".jpg")
    expect(imageExtensionForType("image/png")).toBe(".png")
    expect(imageExtensionForType("image/webp")).toBe(".webp")
    expect(imageExtensionForType("text/plain")).toBeNull()
  })
})
