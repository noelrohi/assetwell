import { parseAsString, parseAsStringLiteral } from "nuqs"

import { imagePlacements } from "@/lib/placements"

export const promptFilterValues = ["all", "image", "video"] as const

export const promptFilterParser =
  parseAsStringLiteral(promptFilterValues).withDefault("all")

export const uploadsSearchParser = parseAsString.withDefault("")

export const creativePreviewSelectionParsers = {
  take: parseAsString,
  placement: parseAsStringLiteral(imagePlacements),
}
