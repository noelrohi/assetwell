export type PlacementAvailability = "available" | "coming-soon"

export type PlacementSpec = {
  width: number
  height: number
  aspectRatio: `${number}:${number}`
  label: string
}

export type PlacementSpecWithId<Id extends string = string> = PlacementSpec & {
  id: Id
}

export type ImagePlacementSpec = PlacementSpecWithId & {
  availability: PlacementAvailability
  unavailableReason?: string
  unavailableLabel?: string
}

export const IMAGE_PLACEMENT_UNAVAILABLE_REASON =
  "Coming soon for narrow banner placements."
export const IMAGE_PLACEMENT_UNAVAILABLE_TOAST =
  "This narrow banner size is coming soon."
export const IMAGE_PLACEMENT_AVAILABILITY_NOTE =
  "Narrow banners are coming soon."
export const PLACEMENT_COMING_SOON_LABEL = "Coming soon"

export const imagePlacementSpecs = [
  {
    id: "1200x628",
    width: 1200,
    height: 628,
    aspectRatio: "300:157",
    label: "Social landscape",
    availability: "available",
  },
  {
    id: "1024x768",
    width: 1024,
    height: 768,
    aspectRatio: "4:3",
    label: "Landscape",
    availability: "available",
  },
  {
    id: "768x1024",
    width: 768,
    height: 1024,
    aspectRatio: "3:4",
    label: "Portrait",
    availability: "available",
  },
  {
    id: "728x90",
    width: 728,
    height: 90,
    aspectRatio: "364:45",
    label: "Leaderboard",
    availability: "available",
  },
  {
    id: "320x50",
    width: 320,
    height: 50,
    aspectRatio: "32:5",
    label: "Mobile leaderboard",
    availability: "available",
  },
  {
    id: "300x250",
    width: 300,
    height: 250,
    aspectRatio: "6:5",
    label: "Medium rectangle",
    availability: "available",
  },
  {
    id: "600x300",
    width: 600,
    height: 300,
    aspectRatio: "2:1",
    label: "Half banner",
    availability: "available",
  },
  {
    id: "480x400",
    width: 480,
    height: 400,
    aspectRatio: "6:5",
    label: "Large rectangle",
    availability: "available",
  },
] as const satisfies readonly ImagePlacementSpec[]

type ImagePlacementSpecEntry = (typeof imagePlacementSpecs)[number]
export type ImagePlacement = ImagePlacementSpecEntry["id"]
export type AvailableImagePlacement = Extract<
  ImagePlacementSpecEntry,
  { availability: "available" }
>["id"]
export type UnavailableImagePlacement = Extract<
  ImagePlacementSpecEntry,
  { availability: "coming-soon" }
>["id"]

function isAvailableImagePlacementSpec(
  spec: ImagePlacementSpecEntry,
): spec is Extract<ImagePlacementSpecEntry, { availability: "available" }> {
  return (spec as ImagePlacementSpec).availability === "available"
}

function isUnavailableImagePlacementSpec(
  spec: ImagePlacementSpecEntry,
): spec is Extract<ImagePlacementSpecEntry, { availability: "coming-soon" }> {
  return (spec as ImagePlacementSpec).availability === "coming-soon"
}

export const imagePlacements = imagePlacementSpecs.map(
  (spec) => spec.id,
) as ImagePlacement[]
export const availableImagePlacementSpecs = imagePlacementSpecs.filter(
  isAvailableImagePlacementSpec,
)
export const unavailableImagePlacementSpecs = imagePlacementSpecs.filter(
  isUnavailableImagePlacementSpec,
)
export const availableImagePlacements = availableImagePlacementSpecs.map(
  (spec) => spec.id,
) as ImagePlacement[]
export const unavailableImagePlacements = unavailableImagePlacementSpecs.map(
  (spec: ImagePlacementSpec) => spec.id,
) as ImagePlacement[]

export const videoPlacementSpecs = [
  {
    id: "1280x720",
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    label: "Wide video",
  },
  {
    id: "720x1280",
    width: 720,
    height: 1280,
    aspectRatio: "9:16",
    label: "Vertical video",
  },
  {
    id: "1080x1080",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    label: "Square video",
  },
  {
    id: "300x250",
    width: 300,
    height: 250,
    aspectRatio: "6:5",
    label: "Medium rectangle",
  },
] as const satisfies readonly PlacementSpecWithId[]

type VideoPlacementSpecEntry = (typeof videoPlacementSpecs)[number]
export type VideoPlacement = VideoPlacementSpecEntry["id"]
export type Placement = ImagePlacement | VideoPlacement

export const videoPlacements = videoPlacementSpecs.map(
  (spec) => spec.id,
) as VideoPlacement[]

const imagePlacementSpecsById = Object.fromEntries(
  imagePlacementSpecs.map((spec) => [spec.id, spec]),
) as Record<ImagePlacement, ImagePlacementSpecEntry>

export const placementSpecs = Object.fromEntries(
  [...imagePlacementSpecs, ...videoPlacementSpecs].map((spec) => [
    spec.id,
    spec,
  ]),
) as unknown as Record<Placement, PlacementSpec>

export function getPlacementSpec(placement: Placement) {
  return placementSpecs[placement]
}

export function getPlacementAspectRatio(placement: Placement) {
  return placementSpecs[placement].aspectRatio
}

export function getImagePlacementSpec(placement: ImagePlacement) {
  return imagePlacementSpecsById[placement]
}

export function getImagePlacementUnavailableReason(placement: ImagePlacement) {
  const spec: ImagePlacementSpec = getImagePlacementSpec(placement)
  return spec.availability === "coming-soon"
    ? spec.unavailableReason
    : undefined
}

export function getImagePlacementUnavailableLabel(placement: ImagePlacement) {
  const spec: ImagePlacementSpec = getImagePlacementSpec(placement)
  return spec.availability === "coming-soon" ? spec.unavailableLabel : undefined
}

export function isUnavailableImagePlacement(
  placement: ImagePlacement,
): placement is UnavailableImagePlacement {
  const spec: ImagePlacementSpec = getImagePlacementSpec(placement)
  return spec.availability === "coming-soon"
}

export function isAvailableImagePlacement(
  placement: ImagePlacement,
): placement is AvailableImagePlacement {
  const spec: ImagePlacementSpec = getImagePlacementSpec(placement)
  return spec.availability === "available"
}

/**
 * Placements at least this wide-per-tall cannot be generated at a native
 * Higgsfield aspect ratio (the widest is 21:9); they go through the
 * narrow-banner pipeline instead: the model composes a slim banner strip
 * inside a 21:9 frame and the host crops to the detected strip.
 */
export const NARROW_BANNER_MIN_ASPECT = 3

export function isNarrowBannerPlacement(placement: ImagePlacement) {
  const spec = getImagePlacementSpec(placement)
  return spec.width / spec.height >= NARROW_BANNER_MIN_ASPECT
}

export function formatPlacementSize(placement: Placement) {
  const spec = getPlacementSpec(placement)
  return `${spec.width}×${spec.height}`
}

export function aspectOf(width: number, height: number) {
  return `${width} / ${height}`
}
