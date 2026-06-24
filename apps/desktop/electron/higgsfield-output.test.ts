// @ts-nocheck
import { describe, expect, test } from "bun:test"

import {
  parseAccountStatus,
  parseGenerationResult,
  parseModelList,
  parseWorkspaceContext,
} from "./higgsfield-output"

describe("higgsfield output parsing", () => {
  test("parses JSON account status", () => {
    const account = parseAccountStatus(`{
      "email": "marketing@endlessmotion.ph",
      "credits": 2680.8,
      "subscription_plan_type": "creator"
    }`, "2026-06-24T00:00:00.000Z")

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
    const models = parseModelList(`[
      {
        "display_name": "Nano Banana Pro",
        "job_set_type": "nano_banana_2",
        "type": "image"
      },
      {
        "display_name": "Higgsfield Soul V2",
        "job_set_type": "text2image_soul_v2",
        "type": "image"
      }
    ]`, "image")

    expect(models).toEqual([
      {
        id: "nano_banana_2",
        label: "Nano Banana Pro",
        mediaKind: "image",
        hint: "image model",
      },
      {
        id: "text2image_soul_v2",
        label: "Higgsfield Soul V2",
        mediaKind: "image",
        hint: "image model",
      },
    ])
  })

  test("parses text model list fallback", () => {
    const models = parseModelList(
      `JOB SET TYPE                NAME                        TYPE
veo3_1_lite                 Google Veo 3.1 Lite         video
kling3_0                    Kling v3.0                  video`,
      "video",
    )

    expect(models.map((model) => model.id)).toEqual([
      "veo3_1_lite",
      "kling3_0",
    ])
    expect(models[0].label).toBe("Google Veo 3.1 Lite")
  })

  test("parses workspace list", () => {
    const workspace = parseWorkspaceContext(`[
      {
        "id": "54343c6a-aeb7-4499-a546-31bd6c14760c",
        "name": null,
        "plan_type": "creator",
        "credits": 2680.8,
        "is_selected": false,
        "user_role": "owner"
      }
    ]`, "2026-06-24T00:00:00.000Z")

    expect(workspace.selected).toBeNull()
    expect(workspace.workspaces[0]).toMatchObject({
      id: "54343c6a-aeb7-4499-a546-31bd6c14760c",
      plan: "creator",
      credits: 2680.8,
      isSelected: false,
      userRole: "owner",
    })
  })

  test("extracts generation artifacts from text output", () => {
    const result = parseGenerationResult(
      "Result: https://cdn.example.com/output.png\nSaved /Users/rohi/Kreeyts/demo/1200x628.png",
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
        filePath: "/Users/rohi/Kreeyts/demo/1200x628.png",
        id: null,
        mediaKind: "image",
      },
    ])
  })
})
