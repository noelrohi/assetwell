import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs"

import { imagePlacements, videoPlacements } from "@/lib/placements"

export const promptFilterValues = ["all", "image", "video"] as const

export const promptFilterParser =
  parseAsStringLiteral(promptFilterValues).withDefault("all")

export const brandMemorySearchParser = parseAsString.withDefault("")

export const creativePreviewSelectionParsers = {
  take: parseAsString,
  placement: parseAsStringLiteral(imagePlacements),
}

export const videoPlacementSelectionParser = parseAsArrayOf(
  parseAsStringLiteral(videoPlacements),
).withDefault(["1280x720"])
