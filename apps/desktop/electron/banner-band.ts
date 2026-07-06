/**
 * Narrow banner generations ask the model to surround a slim banner strip
 * with flat solid filler above and below. The model does not follow the
 * requested proportions or filler color literally, so the host locates the
 * strip by scanning for the flat rows instead of trusting the prompt.
 */

/** Max summed BGR channel distance for a pixel to count as filler. */
const FILLER_CHANNEL_DISTANCE = 60
/** Fraction of sampled pixels in a row that must match the filler color. */
const FILLER_ROW_MIN_FRACTION = 0.98
/** Horizontal sampling stride; filler rows are flat, so no need to read every pixel. */
const SAMPLE_STEP = 2
/** Bands slimmer than this fraction of the frame are treated as detection glitches. */
const MIN_BAND_HEIGHT_FRACTION = 0.05

export interface BannerContentBand {
  top: number
  /** Exclusive lower bound. */
  bottom: number
}

/**
 * Finds the composed content band in a letterboxed banner frame by trimming
 * flat filler rows from the top and bottom edges. `bgra` is the raw bitmap in
 * BGRA row-major order (as produced by Electron's `NativeImage.toBitmap`).
 * Returns null when no filler is present or detection looks unreliable, in
 * which case the caller should fall back to cropping the full frame.
 */
export function detectBannerContentBand(
  width: number,
  height: number,
  bgra: Uint8Array,
): BannerContentBand | null {
  if (width <= 0 || height <= 0 || bgra.length < width * height * 4) {
    return null
  }

  // The model's "solid" fill can drift between the two letterbox zones, so a
  // row counts as filler when it matches either edge's reference color.
  const references = [
    pixelAt(0, width, bgra),
    pixelAt(height - 1, width, bgra),
  ] as const

  let top = 0
  while (top < height && rowIsFiller(top, references, width, bgra)) top += 1

  let bottom = height
  while (bottom > top && rowIsFiller(bottom - 1, references, width, bgra)) {
    bottom -= 1
  }

  const bandHeight = bottom - top
  if (bandHeight <= 0) return null
  if (top === 0 && bottom === height) return null
  if (bandHeight < height * MIN_BAND_HEIGHT_FRACTION) return null

  return { top, bottom }
}

type FillerReference = readonly [blue: number, green: number, red: number]

function pixelAt(
  row: number,
  width: number,
  bgra: Uint8Array,
): FillerReference {
  const offset = row * width * 4
  return [bgra[offset]!, bgra[offset + 1]!, bgra[offset + 2]!]
}

function rowIsFiller(
  row: number,
  references: readonly FillerReference[],
  width: number,
  bgra: Uint8Array,
) {
  const rowOffset = row * width * 4
  let sampled = 0
  let matched = 0
  for (let x = 0; x < width; x += SAMPLE_STEP) {
    const offset = rowOffset + x * 4
    const blue = bgra[offset]!
    const green = bgra[offset + 1]!
    const red = bgra[offset + 2]!
    sampled += 1
    if (
      references.some(
        ([refBlue, refGreen, refRed]) =>
          Math.abs(blue - refBlue) +
            Math.abs(green - refGreen) +
            Math.abs(red - refRed) <
          FILLER_CHANNEL_DISTANCE,
      )
    ) {
      matched += 1
    }
  }

  return sampled > 0 && matched / sampled >= FILLER_ROW_MIN_FRACTION
}
