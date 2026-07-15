import type { PlacementSpec } from "@/lib/placements"

import { matchesHiggsfieldRatio } from "./model-aspect-ratios"

/**
 * A frame render below ~1000px would degrade the animated result, so small
 * placements (e.g. 300x250) are generated at an upscaled multiple of the spec
 * and the final video is still exported at the exact placement size.
 */
const MIN_FRAME_EDGE = 960

export function videoFrameOutputSize(
  spec: Pick<PlacementSpec, "width" | "height">,
) {
  const minEdge = Math.min(spec.width, spec.height)
  if (minEdge >= 720) return { width: spec.width, height: spec.height }

  const scale = MIN_FRAME_EDGE / minEdge
  return {
    width: evenDimension(spec.width * scale),
    height: evenDimension(spec.height * scale),
  }
}

export function needsVideoReframe(
  source: { width?: number; height?: number },
  spec: Pick<PlacementSpec, "aspectRatio">,
) {
  if (!source.width || !source.height) return true
  return !matchesHiggsfieldRatio(source.width, source.height, spec.aspectRatio)
}

function evenDimension(value: number) {
  return Math.max(2, Math.round(value / 2) * 2)
}
