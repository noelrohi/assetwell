import { describe, expect, test } from "bun:test"

import { toModelOptions } from "./model-options"

describe("model options", () => {
  test("keeps models matching the requested media kind", () => {
    expect(
      toModelOptions(
        [
          {
            id: "image-model",
            label: "Image Model",
            mediaKind: "image",
            hint: "image",
          },
          {
            id: "video-model",
            label: "Video Model",
            mediaKind: "video",
            hint: "video",
            badges: ["new"],
          },
        ],
        "video",
      ),
    ).toEqual([
      {
        id: "video-model",
        label: "Video Model",
        hint: "video",
        badges: ["new"],
      },
    ])
  })

  test("falls back to every returned model when the CLI does not tag rows", () => {
    expect(
      toModelOptions(
        [
          {
            id: "legacy-a",
            label: "Legacy A",
            mediaKind: "image",
            hint: null,
          },
          {
            id: "legacy-b",
            label: "Legacy B",
            mediaKind: "image",
            hint: "legacy",
          },
        ],
        "video",
      ),
    ).toEqual([
      { id: "legacy-a", label: "Legacy A", hint: null },
      { id: "legacy-b", label: "Legacy B", hint: "legacy" },
    ])
  })
})
