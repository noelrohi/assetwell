# Plan 003: Add a "pad / edge-extend" fallback for ultra-wide banner placements

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report — do not improvise. When done, update
> the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e6ba606..HEAD -- packages/desktop-bridge/src/types.ts apps/desktop/electron/higgsfield-cli.ts apps/desktop/src/lib/higgsfield/generation-actions.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts to the live code before proceeding; on a mismatch,
> STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/002-support-ultrawide-banners.md
- **Category**: direction (feature)
- **Planned at**: commit `e6ba606`, 2026-06-29

## Why this matters

Plan 002 makes the two ultra-wide banners (`728x90`, `320x50`) regenerate as a
strip-composed 21:9 image and then **center-crops** to exact size. The crop is
the right default _when_ the model keeps all content inside the center band, but
it has a known failure mode: if the headline or subject drifts toward the top or
bottom, the crop slices it (verified live — a center 8:1 band through a 21:9
SAYA banner cut off the second line of the headline).

This plan adds the safe fallback the expert panel recommended: a **pad /
edge-extend** mode that fits the whole 21:9 generation by height and fills the
remaining horizontal space by mirroring the adjacent background (first-order
mirror reflection — near-invisible on the soft/solid backgrounds these banners
use). Nothing is ever clipped; the subject and text stay pixel-perfect. The mode
is plumbed through the existing `outputSize` object (no new IPC channel) and
rendered with the **already-bundled ffmpeg** (no new dependency — the host has no
image-compositing/border-fill capability via `nativeImage`).

This plan delivers the **engine + wiring**. A richer user-facing "adjust framing"
control (drag the crop position, toggle crop⇄pad per placement) is intentionally
deferred — see Maintenance notes.

## Current state

Files and roles:

- `packages/desktop-bridge/src/types.ts` — the shared bridge contract.
  `HiggsfieldOutputSize` (lines 133-136) is `{ width, height }` and rides on
  `HiggsfieldGenerateRequest.outputSize` (line 149). It is passed unchanged from
  renderer → IPC → host, so adding a field requires no channel change.
- `apps/desktop/electron/higgsfield-cli.ts` — the Electron host. `postProcessArtifact`
  applies the exact-size step; `normalizeImageToExactSize` does the center-crop;
  `normalizeVideoToExactSize` shows the established ffmpeg-invocation pattern
  (`resolveFfmpegExecutable` + `collectProcessOutput`).
- `apps/desktop/src/lib/higgsfield/generation-actions.ts` — `startPlacementGeneration`
  (modified by plan 002) sets `outputSize: { width, height }`.

Excerpts (confirm before editing):

`packages/desktop-bridge/src/types.ts:133-136`:

```ts
export interface HiggsfieldOutputSize {
  width: number
  height: number
}
```

`apps/desktop/electron/higgsfield-cli.ts:600-617` (`postProcessArtifact`):

```ts
async function postProcessArtifact(
  targetPath: string,
  command: HiggsfieldActionCommand,
) {
  if (!command.outputSize) return

  if (command.resultMediaKind === "image") {
    await writeFile(
      targetPath,
      normalizeImageToExactSize(targetPath, command.outputSize),
    )
    return
  }

  if (command.resultMediaKind === "video") {
    await normalizeVideoToExactSize(targetPath, command.outputSize)
  }
}
```

`apps/desktop/electron/higgsfield-cli.ts:619-655` (`normalizeImageToExactSize` — the
center-crop; the pad function will be a sibling) and `:657-698` (`normalizeVideoToExactSize`

- `resolveFfmpegExecutable`, the ffmpeg pattern to copy):

```ts
async function normalizeVideoToExactSize(
  videoPath: string,
  target: HiggsfieldOutputSize,
) {
  const ffmpegPath = resolveFfmpegExecutable()
  const tempPath = `${videoPath}.${process.pid}.${Date.now()}.tmp.mp4`
  const result = await collectProcessOutput(
    ffmpegPath,
    [
      "-y",
      "-i",
      videoPath,
      "-vf",
      `scale=${target.width}:${target.height}:force_original_aspect_ratio=increase,crop=${target.width}:${target.height}`,
      /* ...codec args... */ tempPath,
    ],
    15 * 60_000,
  )
  if (result.exitCode !== 0) {
    /* cleanup + throw */
  }
  await rename(tempPath, videoPath)
}
```

Conventions:

- `nativeImage` (from electron) is used for image sizing and exposes `.getSize()`
  (`{ width, height }`) — see `normalizeImageToExactSize` at line 623-629.
- ffmpeg is invoked via `resolveFfmpegExecutable()` + `collectProcessOutput(path, args, timeoutMs)`;
  exit code is checked, temp file renamed over the target on success.
- Host tests live under `apps/desktop/electron/*.test.ts` and mock electron via
  `apps/desktop/electron/test-support/electron-mock.ts` (it currently stubs
  `nativeImage` with `crop`/`resize`/`toPNG`). Single host test:
  `bun test apps/desktop/electron/higgsfield-output.test.ts`.

## Commands you will need

| Purpose           | Command                                                    | Expected on success |
| ----------------- | ---------------------------------------------------------- | ------------------- |
| Format check      | `bun run fmt:check`                                        | exit 0              |
| Bridge typecheck  | `bun --filter @assetwell/desktop-bridge typecheck`         | exit 0              |
| Desktop typecheck | `bun --filter @assetwell/desktop typecheck`                | exit 0              |
| Host tests        | `bun test apps/desktop/electron/higgsfield-output.test.ts` | all pass            |
| All tests         | `bun run test`                                             | all pass            |
| Lint              | `bun run lint`                                             | exit 0              |
| Build             | `bun run build`                                            | exit 0              |

## Scope

**In scope**:

- `packages/desktop-bridge/src/types.ts`
- `apps/desktop/electron/higgsfield-cli.ts`
- `apps/desktop/src/lib/higgsfield/generation-actions.ts`
- A new or existing host test file under `apps/desktop/electron/` for the mode-selection test.

**Out of scope**:

- Any renderer UI for choosing crop vs pad / dragging the crop position — deferred
  (see Maintenance notes). Do NOT build a toggle or overlay in this plan.
- `normalizeImageToExactSize` (the crop) — leave it unchanged; pad is a new sibling.
- The `placements.ts` specs and prompts — owned by plan 002.

## Git workflow

- Branch: `advisor/003-banner-pad-fallback`
- Conventional commits, e.g. `feat(desktop): add pad fallback for ultra-wide banners`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add an optional `mode` to `HiggsfieldOutputSize`

In `packages/desktop-bridge/src/types.ts`:

```ts
export interface HiggsfieldOutputSize {
  width: number
  height: number
  /** How to fit the generation to the exact size. "crop" (default) =
   *  center-crop. "pad" = fit by height and mirror-extend the background to
   *  fill width (no clipping) — used for ultra-wide banners. Plan 003. */
  mode?: "crop" | "pad"
}
```

**Verify**: `bun --filter @assetwell/desktop-bridge typecheck` → exit 0.

### Step 2: Implement the pad function in the host

In `apps/desktop/electron/higgsfield-cli.ts`, add a sibling to
`normalizeImageToExactSize` that fits by height and mirror-extends the sides via
ffmpeg. Compute the border widths in JS from the source dimensions (read with
`nativeImage(...).getSize()`), because ffmpeg filter expressions can't easily
derive them:

```ts
async function padImageToExactSize(
  imagePath: string,
  target: HiggsfieldOutputSize,
) {
  const source = nativeImage.createFromPath(imagePath)
  if (source.isEmpty()) {
    throw new Error("Generated image could not be opened for sizing.")
  }
  const { width: srcW, height: srcH } = source.getSize()

  // Fit the whole source by height, then mirror-extend left/right to full width.
  const scaledW = Math.max(
    1,
    Math.round(target.width * 0 + (target.height * srcW) / srcH),
  )
  const fitW = Math.min(target.width, scaledW)
  const borderL = Math.floor((target.width - fitW) / 2)
  const borderR = target.width - fitW - borderL

  const ffmpegPath = resolveFfmpegExecutable()
  const tempPath = `${imagePath}.${process.pid}.${Date.now()}.tmp.png`
  const filter =
    borderL <= 0 && borderR <= 0
      ? `scale=${target.width}:${target.height}`
      : `scale=${fitW}:${target.height},` +
        `pad=${target.width}:${target.height}:${borderL}:0,` +
        `fillborders=left=${borderL}:right=${borderR}:mode=mirror`

  const result = await collectProcessOutput(
    ffmpegPath,
    ["-y", "-i", imagePath, "-vf", filter, "-frames:v", "1", tempPath],
    60_000,
  )
  if (result.exitCode !== 0) {
    await unlink(tempPath).catch(() => undefined)
    throw new Error(
      "Generated banner could not be prepared at the target size.",
    )
  }
  await rename(tempPath, imagePath)
}
```

(The `(target.width * 0) + ...` is just to keep the height-fit math explicit;
`scaledW = round(target.height * srcW / srcH)`. Simplify if you prefer, but keep
the result identical.) Confirm `unlink`, `rename`, `collectProcessOutput`,
`resolveFfmpegExecutable`, and `nativeImage` are already imported in this file —
they are used by neighboring functions; reuse the existing imports.

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 3: Branch `postProcessArtifact` on the mode

Change the image branch of `postProcessArtifact` to honor `mode: "pad"`:

```ts
if (command.resultMediaKind === "image") {
  if (command.outputSize.mode === "pad") {
    await padImageToExactSize(targetPath, command.outputSize)
    return
  }
  await writeFile(
    targetPath,
    normalizeImageToExactSize(targetPath, command.outputSize),
  )
  return
}
```

Note `normalizeImageToExactSize` returns a Buffer written via `writeFile`, whereas
`padImageToExactSize` rewrites the file in place (like the video path) — that
asymmetry is intentional; do not refactor the crop path.

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 4: Let strip placements request pad mode (default stays crop)

In `apps/desktop/src/lib/higgsfield/generation-actions.ts`, `startPlacementGeneration`
(as modified by plan 002): the `outputSize` for a strip placement should be able to
carry the pad mode. For this plan, default strips to **crop** (unchanged behavior)
but make pad reachable by reading an optional mode the caller may set. Minimal change:
leave `outputSize: { width: spec.width, height: spec.height }` as-is. The pad path is
exercised by tests in Step 5 and becomes user-selectable in the deferred UI plan.

If — and only if — you want strips to default to **pad** instead (product may decide
this), change the strip branch's outputSize to:

```ts
            outputSize: {
              width: spec.width,
              height: spec.height,
              ...(isStrip ? { mode: "pad" as const } : {}),
            },
```

Do NOT make this change unless the operator explicitly asked for pad-by-default;
the panel's recommendation is crop-default with pad as fallback. Record which you
did in the PR description.

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 5: Test the mode selection

Add a host test (extend `apps/desktop/electron/higgsfield-output.test.ts` or create
`apps/desktop/electron/post-process.test.ts`) that verifies `postProcessArtifact`
routes `mode: "pad"` to the pad path and the default to the crop path. Mirror the
existing host-test style and the `test-support/electron-mock.ts` mock. Because the
real ffmpeg call is integration-level, assert the **branch selection** (e.g. by
spying that the pad branch is taken when `outputSize.mode === "pad"`), not pixel
output. If the current mock/structure makes the function untestable without
refactoring exported surface, STOP and report rather than exporting internals
broadly.

**Verify**: `bun test apps/desktop/electron/*.test.ts` → all pass.

## Test plan

- New/extended host test asserting: `mode: "pad"` → pad branch; absent/`"crop"` →
  crop branch. Pattern: existing tests in `apps/desktop/electron/higgsfield-output.test.ts`.
- Full run: `bun run test` → all pass.
- Manual (needs logged-in CLI; not automated): generate a 728×90 strip, force pad
  mode, and confirm the full headline+subject are present with mirrored side fill
  and no clipping.

## Done criteria

ALL must hold:

- [ ] `bun run fmt:check` exits 0
- [ ] `bun --filter @assetwell/desktop-bridge typecheck` exits 0
- [ ] `bun --filter @assetwell/desktop typecheck` exits 0
- [ ] `bun run test` exits 0; the new mode-selection test passes
- [ ] `bun run lint` exits 0
- [ ] `bun run build` exits 0
- [ ] `grep -n 'mode === "pad"' apps/desktop/electron/higgsfield-cli.ts` returns a match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back if:

- "Current state" excerpts don't match live code (drift since `e6ba606`) — in
  particular if plan 002 has not yet landed (the strip placements won't exist).
- `fillborders` or `pad` is unavailable in the bundled ffmpeg build
  (run `<ffmpeg> -filters | grep -E 'fillborders|^ . pad'`); if `fillborders` is
  missing, STOP — fall back is a solid-color `pad` using a sampled edge color, which
  is a different design decision for the operator to make.
- The pad function would require importing something not already in the file.
- A verification fails twice after a reasonable fix.
- Testing the branch requires broadly exporting host internals (see Step 5).

## Maintenance notes

- **Deferred follow-up (not this plan):** the user-facing framing control the
  expert panel recommended — auto-result + a one-tap "Adjust framing" overlay
  (drag the crop position, toggle crop⇄pad per placement), labeled "Auto-framed ·
  Tap to adjust", ideally shown in a browser-chrome mock. That is a renderer/UX
  effort (`placement-tile.tsx`, `placements-panel.tsx`, placement state) and should
  be its own plan with design input. This plan only provides the engine it needs.
- The mirror extension is invisible on soft/solid backgrounds but can show
  butterfly-symmetry on backgrounds with a distinctive feature near the edge. If
  that shows up in practice, the next quality step is blurred-cover fill or
  OpenCV/PatchMatch texture synthesis (new dependency) — do not attempt inside this
  plan.
- A reviewer should check: the crop path is byte-for-byte unchanged, the pad path
  never runs for non-strip sizes unless explicitly requested, and the ffmpeg temp
  file is always cleaned up on failure.
