# Plan 005: Add 2:1 and 6:5 crop-backed base sizes to the image composer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1821fc8..HEAD -- apps/desktop/src/lib/placements.ts apps/desktop/src/lib/placements.test.ts apps/desktop/src/lib/higgsfield/model-aspect-ratios.ts apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (feature gap requested by maintainer)
- **Planned at**: commit `1821fc8`, 2026-07-15

## Why this matters

The image composer's base-size picker offers 12 aspect ratios, but two of the
app's canonical ad-placement ratios have no base-size equivalent: **2:1**
(the 600×300 "Half banner" placement) and **6:5** (the 300×250 "Medium
rectangle" and 480×400 "Large rectangle" placements). A user who wants to
compose a base creative directly at one of those shapes cannot. The maintainer
confirmed on 2026-07-15 that both sizes should be added.

The subtlety: no Higgsfield model natively renders 2:1 or 6:5, so these must be
**crop-backed** sizes — the model generates at its nearest native ratio and the
Electron host center-crops to the exact requested pixel size. That host crop
already exists and runs on every generation (`postProcessArtifact` →
`normalizeImageToExactSize` in `apps/desktop/electron/higgsfield-cli.ts:997-1064`),
so this plan is renderer-data-only: no Electron changes.

## Current state

Relevant files:

- `apps/desktop/src/lib/placements.ts` — the `baseRatios` list the composer
  offers, and `supportedBaseRatios` which filters it per model.
- `apps/desktop/src/lib/higgsfield/model-aspect-ratios.ts` — fallback ratio
  list sent to the CLI when a model's supported-ratio fetch fails.
- `apps/desktop/src/components/blocks/create/image-composer.tsx` — consumer;
  needs **no changes** (read it to confirm, don't edit).

`apps/desktop/src/lib/placements.ts:40-53` — the current list (note there is no
2:1 and no 6:5 entry):

```ts
export const baseRatios = [
  { id: "1:1", label: "Square", width: 1024, height: 1024 },
  { id: "4:5", label: "Portrait", width: 864, height: 1080 },
  { id: "5:4", label: "Landscape crop", width: 1080, height: 864 },
  { id: "3:4", label: "Tall", width: 768, height: 1024 },
  { id: "4:3", label: "Landscape", width: 1024, height: 768 },
  { id: "2:3", label: "Poster", width: 768, height: 1152 },
  { id: "3:2", label: "Frame", width: 1152, height: 768 },
  { id: "16:9", label: "Wide", width: 1280, height: 720 },
  { id: "9:16", label: "Story", width: 720, height: 1280 },
  { id: "21:9", label: "Cinema wide", width: 1344, height: 576 },
  { id: "9:21", label: "Cinema vertical", width: 576, height: 1344 },
  { id: "1.91:1", label: "Social landscape", width: 1200, height: 628 },
] as const
```

`apps/desktop/src/lib/placements.ts:58-75` — the per-model filter. A ratio is
shown only if the model advertises its id, or advertises a numerically
near-identical ratio; if nothing matches, all sizes are shown as a fallback:

```ts
export function supportedBaseRatios(supportedRatioIds: readonly string[]) {
  const supportedValues = supportedRatioIds.flatMap((id) => {
    const value = ratioIdNumber(id)
    return value ? [value] : []
  })
  const supported = new Set(
    supportedRatioIds.filter((id) => id.trim().length > 0 && id !== "auto"),
  )
  const matches = baseRatios.filter((ratio) => {
    if (supported.has(ratio.id)) return true
    const value = ratioNumber(ratio.width, ratio.height)
    return supportedValues.some(
      (supportedValue) => Math.abs(Math.log(value / supportedValue)) < 0.005,
    )
  })

  return matches.length ? matches : [...baseRatios]
}
```

Because no model advertises 2:1 or 6:5 (the known native ratios are listed in
`HIGGSFIELD_RATIOS`, `apps/desktop/src/lib/higgsfield/model-aspect-ratios.ts:22-37`,
and the nearest natives — 16:9 ≈ 1.78 vs 2.0, and 5:4 = 1.25 vs 1.2 — are
outside the 0.005 log tolerance), simply appending entries to `baseRatios`
would leave them permanently hidden. They must bypass the model filter.

`apps/desktop/src/lib/higgsfield/model-aspect-ratios.ts:122-127` — the fallback
list. This is critical: these ids are ultimately fed to
`nearestHiggsfieldRatio` and can end up as the `--aspect_ratio` CLI argument,
which models reject for non-native ratios. `1.91:1` is already excluded for a
related reason; the new crop-backed ids must be excluded too:

```ts
export function fallbackAspectRatios(mediaKind: HiggsfieldMediaKind) {
  if (mediaKind === "video") return ["16:9", "9:16", "1:1", "4:3", "3:4"]
  return baseRatios
    .map((ratio) => ratio.id)
    .filter((ratio) => ratio !== "1.91:1")
}
```

Why generation still produces exact 2:1 / 6:5 output with no Electron change:
`makeCreative` (`apps/desktop/src/lib/higgsfield/generation-actions.ts:167-274`)
sends `aspectRatio: nearestHiggsfieldRatio(request.ratioW, request.ratioH, aspectRatios)`
(a native ratio the model accepts) plus
`outputSize: { width: request.ratioW, height: request.ratioH }`; the host then
center-crops the artifact to `outputSize`. So a 6:5 request generates at 5:4
and is cropped by ~4% per side; a 2:1 request generates at 16:9 and is cropped
vertically by ~11%. That is the accepted trade-off for these sizes.

Repo conventions: TypeScript strict, Bun test files co-located as `*.test.ts`
next to sources (see `apps/desktop/src/lib/placements.test.ts` and
`apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts` — model new tests
after the existing cases in those same files). `as const satisfies` typing for
data tables. Prettier formatting enforced via `bun run fmt:check`.

## Commands you will need

| Purpose       | Command                                                                                                        | Expected on success |
| ------------- | -------------------------------------------------------------------------------------------------------------- | ------------------- |
| Install       | `bun install`                                                                                                  | exit 0              |
| Format check  | `bun run fmt:check`                                                                                            | exit 0              |
| Focused tests | `bun test apps/desktop/src/lib/placements.test.ts apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts` | all pass            |
| All tests     | `bun run test`                                                                                                 | exit 0, all pass    |
| Typecheck     | `bun run typecheck`                                                                                            | exit 0              |
| Lint          | `bun run lint`                                                                                                 | exit 0              |
| Build         | `bun run build`                                                                                                | exit 0              |

Run the full verification order from `CLAUDE.md` at the end: `fmt:check`,
`test`, `typecheck`, `lint`, `build` (lint depends on upstream build via
Turbo — it is not cheap; run it in this order).

## Scope

**In scope** (the only files you should modify):

- `apps/desktop/src/lib/placements.ts`
- `apps/desktop/src/lib/placements.test.ts`
- `apps/desktop/src/lib/higgsfield/model-aspect-ratios.ts`
- `apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts`

**Out of scope** (do NOT touch, even though they look related):

- `packages/product/src/placements.ts` — the placement specs (600×300 etc.)
  already exist there; this plan adds _base composer_ sizes only.
- `apps/desktop/electron/**` — the host crop already handles exact sizing.
- `apps/desktop/src/components/blocks/create/image-composer.tsx` — it renders
  whatever `supportedBaseRatios` returns; no change needed.
- The narrow-banner pipeline (`banner-band.ts`, `NARROW_BANNER_*` constants) —
  2:1 and 6:5 are below the `NARROW_BANNER_MIN_ASPECT = 3` threshold and never
  enter that path.

## Git workflow

- Branch: `advisor/005-image-composer-crop-backed-sizes` off `master`.
- Commit style: conventional commits, e.g. `feat(desktop): add 2:1 and 6:5 base sizes` (matches history: `feat(desktop): add protected video size generation`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the two entries and a crop-backed id set to `placements.ts`

In `apps/desktop/src/lib/placements.ts`, append two entries to `baseRatios`
(after the `1.91:1` entry, keeping the `as const`):

```ts
  { id: "2:1", label: "Half banner", width: 1200, height: 600 },
  { id: "6:5", label: "Rectangle", width: 1080, height: 900 },
```

Below the `baseRatios` declaration, add:

```ts
/**
 * Base sizes no Higgsfield model renders natively. The model generates at its
 * nearest native ratio and the Electron Host center-crops to the exact size
 * (`outputSize` post-processing), so these are always offered regardless of
 * the model's advertised ratios — and must never be sent as `--aspect_ratio`.
 */
export const CROP_BACKED_BASE_RATIO_IDS: ReadonlySet<string> = new Set([
  "2:1",
  "6:5",
])
```

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 2: Make `supportedBaseRatios` always include crop-backed sizes

Still in `apps/desktop/src/lib/placements.ts`, change `supportedBaseRatios` so
that (a) crop-backed entries never participate in model matching, (b) they are
appended to any non-empty match result in list order, and (c) the
"model returned nothing recognizable → show everything" fallback is preserved:

```ts
const matches = baseRatios.filter((ratio) => {
  if (CROP_BACKED_BASE_RATIO_IDS.has(ratio.id)) return false
  if (supported.has(ratio.id)) return true
  const value = ratioNumber(ratio.width, ratio.height)
  return supportedValues.some(
    (supportedValue) => Math.abs(Math.log(value / supportedValue)) < 0.005,
  )
})

if (matches.length === 0) return [...baseRatios]

return baseRatios.filter(
  (ratio) =>
    matches.includes(ratio) || CROP_BACKED_BASE_RATIO_IDS.has(ratio.id),
)
```

**Verify**: `bun test apps/desktop/src/lib/placements.test.ts` → existing tests
pass (if an existing test asserts an exact option list that now legitimately
gains `2:1`/`6:5`, update that assertion — that is the intended behavior
change; anything else failing is a STOP condition).

### Step 3: Exclude crop-backed ids from the CLI fallback ratio list

In `apps/desktop/src/lib/higgsfield/model-aspect-ratios.ts`, update
`fallbackAspectRatios` (the file already imports `baseRatios` from
`@/lib/placements`; extend that import with `CROP_BACKED_BASE_RATIO_IDS`):

```ts
return baseRatios
  .map((ratio) => ratio.id)
  .filter(
    (ratio) => ratio !== "1.91:1" && !CROP_BACKED_BASE_RATIO_IDS.has(ratio),
  )
```

This guarantees `nearestHiggsfieldRatio` can never resolve to `"2:1"` or
`"6:5"` and pass it to the CLI as `--aspect_ratio`.

**Verify**: `bun test apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts` → all pass.

### Step 4: Add tests

In `apps/desktop/src/lib/placements.test.ts` (follow the structure of the
existing `supportedBaseRatios` cases in that file):

1. `supportedBaseRatios(["1:1"])` returns `1:1` plus both `2:1` and `6:5`, and
   nothing else.
2. `supportedBaseRatios(["not-a-ratio"])` returns all `baseRatios.length`
   entries (fallback intact).
3. `supportedBaseRatios([])`… check the existing test for the empty-input
   expectation and keep it consistent (empty input yields no matches → full
   fallback list including the new entries).
4. Order: in the result of case 1, `2:1` and `6:5` appear in `baseRatios`
   declaration order.

In `apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts`:

5. `fallbackAspectRatios("image")` does not contain `"1.91:1"`, `"2:1"`, or
   `"6:5"`, and does contain `"1:1"` and `"16:9"`.
6. `nearestHiggsfieldRatio(1080, 900, fallbackAspectRatios("image"))` returns
   `"5:4"` and `nearestHiggsfieldRatio(1200, 600, fallbackAspectRatios("image"))`
   returns `"16:9"` (documents which native ratio each crop-backed size
   generates from).

**Verify**: `bun test apps/desktop/src/lib/placements.test.ts apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts` → all pass, including the 6 new cases.

### Step 5: Full verification pass

Run, in order: `bun run fmt:check`, `bun run test`, `bun run typecheck`,
`bun run lint`, `bun run build`.

**Verify**: every command exits 0.

## Test plan

Covered by Step 4 (six new unit cases across the two existing test files, using
their existing `describe`/`test` style). No component tests exist for the
composer; the picker change is pure data + pure functions, which the unit tests
cover.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `rg -n "\"2:1\"|\"6:5\"" apps/desktop/src/lib/placements.ts` shows both new `baseRatios` entries and the `CROP_BACKED_BASE_RATIO_IDS` set
- [ ] `bun test apps/desktop/src/lib/placements.test.ts apps/desktop/src/lib/higgsfield/model-aspect-ratios.test.ts` → all pass
- [ ] `bun run fmt:check`, `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build` all exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `supportedBaseRatios` or `fallbackAspectRatios` code doesn't match the
  excerpts above (codebase drifted).
- Any _pre-existing_ test fails for a reason other than an exact-list assertion
  that legitimately gains the two new entries.
- You find any code path where a `baseRatios` id is passed to
  `bridge.generate` / the CLI as `aspectRatio` **without** going through
  `nearestHiggsfieldRatio` — that would send `2:1`/`6:5` to a model that
  rejects it. (At planning time the only path is
  `makeCreative` → `nearestHiggsfieldRatio`, which is safe.)
- The fix appears to require touching `packages/product` or `apps/desktop/electron`.

## Maintenance notes

- Any future crop-backed size (a shape no model renders natively) should be
  added to both `baseRatios` and `CROP_BACKED_BASE_RATIO_IDS`; forgetting the
  set means either a hidden option (filter) or a CLI-rejected ratio (fallback).
- Reviewers should scrutinize: that `--aspect_ratio 2:1` can never reach the
  CLI (test case 5/6 guards this), and the preserved fallback semantics of
  `supportedBaseRatios` when a model reports garbage.
- Deferred: a small "crops from 16:9 / 5:4" hint in the picker row UI so users
  understand why edges may be trimmed. Cosmetic; not part of this plan.
