/**
 * Supported output sizes. Keep this renderer copy in sync with
 * docs/creative-sizes.md.
 *
 * Most Higgsfield image generation accepts aspect-ratio params, not exact output
 * dimensions, so the Electron Host post-processes image artifacts to these
 * exact target pixel sizes before saving them locally.
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

export const unavailableImagePlacements = ["728x90", "320x50"] as const
export const availableImagePlacements = imagePlacements.filter(
  (placement) =>
    !unavailableImagePlacements.includes(
      placement as UnavailableImagePlacement,
    ),
)

export const videoPlacements = [
  "1280x720",
  "720x1280",
  "1080x1080",
  "300x250",
] as const

export type ImagePlacement = (typeof imagePlacements)[number]
export type UnavailableImagePlacement =
  (typeof unavailableImagePlacements)[number]
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

export function isUnavailableImagePlacement(
  placement: ImagePlacement,
): placement is UnavailableImagePlacement {
  return unavailableImagePlacements.includes(
    placement as UnavailableImagePlacement,
  )
}

/** Aspect-ratio choices offered for the *base* creative in the composer. */
export const baseRatios = [
  { id: "1:1", label: "Square", width: 1024, height: 1024 },
  { id: "4:5", label: "Portrait", width: 864, height: 1080 },
  { id: "5:4", label: "Landscape crop", width: 1080, height: 864 },
  { id: "3:4", label: "Tall", width: 768, height: 1024 },
  { id: "4:3", label: "Landscape", width: 1024, height: 768 },
  { id: "2:3", label: "Poster", width: 768, height: 1152 },
  { id: "3:2", label: "Frame", width: 1152, height: 768 },
  { id: "16:9", label: "Wide", width: 1280, height: 720 },
  { id: "9:16", label: "Story", width: 720, height: 1280 },
  { id: "21:9", label: "Cinema wide", width: 1344, height: 576 },
  { id: "9:21", label: "Cinema vertical", width: 576, height: 1344 },
  { id: "1.91:1", label: "Social landscape", width: 1200, height: 628 },
] as const

export type BaseRatio = (typeof baseRatios)[number]
export type BaseRatioId = BaseRatio["id"]

export function supportedBaseRatios(supportedRatioIds: readonly string[]) {
  const supportedValues = supportedRatioIds.flatMap((id) => {
    const value = ratioIdNumber(id)
    return value ? [value] : []
  })
  const supported = new Set(
    supportedRatioIds.filter((id) => id.trim().length > 0 && id !== "auto"),
  )
  const matches = baseRatios.filter((ratio) => {
    if (supported.has(ratio.id)) return true
    const value = ratioNumber(ratio.width, ratio.height)
    return supportedValues.some(
      (supportedValue) => Math.abs(Math.log(value / supportedValue)) < 0.005,
    )
  })

  return matches.length ? matches : [...baseRatios]
}

export function nearestBaseRatio(
  target: BaseRatio,
  options: readonly BaseRatio[] = baseRatios,
) {
  if (options.length === 0) return baseRatios[0]

  const targetValue = ratioNumber(target.width, target.height)
  return options.reduce((best, next) => {
    const bestDistance = Math.abs(
      Math.log(targetValue / ratioNumber(best.width, best.height)),
    )
    const nextDistance = Math.abs(
      Math.log(targetValue / ratioNumber(next.width, next.height)),
    )

    return nextDistance < bestDistance ? next : best
  })
}

export function aspectOf(width: number, height: number) {
  return `${width} / ${height}`
}

export function ratioNumber(width: number, height: number) {
  return width / height
}

function ratioIdNumber(id: string) {
  const match = id.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }

  return width / height
}
