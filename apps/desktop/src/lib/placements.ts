export {
  IMAGE_PLACEMENT_AVAILABILITY_NOTE,
  IMAGE_PLACEMENT_UNAVAILABLE_REASON,
  IMAGE_PLACEMENT_UNAVAILABLE_TOAST,
  PLACEMENT_COMING_SOON_LABEL,
  aspectOf,
  availableImagePlacementSpecs,
  availableImagePlacements,
  formatPlacementSize,
  getImagePlacementSpec,
  getImagePlacementUnavailableLabel,
  getImagePlacementUnavailableReason,
  getPlacementAspectRatio,
  getPlacementSpec,
  imagePlacementSpecs,
  imagePlacements,
  isAvailableImagePlacement,
  isNarrowBannerPlacement,
  isUnavailableImagePlacement,
  nearestVideoPlacement,
  placementSpecs,
  unavailableImagePlacementSpecs,
  unavailableImagePlacements,
  videoPlacementSpecs,
  videoPlacements,
} from "@assetwell/product/placements"
export type {
  AvailableImagePlacement,
  ImagePlacement,
  ImagePlacementSpec,
  Placement,
  PlacementAvailability,
  PlacementSpec,
  PlacementSpecWithId,
  UnavailableImagePlacement,
  VideoPlacement,
} from "@assetwell/product/placements"

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
