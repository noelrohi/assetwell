/**
 * Supported output sizes. Keep this renderer copy in sync with
 * docs/creative-sizes.md.
 *
 * Higgsfield generation currently accepts aspect-ratio params, not exact output
 * dimensions, so some placements still need a post-process step before they can
 * be guaranteed to match these target pixel sizes.
 */

export const imagePlacements = [
  "1200x628",
  "1024x768",
  "768x1024",
  "728x90",
  "320x50",
  "300x250",
  "600x300",
  "480x400",
] as const

export const videoPlacements = [
  "1280x720",
  "720x1280",
  "1080x1080",
  "300x250",
] as const

export type ImagePlacement = (typeof imagePlacements)[number]
export type VideoPlacement = (typeof videoPlacements)[number]
export type Placement = ImagePlacement | VideoPlacement

export type PlacementSpec = {
  width: number
  height: number
  aspectRatio: `${number}:${number}`
  label: string
}

export const placementSpecs: Record<Placement, PlacementSpec> = {
  "1200x628": {
    width: 1200,
    height: 628,
    aspectRatio: "300:157",
    label: "Social landscape",
  },
  "1024x768": {
    width: 1024,
    height: 768,
    aspectRatio: "4:3",
    label: "Landscape",
  },
  "768x1024": {
    width: 768,
    height: 1024,
    aspectRatio: "3:4",
    label: "Portrait",
  },
  "728x90": {
    width: 728,
    height: 90,
    aspectRatio: "364:45",
    label: "Leaderboard",
  },
  "320x50": {
    width: 320,
    height: 50,
    aspectRatio: "32:5",
    label: "Mobile leaderboard",
  },
  "300x250": {
    width: 300,
    height: 250,
    aspectRatio: "6:5",
    label: "Medium rectangle",
  },
  "600x300": {
    width: 600,
    height: 300,
    aspectRatio: "2:1",
    label: "Half banner",
  },
  "480x400": {
    width: 480,
    height: 400,
    aspectRatio: "6:5",
    label: "Large rectangle",
  },
  "1280x720": {
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    label: "Wide video",
  },
  "720x1280": {
    width: 720,
    height: 1280,
    aspectRatio: "9:16",
    label: "Vertical video",
  },
  "1080x1080": {
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    label: "Square video",
  },
}

export function getPlacementSpec(placement: Placement) {
  return placementSpecs[placement]
}

export function getPlacementAspectRatio(placement: Placement) {
  return placementSpecs[placement].aspectRatio
}

/** Aspect-ratio choices offered for the *base* creative in the composer. */
export const baseRatios = [
  { id: "1:1", label: "Square", width: 1024, height: 1024 },
  { id: "4:5", label: "Portrait", width: 864, height: 1080 },
  { id: "3:4", label: "Tall", width: 768, height: 1024 },
  { id: "16:9", label: "Wide", width: 1280, height: 720 },
  { id: "9:16", label: "Story", width: 720, height: 1280 },
  { id: "1.91:1", label: "Social landscape", width: 1200, height: 628 },
] as const

export type BaseRatioId = (typeof baseRatios)[number]["id"]

export function aspectOf(width: number, height: number) {
  return `${width} / ${height}`
}

export function ratioNumber(width: number, height: number) {
  return width / height
}
