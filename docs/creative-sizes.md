# Creative Sizes

Supported video and image sizes with their aspect ratios. Canonical machine-readable specs live in `packages/product/src/placements.ts`. See the [interactive video size flow](./video-size-flow.html) for a visual walkthrough of native and protected outputs.

## Video output sizes

Assetwell defaults new video jobs to **Kling 3.0 Standard, sound off, 5
seconds**. These are Assetwell output targets, not a claim that every Higgsfield
video model generates every aspect ratio natively. Verified against the live
Higgsfield model schemas on 2026-07-13:

| Size (px)   | Aspect ratio    | Higgsfield native support |
| ----------- | --------------- | ------------------------- |
| 1280 × 720  | 16:9 (≈ 1.78:1) | Broadly supported         |
| 720 × 1280  | 9:16 (≈ 0.56:1) | Broadly supported         |
| 1080 × 1080 | 1:1             | Model-dependent           |
| 300 × 250   | 6:5 (≈ 1.20:1)  | Adapted output only       |

Seedance 2.0 and Kling 3.0 advertise native `16:9`, `9:16`, and `1:1`.
Veo 3/3.1 and Gemini Omni advertise `16:9` and `9:16`, but not `1:1`. No
current Higgsfield video model advertises native `6:5`.

Assetwell compares both the attached source ratio and the selected model's
live schema with the requested output. A newly attached source automatically
selects the closest video size unless the URL already carries an explicit size
selection. When framing is needed, Assetwell places the entire source inside a
target-ratio region over a softly blurred extension of the same image.

If the model natively supports the requested output, that extension remains as
the designed background of the final frame (for example, square source → wide
video). If the model itself needs a different native canvas, the host
center-crops and resizes after generation so the discarded area is the
protective extension rather than the intended composition. This makes `300 ×
250` an Assetwell-supported deliverable rather than a native Higgsfield
generation size; `1080 × 1080` is handled the same way when the chosen model
does not support `1:1`.

Recheck changing model support with `higgsfield model list --video` and
`higgsfield model get <model>`, or consult the
[Higgsfield CLI model catalog](https://github.com/higgsfield-ai/cli/blob/main/MODELS.md).

## Image sizes

`728 × 90` and `320 × 50` are marked **Coming soon**.

| Size (px)  | Aspect ratio       |
| ---------- | ------------------ |
| 1200 × 628 | 300:157 (≈ 1.91:1) |
| 1024 × 768 | 4:3 (≈ 1.33:1)     |
| 768 × 1024 | 3:4 (≈ 0.75:1)     |
| 728 × 90   | 364:45 (≈ 8.09:1)  |
| 320 × 50   | 32:5 (≈ 6.40:1)    |
| 300 × 250  | 6:5 (≈ 1.20:1)     |
| 600 × 300  | 2:1                |
| 480 × 400  | 6:5 (≈ 1.20:1)     |
