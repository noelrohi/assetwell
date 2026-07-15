# Plan 007: Tighten the video composer's size selection

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1821fc8..HEAD -- apps/desktop/src/components/blocks/videos/video-composer.tsx apps/desktop/src/lib/query-state.ts apps/desktop/src/lib/placements.ts apps/desktop/src/lib/placements.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/006-video-reframe-before-animate.md (user-facing copy
  in Step 4 describes 006's re-frame behavior; land 006 first)
- **Category**: dx / UX bug-tightening
- **Planned at**: commit `1821fc8`, 2026-07-15

## Why this matters

The video composer's multi-size selector is the buggiest part of the animate
flow. Its selection lives in the URL (`?sizes=` via nuqs), so stale choices
survive navigation and app sessions; and a "user chose explicitly" ref never
resets, so once the user touches the selector, attaching a _different_ source
image no longer re-defaults the selection to a matching size. The result:
users attach one source and silently generate clips at sizes chosen for a
previous source.

The maintainer considered deleting the selector but decided (2026-07-15) to
**keep multi-select and tighten it**: multi-placement video is core to the
create→resize→video product loop, and with plan 006 landed, mismatched sizes
get a placement-correct frame generated first, so multi-size output is
actually good. Tightening means: plain component state (no URL persistence),
deterministic re-defaulting whenever a source is attached, and honest per-size
labeling of what will happen.

## Current state

Relevant files:

- `apps/desktop/src/components/blocks/videos/video-composer.tsx` — the composer.
- `apps/desktop/src/lib/query-state.ts` — hosts the parser to remove.
- `apps/desktop/src/lib/placements.ts` — where the new default-sizes helper goes.
- `apps/desktop/src/components/blocks/videos/video-placements-panel.tsx` — also
  calls `makeVideos`, but manages its own size list; **not affected**.

`video-composer.tsx:123-130` — the URL-backed state and the sticky ref:

```ts
const [sizes, setSizes] = useQueryState("sizes", videoPlacementSelectionParser)
const sizesWereExplicitlyChosen = React.useRef(
  typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("sizes"),
)
```

`video-composer.tsx:146-167` — the default effect (skipped forever once the
ref is set) and the toggle that sets it:

```ts
React.useEffect(() => {
  if (
    sizesWereExplicitlyChosen.current ||
    !videoDraftSource?.width ||
    !videoDraftSource.height
  ) {
    return
  }

  void setSizes([
    nearestVideoPlacement(videoDraftSource.width, videoDraftSource.height),
  ])
}, [setSizes, videoDraftSource])

function toggleSize(size: VideoPlacement) {
  sizesWereExplicitlyChosen.current = true
  void setSizes((current) =>
    current.includes(size)
      ? current.filter((item) => item !== size)
      : [...current, size],
  )
}
```

`video-composer.tsx:320-339` — the size popover copy and the per-row badge
(shown when the attached source's ratio doesn't match the size):

```tsx
<p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground/75">
  Render one clip per selected size.
</p>
…
{autoFramed && (
  <span className="shrink-0 rounded-full bg-ember/10 px-1.5 py-0.5 text-[0.55rem] font-medium text-ember">
    auto-frame
  </span>
)}
```

`apps/desktop/src/lib/query-state.ts:17-19` — the parser, whose only consumer
is the composer (verified at planning time with
`rg -l videoPlacementSelectionParser apps/desktop/src` → only
`query-state.ts` and `video-composer.tsx`; nothing navigates to `/videos` with
a `sizes` search param):

```ts
export const videoPlacementSelectionParser = parseAsArrayOf(
  parseAsStringLiteral(videoPlacements),
).withDefault(["1280x720"])
```

`nearestVideoPlacement` lives in `packages/product/src/placements.ts:173-194`
and is re-exported through `apps/desktop/src/lib/placements.ts`; it already
handles invalid dimensions by returning the first spec (`"1280x720"`).

Target behavior (decided by the maintainer):

1. Selection is plain React state, defaulting to `["1280x720"]`.
2. Every time a source is attached (or replaced), the selection resets to the
   single size nearest that source — even if the user had toggled sizes for a
   previous source. Toggles made _after_ attaching persist until the next
   attach. Removing the source (X button) leaves the selection as-is.
3. The popover copy and badge say what actually happens post-006: mismatched
   sizes get a matching frame generated first.

Repo conventions: shadcn-style components in `apps/desktop/src`, Bun tests
co-located; user-facing copy is humane product language (no pipeline jargon).

## Commands you will need

| Purpose       | Command                                            | Expected on success |
| ------------- | -------------------------------------------------- | ------------------- |
| Install       | `bun install`                                      | exit 0              |
| Format check  | `bun run fmt:check`                                | exit 0              |
| Focused tests | `bun test apps/desktop/src/lib/placements.test.ts` | all pass            |
| All tests     | `bun run test`                                     | exit 0              |
| Typecheck     | `bun run typecheck`                                | exit 0              |
| Lint          | `bun run lint`                                     | exit 0              |
| Build         | `bun run build`                                    | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `apps/desktop/src/components/blocks/videos/video-composer.tsx`
- `apps/desktop/src/lib/query-state.ts`
- `apps/desktop/src/lib/placements.ts`
- `apps/desktop/src/lib/placements.test.ts`

**Out of scope** (do NOT touch, even though they look related):

- `apps/desktop/src/lib/higgsfield/**` — generation logic is plan 006.
- `video-placements-panel.tsx` — its "generate remaining sizes" flow computes
  sizes itself and doesn't use the query param.
- The other parsers in `query-state.ts` (`promptFilterParser`,
  `uploadsSearchParser`, `creativePreviewSelectionParsers`) — still in use.
- The duration picker and model picker in the composer.

## Git workflow

- Branch: `advisor/007-video-composer-size-select-tighten` off `master`.
- Conventional commits, e.g. `fix(desktop): tighten video composer size selection`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a `defaultVideoSizes` helper

In `apps/desktop/src/lib/placements.ts` (which already re-exports
`nearestVideoPlacement` and the `VideoPlacement` type from
`@assetwell/product/placements` — import them locally as needed):

```ts
/** Initial size selection for the video composer: the placement nearest the source, else wide. */
export function defaultVideoSizes(
  width?: number,
  height?: number,
): VideoPlacement[] {
  if (!width || !height) return ["1280x720"]
  return [nearestVideoPlacement(width, height)]
}
```

Add tests in `apps/desktop/src/lib/placements.test.ts` (match the file's
existing style): `defaultVideoSizes()` → `["1280x720"]`;
`defaultVideoSizes(720, 1280)` → `["720x1280"]`;
`defaultVideoSizes(1080, 1080)` → `["1080x1080"]`.

**Verify**: `bun test apps/desktop/src/lib/placements.test.ts` → all pass.

### Step 2: Replace the URL state with component state

In `video-composer.tsx`:

1. Replace the `useQueryState` block and the `sizesWereExplicitlyChosen` ref
   (quoted in "Current state") with:

```ts
const [sizes, setSizes] = React.useState<VideoPlacement[]>(() =>
  defaultVideoSizes(videoDraftSource?.width, videoDraftSource?.height),
)
const lastDraftSource = React.useRef(videoDraftSource)
```

2. Replace the default effect with a reset-on-attach effect (object identity is
   the right key: `videoDraftSource` is React state in `higgsfield.tsx`, so a
   new attach is a new object):

```ts
React.useEffect(() => {
  if (videoDraftSource === lastDraftSource.current) return
  lastDraftSource.current = videoDraftSource
  if (!videoDraftSource) return
  setSizes(defaultVideoSizes(videoDraftSource.width, videoDraftSource.height))
}, [videoDraftSource])
```

3. Simplify `toggleSize` (no ref write, no `void` — `setSizes` is now a plain
   state setter):

```ts
function toggleSize(size: VideoPlacement) {
  setSizes((current) =>
    current.includes(size)
      ? current.filter((item) => item !== size)
      : [...current, size],
  )
}
```

4. Remove the now-unused imports: `useQueryState` from `"nuqs"` and
   `videoPlacementSelectionParser` from `"@/lib/query-state"`; add
   `defaultVideoSizes` to the `@/lib/placements` import. Keep
   `nearestVideoPlacement` only if still referenced (after this step it isn't —
   remove it from the import too).

**Verify**: `bun run typecheck` → exit 0; `rg -n "nuqs|query-state" apps/desktop/src/components/blocks/videos/video-composer.tsx` → no matches.

### Step 3: Delete the orphaned parser

In `apps/desktop/src/lib/query-state.ts`, remove
`videoPlacementSelectionParser` and, if now unused, the `videoPlacements`
import and `parseAsArrayOf` import. Do not touch the other parsers.

**Verify**: `rg -rn "videoPlacementSelectionParser" apps/desktop/src` → no
matches; `bun run typecheck` → exit 0.

### Step 4: Honest per-size copy (depends on 006)

Still in `video-composer.tsx`, in the sizes popover:

1. Description paragraph → two sentences:

```
Render one clip per selected size. Sizes that don’t match your source get a matching frame generated first.
```

2. The mismatch badge text `auto-frame` → `re-frame` (same element and
   classes, text only). The `autoFramed` computation via
   `matchesHiggsfieldRatio` stays as the condition; you may rename the local to
   `reframed` for clarity.

If plan 006 is not yet DONE in `plans/README.md`, STOP before this step and
report — this copy would describe behavior that doesn't exist yet.

**Verify**: `rg -n "auto-frame" apps/desktop/src/components/blocks/videos/video-composer.tsx` → no matches.

### Step 5: Full verification pass

Run, in order: `bun run fmt:check`, `bun run test`, `bun run typecheck`,
`bun run lint`, `bun run build`.

**Verify**: every command exits 0.

## Test plan

- New unit tests for `defaultVideoSizes` (Step 1) in
  `apps/desktop/src/lib/placements.test.ts`, modeled on that file's existing
  cases.
- The composer has no test file today and the remaining change is wiring;
  don't create a component test harness for this plan.
- Manual QA to report: attach a 720×1280 image → selector shows "1 size"
  (720x1280); toggle 1080x1080 on; attach a different 1280×720 image →
  selection resets to 1280x720 only; reload the app on `/videos` → URL has no
  `?sizes=` and the composer defaults cleanly.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `rg -rn "videoPlacementSelectionParser" apps/desktop/src` → no matches
- [ ] `rg -n "useQueryState" apps/desktop/src/components/blocks/videos/video-composer.tsx` → no matches
- [ ] `rg -n "auto-frame" apps/desktop/src/components/blocks/videos/video-composer.tsx` → no matches
- [ ] `bun test apps/desktop/src/lib/placements.test.ts` → all pass, including the new `defaultVideoSizes` cases
- [ ] `bun run fmt:check`, `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build` all exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The composer code doesn't match the "Current state" excerpts (drift — plan
  006's executor may have touched neighboring lines; re-read before editing).
- `videoPlacementSelectionParser` has gained another consumer since planning
  (`rg` finds it outside `query-state.ts`/`video-composer.tsx`).
- Plan 006 is not DONE and you've reached Step 4.
- Removing the nuqs usage breaks something else in the route (e.g. a
  `validateSearch` in the TanStack route definition references `sizes`) —
  check `apps/desktop/src/pages/videos.tsx` and the route tree if typecheck
  complains.

## Maintenance notes

- The selection is now deliberately ephemeral. If deep-linking into the
  composer with preselected sizes is ever wanted, reintroduce it as an
  explicit navigation payload, not silent URL persistence — the silent version
  is what caused the stale-selection bug.
- Reviewers should scrutinize the reset-on-attach effect: it must key on
  `videoDraftSource` object identity, not on width/height values (two
  different sources can share dimensions and should still reset).
- Deferred: richer size rows (label + pixel size like the image composer's
  picker) — cosmetic, not part of the tightening.
