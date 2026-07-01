import { describe, expect, test } from "bun:test"

import { HIGGSFIELD_UPLOADS_PAGE_SIZE } from "./higgsfield/constants"

describe("Uploads performance budgets", () => {
  test("keeps the remote Uploads page below the initial grid/image budget", () => {
    expect(HIGGSFIELD_UPLOADS_PAGE_SIZE).toBeLessThanOrEqual(24)
  })
})
