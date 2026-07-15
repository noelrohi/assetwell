import {
  imagePromptLibrary,
  referenceLibrary as seededReferenceLibrary,
  videoPromptLibrary,
} from "@/lib/mock-data"

import type { PromptPreset, ReferenceAsset } from "./types"

export const BASE_CREATIVE_TAKE_COUNT = 1
export const BILLING_URL = "https://higgsfield.ai/billing"
export const HIGGSFIELD_UPLOADS_PAGE_SIZE = 24
export const DEFAULT_VIDEO_MODEL = "kling3_0"
export const DEFAULT_VIDEO_DURATION_SECONDS = 5

/** Image model used to compose a placement-correct frame before animating. */
export const VIDEO_FRAME_PLACEMENT_MODEL = "gpt_image_2"

/** Narrow banners use GPT Image 2's widest supported frame and crop from its top edge. */
export const NARROW_BANNER_PLACEMENT_MODEL = "gpt_image_2"
export const NARROW_BANNER_SOURCE_ASPECT_RATIO = "16:9"

export const seededReferences = seededReferenceLibrary as ReferenceAsset[]

export const shippedImagePrompts = imagePromptLibrary.map((prompt) => ({
  ...prompt,
  kind: "image" as const,
  createdAt: "shipped",
})) satisfies PromptPreset[]

export const shippedVideoPrompts = videoPromptLibrary.map((prompt) => ({
  ...prompt,
  kind: "video" as const,
  createdAt: "shipped",
})) satisfies PromptPreset[]
