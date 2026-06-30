# Plan 002: Support 728×90 and 320×50 ad sizes via an AI-generated "strip" path

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat e6ba606..HEAD -- packages/product/src/placements.ts apps/desktop/src/lib/higgsfield/generation-actions.ts apps/desktop/src/lib/higgsfield/generation-prompts.ts apps/desktop/src/lib/placements.test.ts apps/desktop/src/lib/higgsfield/generation-prompts.test.ts apps/desktop/src/components/blocks/creative/placements-panel.tsx apps/desktop/src/lib/higgsfield/constants.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction (feature)
- **Planned at**: commit `e6ba606`, 2026-06-29

## Why this matters

Two ad placements — `728x90` (Leaderboard, 8.09:1) and `320x50` (Mobile
leaderboard, 6.40:1) — are gated as "coming soon" and cannot be generated.
They are among the most-requested standard IAB display sizes; every release
they stay gated signals the product can't handle standard inventory.

They were gated for a real reason: **no Higgsfield image model renders wider
than 21:9 (2.33:1)** (verified live against the CLI — `gpt_image_2` caps at
16:9, `nano_banana_2` caps at 21:9, the dedicated `outpaint` model snaps any
wider request back to 21:9). So an 8:1 banner can't be produced in one shot,
and the existing per-placement path (regenerate the hero at the nearest ratio,
then center-crop to exact size) clips the headline/subject when squeezing a
near-square generation down to a thin strip.

The fix in this plan: for these two sizes only, regenerate the base creative as
a **strip-composed 21:9 banner** using `nano_banana_2` (the widest, text-capable,
reference-image model), with a prompt that keeps the headline + subject + logo
in a central horizontal band with plain margins top/bottom. The **existing
center-crop** then yields a full-width strip without clipping, because the
content was deliberately composed into the band. No Electron-host or IPC change
is needed — this rides the current generate→crop pipeline.

(A later plan, 003, adds a "pad / edge-extend" fallback for cases where the
crop still clips. This plan ships the primary path.)

## Current state

Files and their roles:

- `packages/product/src/placements.ts` — **canonical** source of ad-size specs
  (CLAUDE.md: "Supported creative sizes are canonical in placements.ts; update
  that source before duplicating size lists elsewhere"). `apps/desktop/src/lib/placements.ts`
  only re-exports from it. The two banners are marked `availability: "coming-soon"`.
- `apps/desktop/src/lib/higgsfield/generation-actions.ts` — `startPlacementGeneration`
  builds the per-placement generation request.
- `apps/desktop/src/lib/higgsfield/generation-prompts.ts` — `buildPlacementPrompt`,
  the per-placement prompt builder.
- `apps/desktop/src/lib/higgsfield/constants.ts` — shared constants
  (`BILLING_URL`, `BASE_CREATIVE_TAKE_COUNT`).
- `apps/desktop/src/components/blocks/creative/placements-panel.tsx` — renders the
  placement list and an availability note.
- Test files: `apps/desktop/src/lib/placements.test.ts`,
  `apps/desktop/src/lib/higgsfield/generation-prompts.test.ts` (run with `bun:test`).

Current code excerpts (confirm these match before editing):

`packages/product/src/placements.ts:14-18` (the spec type) and `:53-72` (the two gated specs):

```ts
export type ImagePlacementSpec = PlacementSpecWithId & {
  availability: PlacementAvailability
  unavailableReason?: string
  unavailableLabel?: string
}
```

```ts
  {
    id: "728x90",
    width: 728,
    height: 90,
    aspectRatio: "364:45",
    label: "Leaderboard",
    availability: "coming-soon",
    unavailableReason: IMAGE_PLACEMENT_UNAVAILABLE_REASON,
    unavailableLabel: PLACEMENT_COMING_SOON_LABEL,
  },
  {
    id: "320x50",
    width: 320,
    height: 50,
    aspectRatio: "32:5",
    label: "Mobile leaderboard",
    availability: "coming-soon",
    unavailableReason: IMAGE_PLACEMENT_UNAVAILABLE_REASON,
    unavailableLabel: PLACEMENT_COMING_SOON_LABEL,
  },
```

`apps/desktop/src/lib/higgsfield/generation-actions.ts:262-303` (`startPlacementGeneration`):

```ts
  const startPlacementGeneration = React.useCallback(
    async (
      creative: Creative,
      placement: ImagePlacement,
      sourcePath: string,
    ) => {
      const spec = placementSpecs[placement]

      try {
        const outputDirectoryName =
          creative.outputDirectoryName ??
          `${creative.createdAt.slice(0, 10)}-${slug(creative.prompt)}`
        const aspectRatios = await getModelAspectRatios(creative.model, "image")
        const aspectRatio = nearestHiggsfieldRatio(
          spec.width,
          spec.height,
          aspectRatios,
        )

        const run = await startTrackedGeneration(
          {
            model: creative.model,
            prompt: buildPlacementPrompt({
              originalPrompt: creative.prompt,
              placement,
              aspectRatio: spec.aspectRatio,
            }),
            mediaKind: "image",
            assetPath: sourcePath,
            assetMediaKind: "image",
            aspectRatio,
            outputDirectoryName,
            outputFileName: `${placement}.png`,
            outputSize: { width: spec.width, height: spec.height },
            waitForResult: true,
          },
          {
            kind: "placement",
            creativeId: creative.id,
            placement,
          },
        )
        // ... setCreatives(...) on success
```

`apps/desktop/src/lib/higgsfield/generation-prompts.ts` (entire file):

```ts
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
```

`apps/desktop/src/components/blocks/creative/placements-panel.tsx:103-105` (the availability note, currently shown unconditionally):

```tsx
<p className="px-0.5 text-xs leading-5 text-muted-foreground">
  {IMAGE_PLACEMENT_AVAILABILITY_NOTE}
</p>
```

Conventions to follow:

- Specs are declared `as const satisfies readonly ImagePlacementSpec[]` — any new
  field must be added to the `ImagePlacementSpec` type first, or the `satisfies`
  check fails.
- Prompt builders are pure functions returning a `\n\n`-joined string array; mirror
  `buildPlacementPrompt` exactly in shape and export style.
- Tests use `bun:test` (`import { describe, expect, test } from "bun:test"`).
- The model id `nano_banana_2` is a valid Higgsfield `job_set_type` (the generate
  command validates model strings against `/^[a-zA-Z0-9_.:-]+$/`, which it satisfies).

## Commands you will need

| Purpose           | Command                                                               | Expected on success |
| ----------------- | --------------------------------------------------------------------- | ------------------- |
| Format check      | `bun run fmt:check`                                                   | exit 0              |
| Desktop typecheck | `bun --filter @assetwell/desktop typecheck`                           | exit 0, no errors   |
| Product typecheck | `bun --filter @assetwell/product typecheck`                           | exit 0, no errors   |
| Single test file  | `bun test apps/desktop/src/lib/placements.test.ts`                    | all pass            |
| Single test file  | `bun test apps/desktop/src/lib/higgsfield/generation-prompts.test.ts` | all pass            |
| All tests         | `bun run test`                                                        | all pass            |
| Lint              | `bun run lint`                                                        | exit 0              |
| Build             | `bun run build`                                                       | exit 0              |

## Scope

**In scope** (the only files you may modify):

- `packages/product/src/placements.ts`
- `apps/desktop/src/lib/higgsfield/generation-prompts.ts`
- `apps/desktop/src/lib/higgsfield/generation-prompts.test.ts`
- `apps/desktop/src/lib/higgsfield/generation-actions.ts`
- `apps/desktop/src/lib/higgsfield/constants.ts`
- `apps/desktop/src/lib/placements.test.ts`
- `apps/desktop/src/components/blocks/creative/placements-panel.tsx`

**Out of scope** (do NOT touch):

- `apps/desktop/electron/**` — no Electron-host or IPC change is required for this
  plan; the existing center-crop post-process is reused as-is. (Pad/edge-extend is
  plan 003.)
- `packages/desktop-bridge/**` — the request shape already carries everything needed.
- The generic availability machinery (`isUnavailableImagePlacement`,
  `IMAGE_PLACEMENT_UNAVAILABLE_TOAST`, the `regeneratePlacement` guard) — leave it
  intact for future "coming-soon" sizes; this plan only flips the two banners to
  available and hides the now-stale note.
- `apps/desktop/src/lib/placements.ts` — it is a pure re-export; do not add logic.

## Git workflow

- Branch: `advisor/002-support-ultrawide-banners`
- Commit style: conventional commits (repo uses e.g. `feat(desktop): ...`,
  `chore(release): ...`). Example commit: `feat(desktop): support 728x90 and 320x50 ad sizes`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an `adaptation` field to the image-placement spec type and mark the two banners

In `packages/product/src/placements.ts`:

1a. Extend the spec type (around line 14):

```ts
export type ImagePlacementSpec = PlacementSpecWithId & {
  availability: PlacementAvailability
  /** How the base creative is adapted to this size. "reframe" (default) =
   *  regenerate at nearest ratio then center-crop. "strip" = ultra-wide
   *  banner regenerated as a center-band strip layout (see plan 002). */
  adaptation?: "reframe" | "strip"
  unavailableReason?: string
  unavailableLabel?: string
}
```

1b. Set `adaptation` on **every** entry in `imagePlacementSpecs`. This is required:
`imagePlacementSpecs` is declared `as const`, so `getImagePlacementSpec(...).adaptation`
(used in Step 4) only typechecks if the property exists on _every_ member of the
inferred union. Give the six non-banner image specs `adaptation: "reframe"`, and give
the two banners `adaptation: "strip"` plus `availability: "available"` (dropping their
`unavailableReason`/`unavailableLabel`).

So the two banners become:

```ts
  {
    id: "728x90",
    width: 728,
    height: 90,
    aspectRatio: "364:45",
    label: "Leaderboard",
    availability: "available",
    adaptation: "strip",
  },
  {
    id: "320x50",
    width: 320,
    height: 50,
    aspectRatio: "32:5",
    label: "Mobile leaderboard",
    availability: "available",
    adaptation: "strip",
  },
```

and each of the other six image specs (`1200x628`, `1024x768`, `768x1024`, `300x250`,
`600x300`, `480x400`) gets an added `adaptation: "reframe",` line — nothing else about
them changes.

Do NOT add `adaptation` to `videoPlacementSpecs` (those are typed `PlacementSpecWithId`,
not `ImagePlacementSpec`).

Leave the `IMAGE_PLACEMENT_UNAVAILABLE_REASON`, `IMAGE_PLACEMENT_UNAVAILABLE_TOAST`,
`IMAGE_PLACEMENT_AVAILABILITY_NOTE`, and `PLACEMENT_COMING_SOON_LABEL` constants
declared and exported (still referenced elsewhere; removing them is out of scope).

**Verify**: `bun --filter @assetwell/product typecheck` → exit 0.

### Step 2: Add the strip-banner model constant

In `apps/desktop/src/lib/higgsfield/constants.ts`, add:

```ts
/** Widest text-capable, reference-image Higgsfield model (21:9). Used to
 *  regenerate ultra-wide "strip" banner placements — plan 002. */
export const STRIP_BANNER_MODEL = "nano_banana_2"
```

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 3: Add `buildStripPrompt`

In `apps/desktop/src/lib/higgsfield/generation-prompts.ts`, add a second exported
function below `buildPlacementPrompt` (same shape — pure, `\n\n`-joined):

```ts
export function buildStripPrompt({
  originalPrompt,
  placement,
  aspectRatio,
}: {
  originalPrompt: string
  placement: ImagePlacement
  aspectRatio: string
}) {
  return [
    "Redesign this ad creative as an ultra-wide, short horizontal leaderboard banner. Use only the supplied source image as the visual reference.",
    "Keep the same brand, subject/mascot, headline text, logo, colors, typography, and overall style. Do not invent new copy.",
    `Target placement size: ${placement}. This is an extremely wide, short strip (aspect ratio ${aspectRatio}).`,
    "Arrange the headline, subject/mascot, and logo in a single horizontal row inside the CENTER horizontal band of the frame. Fill plain, continuous background (matching the creative's existing background) into the top and bottom margins, with nothing important near the top or bottom edges, so the banner can be cropped to a thin strip without losing anything.",
    `Original brief: ${originalPrompt}`,
  ].join("\n\n")
}
```

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 4: Branch `startPlacementGeneration` onto the strip path

In `apps/desktop/src/lib/higgsfield/generation-actions.ts`:

4a. Update imports:

- from `./generation-prompts`: add `buildStripPrompt` →
  `import { buildPlacementPrompt, buildStripPrompt } from "./generation-prompts"`
- from `./constants`: add `STRIP_BANNER_MODEL`.
- from `@/lib/placements`: add `getImagePlacementSpec` to the existing import block.

4b. Inside `startPlacementGeneration`, after `const spec = placementSpecs[placement]`,
compute the strip branch and use it for model / aspectRatio / prompt. Replace the
block from `const aspectRatios = ...` through the `prompt: buildPlacementPrompt({...})`
field so it reads:

```ts
        const imageSpec = getImagePlacementSpec(placement)
        const isStrip = imageSpec.adaptation === "strip"

        const aspectRatio = isStrip
          ? "21:9"
          : nearestHiggsfieldRatio(
              spec.width,
              spec.height,
              await getModelAspectRatios(creative.model, "image"),
            )

        const run = await startTrackedGeneration(
          {
            model: isStrip ? STRIP_BANNER_MODEL : creative.model,
            prompt: isStrip
              ? buildStripPrompt({
                  originalPrompt: creative.prompt,
                  placement,
                  aspectRatio: spec.aspectRatio,
                })
              : buildPlacementPrompt({
                  originalPrompt: creative.prompt,
                  placement,
                  aspectRatio: spec.aspectRatio,
                }),
            mediaKind: "image",
            assetPath: sourcePath,
            assetMediaKind: "image",
            aspectRatio,
            outputDirectoryName,
            outputFileName: `${placement}.png`,
            outputSize: { width: spec.width, height: spec.height },
            waitForResult: true,
          },
```

Leave the rest of the function (the `{ kind: "placement", ... }` tracking arg, the
`setCreatives` success update, the `catch`) unchanged. `outputSize` stays
`{ width, height }` — the existing center-crop post-process is intentional here.

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 5: Hide the now-stale "coming soon" availability note

In `apps/desktop/src/components/blocks/creative/placements-panel.tsx`:

5a. Add `unavailableImagePlacements` to the existing import from `@/lib/placements`.

5b. Wrap the note paragraph (currently lines 103-105) so it only renders when some
placement is actually unavailable:

```tsx
{
  unavailableImagePlacements.length > 0 && (
    <p className="px-0.5 text-xs leading-5 text-muted-foreground">
      {IMAGE_PLACEMENT_AVAILABILITY_NOTE}
    </p>
  )
}
```

(After step 1, `unavailableImagePlacements` is empty, so the note disappears; the
machinery stays for any future coming-soon size.)

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 6: Update the two affected tests

6a. `apps/desktop/src/lib/placements.test.ts` — the test named
`"marks narrow banners as temporarily unavailable"` (lines 40-44) now asserts the
opposite of reality. Replace it with:

```ts
test("treats narrow banners as available", () => {
  expect(isUnavailableImagePlacement("728x90")).toBe(false)
  expect(isUnavailableImagePlacement("320x50")).toBe(false)
  expect(isUnavailableImagePlacement("1200x628")).toBe(false)
})
```

6b. `apps/desktop/src/lib/higgsfield/generation-prompts.test.ts` — add a test for
`buildStripPrompt`. Import it alongside `buildPlacementPrompt`, then add:

```ts
test("strip prompt keeps content in a center band and preserves copy", () => {
  const prompt = buildStripPrompt({
    originalPrompt: "SAYA STARTS HERE bingo ad",
    placement: "728x90",
    aspectRatio: "364:45",
  })

  expect(prompt).toContain("ultra-wide")
  expect(prompt).toContain("CENTER horizontal band")
  expect(prompt).toContain("Do not invent new copy")
  expect(prompt).toContain("Target placement size: 728x90")
  expect(prompt).toContain("Original brief: SAYA STARTS HERE bingo ad")
})
```

**Verify**:
`bun test apps/desktop/src/lib/placements.test.ts apps/desktop/src/lib/higgsfield/generation-prompts.test.ts`
→ all pass.

## Test plan

- Update `placements.test.ts`: flip the availability assertion (Step 6a).
- Add to `generation-prompts.test.ts`: one `buildStripPrompt` case asserting the
  band-composition language, copy-preservation guardrail, target size, and brief
  passthrough (Step 6b). Structural pattern: the existing `buildPlacementPrompt`
  test in the same file.
- Full run: `bun run test` → all pass, including the new strip-prompt test.

## Done criteria

ALL must hold:

- [ ] `bun run fmt:check` exits 0
- [ ] `bun --filter @assetwell/product typecheck` exits 0
- [ ] `bun --filter @assetwell/desktop typecheck` exits 0
- [ ] `bun run test` exits 0; the updated `placements.test.ts` and new
      `buildStripPrompt` test pass
- [ ] `bun run lint` exits 0
- [ ] `bun run build` exits 0
- [ ] `grep -n '"coming-soon"' packages/product/src/placements.ts` returns no matches
- [ ] `grep -n 'adaptation: "strip"' packages/product/src/placements.ts` returns 2 matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `e6ba606`).
- Adding the `adaptation` field breaks the `as const satisfies readonly ImagePlacementSpec[]`
  check in a way not resolved by Step 1a (it should not — the field is optional).
- Typecheck reports that `getImagePlacementSpec` is not exported from `@/lib/placements`
  or that its return type lacks `adaptation` — means the re-export or type wiring
  differs from this plan; report rather than widen scope.
- Any step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file (especially anything
  under `apps/desktop/electron/` — that's plan 003, not this one).

## Maintenance notes

- This plan deliberately reuses the **center-crop** post-process. It relies on the
  strip prompt keeping content inside the center band. If real generations still
  clip the headline/subject, that's the signal to land **plan 003** (pad /
  edge-extend fallback) — do not "fix" it by editing the crop logic here.
- The hardcoded `STRIP_BANNER_MODEL = "nano_banana_2"` is the only model that is
  both ≥21:9 and text/reference-capable today. If Higgsfield adds a wider or better
  banner model, change that one constant.
- Manual validation worth doing before release (needs a logged-in CLI; not part of
  automated checks): generate a base creative, click Generate on 728×90 and 320×50,
  and confirm the headline/subject/logo are intact and not clipped.
- A reviewer should scrutinize: that non-strip placements are completely unchanged
  (the `else` branch must be byte-for-byte equivalent to the prior behavior), and
  that `nano_banana_2` is only used for `adaptation: "strip"` sizes.
