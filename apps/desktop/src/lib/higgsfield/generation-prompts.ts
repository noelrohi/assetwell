import type { ImagePlacement, VideoPlacement } from "@/lib/placements"

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

export function buildVideoFramePrompt({
  originalPrompt,
  placement,
  aspectRatio,
}: {
  originalPrompt?: string
  placement: VideoPlacement
  aspectRatio: string
}) {
  return [
    "Recompose this ad creative onto a new canvas. Use only the supplied source image as the visual reference.",
    "Do not add new logos, badges, watermarks, or text. Keep the same brand, subject, message, and overall concept.",
    `Target size: ${placement}. Aspect ratio: ${aspectRatio}. Compose for this exact aspect ratio, extending backgrounds and reflowing the layout so nothing looks cropped, padded, or letterboxed.`,
    "This frame will be animated into a video afterwards, so keep the main subject fully visible with breathing room around it.",
    ...(originalPrompt ? [`Original brief: ${originalPrompt}`] : []),
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
  return [
    `Turn this ad creative into an ultra-wide ${placement} web leaderboard ad. Use only the supplied source image as the visual reference.`,
    `Compose in a ${sourceAspectRatio} frame, but only fill the top 15% of the image. Put the complete banner design flush against the top edge as one full-width horizontal strip. Leave everything below it empty.`,
    "Arrange the key elements side by side inside the top strip: any logo from the source at one end, the headline text large on a single line, and the most recognizable part of the main subject at the other end.",
    "Keep all logos, text, and subjects inside that top strip. Do not place any important content below it.",
    "Do not add new logos, badges, watermarks, or footer/legal strips. Keep the same brand, subject, message, and overall concept.",
    `Original brief: ${originalPrompt}`,
  ].join("\n\n")
}
