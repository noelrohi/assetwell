import { describe, expect, test } from "bun:test"

import { isInBrandView } from "./uploads-library"

const brands = new Set(["brand-a", "brand-b"])

describe("Assetwell brand scoping", () => {
  test("shows every item in the All brands view", () => {
    expect(isInBrandView({}, "all", null, brands)).toBe(true)
    expect(
      isInBrandView({ uploadWorkspaceId: "brand-a" }, "all", null, brands),
    ).toBe(true)
  })

  test("treats legacy and unknown scopes as Unsorted", () => {
    expect(isInBrandView({}, "unsorted", null, brands)).toBe(true)
    expect(
      isInBrandView({ uploadWorkspaceId: "Default" }, "unsorted", null, brands),
    ).toBe(true)
    expect(
      isInBrandView(
        { uploadWorkspaceId: "old-higgsfield-workspace" },
        "unsorted",
        null,
        brands,
      ),
    ).toBe(true)
  })

  test("matches creatives and videos by real Assetwell brand id", () => {
    expect(
      isInBrandView(
        { uploadWorkspaceId: "brand-a" },
        "brand",
        "brand-a",
        brands,
      ),
    ).toBe(true)
    expect(
      isInBrandView(
        { uploadWorkspaceId: "brand-b" },
        "brand",
        "brand-a",
        brands,
      ),
    ).toBe(false)
  })
})
