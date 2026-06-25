import type { ImagePlacement } from "@/lib/placements"

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
