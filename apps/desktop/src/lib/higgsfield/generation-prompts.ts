import { placementSpecs, type ImagePlacement } from "@/lib/placements"

export function buildPlacementPrompt({
  originalPrompt,
  placement,
  aspectRatio,
}: {
  originalPrompt: string
  placement: ImagePlacement
  aspectRatio: string
}) {
  return [
    "Create a new placement variant of this ad creative. Use only the supplied source image as the visual reference.",
    "Do not add new logos, badges, watermarks, or footer/legal strips. Keep it to pure visuals and the core message.",
    `Target placement size: ${placement}. Aspect ratio: ${aspectRatio}. Compose for this exact target aspect ratio and keep important content inside a safe area for export.`,
    `Target export aspect ratio is ${aspectRatio}. Keep important content inside the full safe area for that crop.`,
    "Keep the same brand, subject, message, and overall concept. Reflow layout, typography, product cards, and whitespace so it feels native to the target placement.",
    `Original brief: ${originalPrompt}`,
  ].join("\n\n")
}

/**
 * Narrow banners (leaderboards) are wider than any aspect ratio Higgsfield
 * can generate, so the model composes a slim letterboxed strip instead: the
 * flat filler above and below is detected and cropped away by the host
 * before the exact-size export.
 */
export function buildNarrowBannerPlacementPrompt({
  originalPrompt,
  placement,
  sourceAspectRatio,
}: {
  originalPrompt: string
  placement: ImagePlacement
  sourceAspectRatio: string
}) {
  const stripePercent = bannerStripeHeightPercent(placement, sourceAspectRatio)

  return [
    `Turn this ad creative into an ultra-slim horizontal banner, like a ${placement} web leaderboard ad. Use only the supplied source image as the visual reference.`,
    `The banner is a single full-width horizontal stripe, vertically centered, about ${stripePercent}% of the image height. If in doubt make the stripe taller, never slimmer. Arrange the key elements side by side inside the stripe: any logo from the source at one end, the headline text large on a single line, and the most recognizable part of the main subject at the other end.`,
    "Keep a safe margin inside the stripe: no logos, text, or subjects in the outer tenth at each end — only background may touch the stripe's left and right edges, because the sides may be trimmed slightly on export.",
    "Everything must stay inside the stripe. Fill the entire area above and below the stripe with one flat, uniform, pure magenta color (#FF00FF) with hard straight edges. No gradients, objects, shadows, or text in the magenta zones, and no magenta inside the banner design itself.",
    "Do not add new logos, badges, watermarks, or footer/legal strips. Keep the same brand, subject, message, and overall concept.",
    `Original brief: ${originalPrompt}`,
  ].join("\n\n")
}

/**
 * The host trims the letterboxed frame to the stripe, then center-crops the
 * stripe to the exact placement ratio. A stripe drawn taller than the target
 * ratio only loses background in that final crop, but one drawn slimmer is
 * wider than the target and loses content off the sides — so the requested
 * height is the geometric minimum (frame ratio / placement ratio) plus a
 * safety margin, rounded up to the nearest 5%.
 */
function bannerStripeHeightPercent(
  placement: ImagePlacement,
  sourceAspectRatio: string,
) {
  const spec = placementSpecs[placement]
  const frameRatio = parseAspectRatio(sourceAspectRatio) ?? 16 / 9
  const minFraction = (frameRatio / (spec.width / spec.height)) * 1.25

  return Math.min(45, Math.ceil((minFraction * 100) / 5) * 5)
}

function parseAspectRatio(value: string) {
  const match = value.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (!width || !height) return null

  return width / height
}
