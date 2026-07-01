import { describe, expect, test } from "bun:test"

import {
  buildUploadSearchIndex,
  filterUploadSearchIndex,
} from "./uploads-search"
import type { Brand, ReferenceAsset } from "./higgsfield/types"

const brands = [
  { id: "brand-a", name: "Acme" },
  { id: "brand-b", name: "Nimbus" },
] satisfies Brand[]

const references = [
  {
    id: "asset-1",
    name: "Hero Bottle",
    url: "assetwell://hero.png",
    uploadId: "up-hero",
    brandId: "brand-a",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "asset-2",
    name: "Logo Mark",
    url: "assetwell://logo.png",
    uploadId: "up-logo",
    brandId: null,
    modifiedAt: "2026-06-02T00:00:00.000Z",
  },
] satisfies ReferenceAsset[]

describe("Upload search index", () => {
  test("matches upload names, ids, dates, and brand labels", () => {
    const index = buildUploadSearchIndex(references, brands)

    expect(filterUploadSearchIndex(index, "hero")).toEqual([references[0]])
    expect(filterUploadSearchIndex(index, "UP-LOGO")).toEqual([references[1]])
    expect(filterUploadSearchIndex(index, "acme")).toEqual([references[0]])
    expect(filterUploadSearchIndex(index, "unsorted")).toEqual([references[1]])
    expect(filterUploadSearchIndex(index, "2026-06-02")).toEqual([
      references[1],
    ])
  })
})
