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

  test("marks only current launch models as new", () => {
    const models = [
      {
        id: "seedream_v5_pro",
        label: "Seedream 5.0 Pro",
        mediaKind: "image" as const,
        hint: null,
      },
      {
        id: "nano_banana_2_lite",
        label: "Nano Banana 2 Lite",
        mediaKind: "image" as const,
        hint: null,
      },
      {
        id: "gemini_omni",
        label: "Gemini Omni Flash",
        mediaKind: "video" as const,
        hint: null,
      },
    ]

    expect(toModelOptions(models, "image")).toEqual([
      {
        id: "seedream_v5_pro",
        label: "Seedream 5.0 Pro",
        hint: null,
        badges: ["new"],
      },
      {
        id: "nano_banana_2_lite",
        label: "Nano Banana 2 Lite",
        hint: null,
      },
    ])

    expect(toModelOptions(models, "video")).toEqual([
      {
        id: "gemini_omni",
        label: "Gemini Omni Flash",
        hint: null,
      },
    ])
  })

  test("puts new models first when the CLI marks them", () => {
    expect(
      toModelOptions(
        [
          {
            id: "stable-model",
            label: "Stable Model",
            mediaKind: "image",
            hint: null,
          },
          {
            id: "new-model",
            label: "New Model",
            mediaKind: "image",
            hint: null,
            badges: ["new"],
          },
          {
            id: "beta-model",
            label: "Beta Model",
            mediaKind: "image",
            hint: null,
            badges: ["beta"],
          },
        ],
        "image",
      ).map((model) => model.id),
    ).toEqual(["new-model", "stable-model", "beta-model"])
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
