// @ts-nocheck
import { describe, expect, test } from "bun:test"

import {
  parseAccountStatus,
  parseGenerationResult,
  parseModelDetails,
  parseModelList,
  parseUpload,
  parseUploadList,
  parseWorkspaceContext,
} from "./higgsfield-output"

describe("higgsfield output parsing", () => {
  test("parses JSON account status", () => {
    const account = parseAccountStatus(
      `{
      "email": "marketing@endlessmotion.ph",
      "credits": 2680.8,
      "subscription_plan_type": "creator"
    }`,
      "2026-06-24T00:00:00.000Z",
    )

    expect(account).toEqual({
      email: "marketing@endlessmotion.ph",
      credits: 2680.8,
      plan: "creator",
      checkedAt: "2026-06-24T00:00:00.000Z",
    })
  })

  test("parses text account status fallback", () => {
    const account = parseAccountStatus(
      "marketing@endlessmotion.ph — creator plan, 2680.8 credits",
      "2026-06-24T00:00:00.000Z",
    )

    expect(account.email).toBe("marketing@endlessmotion.ph")
    expect(account.plan).toBe("creator")
    expect(account.credits).toBe(2680.8)
  })

  test("parses JSON model list", () => {
    const models = parseModelList(
      `[
      {
        "display_name": "Nano Banana Pro",
        "job_set_type": "nano_banana_2",
        "type": "image",
        "is_new": true
      },
      {
        "display_name": "Higgsfield Soul V2",
        "job_type": "text2image_soul_v2",
        "type": "image",
        "badges": ["beta"]
      }
    ]`,
      "image",
    )

    expect(models).toEqual([
      {
        id: "nano_banana_2",
        label: "Nano Banana Pro",
        mediaKind: "image",
        hint: null,
        badges: ["new"],
      },
      {
        id: "text2image_soul_v2",
        label: "Higgsfield Soul V2",
        mediaKind: "image",
        hint: null,
        badges: ["beta"],
      },
    ])
  })

  test("parses model details aspect ratios", () => {
    const details = parseModelDetails(
      `{
        "display_name": "Higgsfield Soul V2",
        "job_type": "text2image_soul_v2",
        "type": "image",
        "params": [
          {
            "name": "aspect_ratio",
            "type": "string",
            "default": "1:1",
            "required": false,
            "enum": ["1:1", "16:9", "9:16", "auto"]
          },
          { "name": "prompt", "type": "string", "required": true }
        ]
      }`,
      "text2image_soul_v2",
      "image",
    )

    expect(details.id).toBe("text2image_soul_v2")
    expect(details.aspectRatios).toEqual(["1:1", "16:9", "9:16"])
    expect(
      details.params.find((param) => param.name === "prompt")?.required,
    ).toBe(true)
  })

  test("parses text model list fallback", () => {
    const models = parseModelList(
      `JOB SET TYPE                NAME                        TYPE
veo3_1_lite                 Google Veo 3.1 Lite         video
kling3_0                    Kling v3.0                  video`,
      "video",
    )

    expect(models.map((model) => model.id)).toEqual(["veo3_1_lite", "kling3_0"])
    expect(models[0].label).toBe("Google Veo 3.1 Lite")
  })

  test("parses workspace list", () => {
    const workspace = parseWorkspaceContext(
      `[
      {
        "id": "54343c6a-aeb7-4499-a546-31bd6c14760c",
        "name": null,
        "plan_type": "creator",
        "credits": 2680.8,
        "is_selected": false,
        "user_role": "owner"
      }
    ]`,
      "2026-06-24T00:00:00.000Z",
    )

    expect(workspace.selected).toBeNull()
    expect(workspace.workspaces[0]).toMatchObject({
      id: "54343c6a-aeb7-4499-a546-31bd6c14760c",
      plan: "creator",
      credits: 2680.8,
      isSelected: false,
      userRole: "owner",
    })
  })

  test("parses upload list responses", () => {
    const result = parseUploadList(
      `{
        "cursor": "1782878629.830526",
        "items": [
          {
            "created_at": "2026-07-01T04:03:49.830526Z",
            "id": "808ccacb-d4be-465e-b02d-432de39b97a8",
            "type": "image",
            "url": "https://cdn.example.com/upload.png"
          }
        ]
      }`,
      "image",
      "2026-07-01T04:04:00.000Z",
    )

    expect(result).toEqual({
      cursor: "1782878629.830526",
      checkedAt: "2026-07-01T04:04:00.000Z",
      items: [
        {
          id: "808ccacb-d4be-465e-b02d-432de39b97a8",
          uploadId: "808ccacb-d4be-465e-b02d-432de39b97a8",
          name: "Upload 808ccacb",
          url: "https://cdn.example.com/upload.png",
          mediaKind: "image",
          createdAt: "2026-07-01T04:03:49.830526Z",
          sizeBytes: null,
        },
      ],
    })
  })

  test("parses direct upload create responses", () => {
    const asset = parseUpload(
      `{
        "id": "808ccacb-d4be-465e-b02d-432de39b97a8",
        "type": "image",
        "url": "https://cdn.example.com/upload.png"
      }`,
      "image",
    )

    expect(asset).toMatchObject({
      id: "808ccacb-d4be-465e-b02d-432de39b97a8",
      uploadId: "808ccacb-d4be-465e-b02d-432de39b97a8",
      name: "Upload 808ccacb",
      url: "https://cdn.example.com/upload.png",
      mediaKind: "image",
    })
  })

  test("extracts generation artifacts from text output", () => {
    const result = parseGenerationResult(
      "Result: https://cdn.example.com/output.png\nSaved /Users/rohi/Assetwell/demo/1200x628.png",
      "image",
    )

    expect(result?.artifacts).toEqual([
      {
        url: "https://cdn.example.com/output.png",
        filePath: null,
        id: null,
        mediaKind: "image",
      },
      {
        url: null,
        filePath: "/Users/rohi/Assetwell/demo/1200x628.png",
        id: null,
        mediaKind: "image",
      },
    ])
  })
})
