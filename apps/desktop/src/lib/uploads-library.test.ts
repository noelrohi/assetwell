import { describe, expect, test } from "bun:test"

import { isInUploadWorkspace } from "./uploads-library"

describe("Uploads workspace scoping", () => {
  test("treats legacy unscoped library items as Default only", () => {
    expect(isInUploadWorkspace({}, "Default")).toBe(true)
    expect(isInUploadWorkspace({}, "Brand A")).toBe(false)
  })

  test("matches creatives and videos by Uploads workspace id", () => {
    expect(
      isInUploadWorkspace({ uploadWorkspaceId: "Brand A" }, "Brand A"),
    ).toBe(true)
    expect(
      isInUploadWorkspace({ uploadWorkspaceId: "Brand B" }, "Brand A"),
    ).toBe(false)
  })
})
