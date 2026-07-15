# Plan 006: Generate a placement-correct frame before animating mismatched video sizes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1821fc8..HEAD -- apps/desktop/src/lib/higgsfield/ apps/desktop/src/lib/higgsfield.tsx apps/desktop/src/components/blocks/videos/video-gallery.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction (output-quality feature requested by maintainer)
- **Planned at**: commit `1821fc8`, 2026-07-15

## Why this matters

Today, animating an image into a video size whose aspect ratio doesn't match
the source produces mediocre output: the Electron host pads the source onto a
blurred, scaled copy of itself (ffmpeg `gblur` blur-fill), the video model
animates that letterboxed frame, and the host crops the result. The subject
survives but the frame looks like a placeholder — blurred bars instead of real
composition.

The maintainer decided (2026-07-15): for every selected video size that doesn't
match the attached source's aspect ratio, **automatically** generate a
placement-correct still first — an image-model pass that recomposes the
creative for the exact target ratio (the same idea as the existing image
placement pipeline) — and then animate _that_ frame. Slower and one extra image
generation per mismatched size, but the video is composed for its placement
instead of blur-padded. Blur-fill remains only as a silent fallback when the
frame generation fails.

This plan is **renderer-only**. The Electron host's blur-fill
(`protectSourceComposition`) and exact-size video crop stay untouched — they
still handle the residual gap between the target ratio and the video model's
nearest _native_ ratio (e.g. a 300×250 (6:5) clip still animates on a 1:1
native canvas and gets cropped back).

## Current state

### The flow today

`makeVideos` in `apps/desktop/src/lib/higgsfield/generation-actions.ts:538-651`
queues one `VideoResult` per size, then starts one video generation per size,
passing the raw source image. The relevant per-size computation
(`generation-actions.ts:553-595`, abridged):

```ts
const aspectRatios = await getModelAspectRatios(request.model, "video")
const queuedVideos = request.sizes.map((size) => {
  const spec = placementSpecs[size]
  const nativeAspectRatio = nearestHiggsfieldRatio(
    spec.width,
    spec.height,
    aspectRatios,
  )
  const modelNeedsProtection = !matchesHiggsfieldRatio(
    spec.width,
    spec.height,
    nativeAspectRatio,
  )
  const sourceMatchesTarget =
    request.source.width && request.source.height
      ? matchesHiggsfieldRatio(
          request.source.width,
          request.source.height,
          spec.aspectRatio,
        )
      : false
  const sourceCompositionProtected =
    modelNeedsProtection || !sourceMatchesTarget
  return {
    id: `video-${Date.now()}-${size}-…`,
    size,
    status: "pending",
    posterUrl: request.source.url /* … */,
  }
})
```

and the generation start (`generation-actions.ts:599-640`, abridged):

```ts
void Promise.all(
  queuedVideos.map(async (video) => {
    const spec = placementSpecs[video.size]
    try {
      const run = await startTrackedGeneration(
        {
          model: request.model,
          prompt: request.prompt,
          mediaKind: "video",
          assetPath: sourcePath,
          assetMediaKind: "image",
          aspectRatio: video.nativeAspectRatio,
          durationSeconds: request.durationSeconds,
          videoQuality:
            request.model === DEFAULT_VIDEO_MODEL ? "standard" : undefined,
          videoSound: request.model === DEFAULT_VIDEO_MODEL ? false : undefined,
          uploadWorkspaceId: activeUploadWorkspaceId,
          outputDirectoryName,
          outputFileName: `${size}.mp4`,
          outputSize: { width: spec.width, height: spec.height },
          protectSourceComposition: video.sourceCompositionProtected,
          waitForResult: true,
        },
        { kind: "video", videoId },
      )
      setVideos((current) =>
        current.map((v) => (v.id === videoId ? { ...v, runId: run.runId } : v)),
      )
    } catch (error) {
      markRunFailed({ kind: "video", videoId }, friendlyError(error))
    }
  }),
)
```

When `protectSourceComposition` is set and ratios mismatch, the host blur-fills
the source before upload (`apps/desktop/electron/higgsfield-cli.ts:912-955`,
`prepareProtectedSourceComposition` — do not modify).

### Run completion plumbing (what the chaining will build on)

- `startTrackedGeneration` (`generation-actions.ts:156-165`) calls
  `bridge.generate(request)`, registers the returned `runId` in a
  `pendingRuns: Map<string, PendingRun>` ref, and returns immediately.
- Completion arrives via `bridge.onCommandOutput` in
  `apps/desktop/src/lib/higgsfield.tsx:895-929`:

```ts
return bridge.onCommandOutput((event) => {
  // … sign-in/out handling …
  const pending = pendingRuns.current.get(event.runId)
  if (!pending) return

  if (event.kind === "result") {
    completedRuns.current.add(event.runId)
    applyGenerationResult(pending, event)
  }

  if (event.kind === "exit") {
    const succeeded =
      event.exitCode === 0 && completedRuns.current.has(event.runId)
    if (!succeeded) markRunFailed(pending, friendlyExit(event))
    pendingRuns.current.delete(event.runId)
    // …
  }
})
```

- `applyGenerationResult` (`higgsfield.tsx:687-702`) extracts
  `{ url, filePath }` from the first artifact and forwards to the pure
  reducers in `generation-state.ts`:

```ts
const applyGenerationResult = React.useCallback(
  (pending: PendingRun, event: HiggsfieldCommandOutputEvent) => {
    const artifact = event.result?.artifacts[0]
    const url = artifactUrl(artifact)
    if (!url) return

    const result = { url, filePath: artifact?.filePath ?? undefined }
    setCreatives((current) =>
      applyGenerationResultToCreatives(current, pending, result),
    )
    setVideos((current) =>
      applyGenerationResultToVideos(current, pending, result),
    )
  },
  [],
)

const markRunFailed = React.useCallback(
  (pending: PendingRun, error: string) => {
    setCreatives((current) => markRunFailedInCreatives(current, pending, error))
    setVideos((current) => markRunFailedInVideos(current, pending, error))
  },
  [],
)
```

- `PendingRun` (`apps/desktop/src/lib/higgsfield/types.ts:93-99`):

```ts
export interface PendingRun {
  kind: "take" | "placement" | "video"
  creativeId?: string
  takeId?: string
  placement?: ImagePlacement
  videoId?: string
}
```

- The video reducers (`apps/desktop/src/lib/higgsfield/generation-state.ts:67-84`
  and `127-139`) handle only `kind === "video"` today.

### Other facts the executor needs

- `VideoResult` (renderer extension in `types.ts:51-57`) extends
  `SeedVideoResult` (`apps/desktop/src/lib/mock-data.ts:23-40`, which already
  has `posterUrl`, `nativeAspectRatio`, `sourceCompositionProtected`,
  `sourceWidth/Height`). New optional fields go on the `types.ts` interface,
  not on mock-data.
- The image placement pipeline this mirrors: `startPlacementGeneration`
  (`generation-actions.ts:295-374`) generates an image with
  `buildPlacementPrompt` (`apps/desktop/src/lib/higgsfield/generation-prompts.ts:3-20`),
  `assetPath` = source image, `aspectRatio` = nearest native, `outputSize` =
  exact spec — the host center-crops images to `outputSize` automatically.
- Image runs with `waitForResult: true` deliver artifacts with a local
  `filePath` (takes and placements rely on this today).
- `generation-actions.ts` already has `creatives` in scope (used by
  `generateAllPlacements`), so the source creative's prompt/model can be looked
  up via `request.source.creativeId`.
- Video placements and specs: `videoPlacementSpecs` in
  `packages/product/src/placements.ts:134-163` — `1280x720` (16:9), `720x1280`
  (9:16), `1080x1080` (1:1), `300x250` (6:5).
- `makeVideos` is called from two places — the composer
  (`video-composer.tsx`) and the per-video "generate remaining sizes" panel
  (`apps/desktop/src/components/blocks/videos/video-placements-panel.tsx:75-95`).
  Both go through this one function, so both get the new behavior with no
  caller changes.
- The pending overlay in `apps/desktop/src/components/blocks/videos/video-gallery.tsx:100-106`:

```tsx
{pending ? (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30">
    <IconLoader2 className="size-5 animate-spin text-ember" />
    <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground">
      generating
    </span>
  </div>
) : failed ? ( /* … */ )}
```

- Domain language (`CONTEXT.md` / repo convention): user-facing copy uses humane
  product language — never CLI/workspace jargon. "frame" is the product word
  already used for video sources ("source frame" chip in the composer).
- Test convention: Bun tests co-located `*.test.ts`; pure logic is extracted
  into plain modules so it's testable without React (see
  `generation-state.ts` + `generation-state.test.ts` as the exemplar pair).

## Commands you will need

| Purpose       | Command                                                             | Expected on success |
| ------------- | ------------------------------------------------------------------- | ------------------- |
| Install       | `bun install`                                                       | exit 0              |
| Format check  | `bun run fmt:check`                                                 | exit 0              |
| Focused tests | `bun --filter @assetwell/desktop test`                              | all pass            |
| Single file   | `bun test apps/desktop/src/lib/higgsfield/generation-state.test.ts` | all pass            |
| Typecheck     | `bun run typecheck`                                                 | exit 0              |
| Lint          | `bun run lint`                                                      | exit 0              |
| Build         | `bun run build`                                                     | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `apps/desktop/src/lib/higgsfield/types.ts`
- `apps/desktop/src/lib/higgsfield/constants.ts`
- `apps/desktop/src/lib/higgsfield/generation-prompts.ts` (+ its test)
- `apps/desktop/src/lib/higgsfield/generation-state.ts` (+ its test)
- `apps/desktop/src/lib/higgsfield/generation-actions.ts`
- `apps/desktop/src/lib/higgsfield/video-frame.ts` (create) and
  `apps/desktop/src/lib/higgsfield/video-frame.test.ts` (create)
- `apps/desktop/src/lib/higgsfield.tsx` (only the two callbacks shown above)
- `apps/desktop/src/components/blocks/videos/video-gallery.tsx` (pending label only)

**Out of scope** (do NOT touch, even though they look related):

- `apps/desktop/electron/**` — blur-fill and exact-size cropping stay as the
  host-side fallback/finisher; no IPC or bridge contract changes.
- `packages/desktop-bridge/**` — `HiggsfieldGenerateRequest` already supports
  everything needed (image generation with `assetPath` + `outputSize`).
- `video-composer.tsx` / `video-placements-panel.tsx` — callers are unchanged;
  composer UX is plan 007.
- `mock-data.ts` — new fields go on the `types.ts` interfaces.
- The narrow-banner image pipeline (`buildNarrowBannerPlacementPrompt`,
  `banner-band.ts`) — unrelated; video sizes never exceed 21:9.

## Git workflow

- Branch: `advisor/006-video-reframe-before-animate` off `master`.
- Conventional commits, e.g. `feat(desktop): reframe mismatched video sources before animating`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the types

In `apps/desktop/src/lib/higgsfield/types.ts`:

1. `PendingRun`: add the new kind and completion callbacks:

```ts
export interface PendingRun {
  kind: "take" | "placement" | "video" | "video-frame"
  creativeId?: string
  takeId?: string
  placement?: ImagePlacement
  videoId?: string
  /** Called once when the run produces a ready artifact. */
  onReady?: (result: { url: string; filePath?: string }) => void
  /** Called once when the run fails (spawn error or bad exit). */
  onFailed?: (error: string) => void
}
```

2. `VideoResult`: add two optional fields:

```ts
export interface VideoResult extends SeedVideoResult {
  uploadWorkspaceId?: string
  url?: string
  filePath?: string
  runId?: string
  error?: string
  /** Two-step pipeline stage: composing the target frame vs animating it. */
  stage?: "framing" | "animating"
  /** Local path of the generated placement-correct frame, when one was made. */
  framePath?: string
}
```

**Verify**: `bun run typecheck` → exit 0 (nothing consumes the new fields yet).

### Step 2: Fire the callbacks from the run-event handler

In `apps/desktop/src/lib/higgsfield.tsx`, extend the two `useCallback`s quoted
in "Current state" (do not restructure the `onCommandOutput` effect):

- `applyGenerationResult`: after building `result` and calling the two
  `set…` reducers, add `pending.onReady?.(result)`.
- `markRunFailed`: after the two `set…` reducers, add
  `pending.onFailed?.(error)`.

Both callbacks are optional, so every existing call site keeps working.

**Verify**: `bun run typecheck` → exit 0.

### Step 3: Handle `"video-frame"` in the pure video reducers

In `apps/desktop/src/lib/higgsfield/generation-state.ts`:

1. `applyGenerationResultToVideos` — before the existing `kind !== "video"`
   guard, handle the frame result: the video stays `pending`, but its poster
   becomes the composed frame and the stage advances:

```ts
if (pending.kind === "video-frame" && pending.videoId) {
  return videos.map((video) =>
    video.id === pending.videoId
      ? {
          ...video,
          posterUrl: result.url,
          framePath: result.filePath,
          stage: "animating" as const,
        }
      : video,
  )
}
```

2. `markRunFailedInVideos` — a failed frame run must NOT fail the video (the
   caller falls back to the blur-fill path and the video run proceeds). Change
   the guard so `"video-frame"` returns `videos` unchanged:

```ts
if (pending.kind !== "video" || !pending.videoId) return videos
```

(The existing guard already has this exact shape — confirm `"video-frame"`
falls through it untouched; if the guard differs, STOP.)

**Verify**: `bun test apps/desktop/src/lib/higgsfield/generation-state.test.ts` → existing tests pass.

### Step 4: Add the frame-generation prompt and constants

1. In `apps/desktop/src/lib/higgsfield/constants.ts` add (next to the
   `NARROW_BANNER_*` constants):

```ts
/** Image model used to compose a placement-correct frame before animating. */
export const VIDEO_FRAME_PLACEMENT_MODEL = "gpt_image_2"
```

2. In `apps/desktop/src/lib/higgsfield/generation-prompts.ts` add, modeled on
   `buildPlacementPrompt` (same join style, `placement` here is a
   `VideoPlacement` id — import the type from `@/lib/placements`):

```ts
export function buildVideoFramePrompt({
  originalPrompt,
  placement,
  aspectRatio,
}: {
  originalPrompt?: string
  placement: VideoPlacement
  aspectRatio: string
}) {
  return [
    "Recompose this ad creative onto a new canvas. Use only the supplied source image as the visual reference.",
    "Do not add new logos, badges, watermarks, or text. Keep the same brand, subject, message, and overall concept.",
    `Target size: ${placement}. Aspect ratio: ${aspectRatio}. Compose for this exact aspect ratio, extending backgrounds and reflowing the layout so nothing looks cropped, padded, or letterboxed.`,
    "This frame will be animated into a video afterwards, so keep the main subject fully visible with breathing room around it.",
    ...(originalPrompt ? [`Original brief: ${originalPrompt}`] : []),
  ].join("\n\n")
}
```

**Verify**: `bun test apps/desktop/src/lib/higgsfield/generation-prompts.test.ts` → existing tests pass.

### Step 5: Create the pure frame helpers

Create `apps/desktop/src/lib/higgsfield/video-frame.ts`:

```ts
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
```

**Verify**: `bun test apps/desktop/src/lib/higgsfield/video-frame.test.ts` after
writing the tests in the Test plan section → all pass.

### Step 6: Rework `makeVideos` into the two-step pipeline

In `apps/desktop/src/lib/higgsfield/generation-actions.ts`, inside
`makeVideos`:

1. Import `buildVideoFramePrompt`, `VIDEO_FRAME_PLACEMENT_MODEL`,
   `needsVideoReframe`, `videoFrameOutputSize`.
2. When building `queuedVideos`, compute `const reframe = needsVideoReframe(request.source, spec)`
   (this replaces the inline `sourceMatchesTarget` computation — note
   `needsVideoReframe` is its exact negation) and set on each queued entry:
   - `stage: reframe ? ("framing" as const) : ("animating" as const)`
   - keep `sourceCompositionProtected: modelNeedsProtection || reframe`
     (unchanged semantics: it is the blur-fill flag for the _direct_ path and
     the recorded fact shown to the maintainer in debugging).
3. Extract the existing per-video generation block (the
   `startTrackedGeneration({ mediaKind: "video", … })` call plus the `runId`
   update and `catch`) into a local async function:

```ts
async function startVideoRun(
  video: (typeof queuedVideos)[number],
  assetPath: string,
  protectSourceComposition: boolean,
) {
  /* existing body, with assetPath and protectSourceComposition parameterized */
}
```

4. Replace the `Promise.all` body with the branch:

```ts
queuedVideos.map(async (video) => {
  const spec = placementSpecs[video.size]
  if (video.stage !== "framing") {
    await startVideoRun(video, sourcePath, video.sourceCompositionProtected)
    return
  }

  const sourceCreative = request.source.creativeId
    ? creatives.find((item) => item.id === request.source.creativeId)
    : undefined
  const frameModel = sourceCreative?.model ?? VIDEO_FRAME_PLACEMENT_MODEL
  // After reframing, the frame already matches the target ratio; blur-fill is
  // only still needed when the video model has no native ratio for the target.
  const frameStillNeedsProtection = !matchesHiggsfieldRatio(
    spec.width,
    spec.height,
    video.nativeAspectRatio!,
  )
  const fallbackToDirectRun = () =>
    void startVideoRun(video, sourcePath, video.sourceCompositionProtected)

  try {
    const frameRatios = await getModelAspectRatios(frameModel, "image")
    const run = await startTrackedGeneration(
      {
        model: frameModel,
        prompt: buildVideoFramePrompt({
          originalPrompt: sourceCreative?.prompt,
          placement: video.size,
          aspectRatio: spec.aspectRatio,
        }),
        mediaKind: "image",
        assetPath: sourcePath,
        assetMediaKind: "image",
        aspectRatio: nearestHiggsfieldRatio(
          spec.width,
          spec.height,
          frameRatios,
        ),
        uploadWorkspaceId: activeUploadWorkspaceId,
        outputDirectoryName,
        outputFileName: `${video.size}-frame.png`,
        outputSize: videoFrameOutputSize(spec),
        waitForResult: true,
      },
      {
        kind: "video-frame",
        videoId: video.id,
        onReady: (result) => {
          if (result.filePath) {
            void startVideoRun(
              video,
              result.filePath,
              frameStillNeedsProtection,
            )
          } else {
            fallbackToDirectRun()
          }
        },
        onFailed: fallbackToDirectRun,
      },
    )
    setVideos((current) =>
      current.map((item) =>
        item.id === video.id ? { ...item, runId: run.runId } : item,
      ),
    )
  } catch {
    fallbackToDirectRun()
  }
})
```

Notes for correctness:

- `startVideoRun` must keep its own `try/catch` calling
  `markRunFailed({ kind: "video", videoId }, friendlyError(error))` — that is
  the only place a video is marked failed.
- `video.nativeAspectRatio` is set for every queued entry a few lines above;
  the `!` is safe, but if TypeScript objects, thread the value through a local
  instead of asserting.
- Do not `await` the chained `startVideoRun` inside `onReady` (it runs from the
  event handler); fire-and-forget with `void` as shown.

**Verify**: `bun run typecheck` → exit 0, and
`bun --filter @assetwell/desktop test` → all pass.

### Step 7: Surface the stage in the gallery

In `apps/desktop/src/components/blocks/videos/video-gallery.tsx`, change the
pending overlay label (quoted in "Current state") from the literal
`generating` to:

```tsx
{
  video.stage === "framing" ? "preparing frame" : "generating"
}
```

Keep the copy lowercase/mono to match the existing style. No other UI changes.

**Verify**: `bun run typecheck` → exit 0.

### Step 8: Full verification pass

Run, in order: `bun run fmt:check`, `bun run test`, `bun run typecheck`,
`bun run lint`, `bun run build`.

**Verify**: every command exits 0.

## Test plan

- `apps/desktop/src/lib/higgsfield/video-frame.test.ts` (create; model
  structure after `generation-state.test.ts`):
  - `videoFrameOutputSize` returns the spec unchanged for 1280×720, 720×1280,
    1080×1080; returns even, ≥960-min-edge dimensions for 300×250 (expect
    1152×960) preserving the 6:5 ratio within rounding.
  - `needsVideoReframe`: false for a 1280×720 source → 16:9 spec; true for a
    1280×720 source → 9:16 spec; true when source dimensions are missing.
- `apps/desktop/src/lib/higgsfield/generation-state.test.ts` (extend, matching
  existing case style):
  - `applyGenerationResultToVideos` with `kind: "video-frame"` updates
    `posterUrl`, `framePath`, sets `stage: "animating"`, and leaves `status`
    `"pending"`; other videos untouched.
  - `markRunFailedInVideos` with `kind: "video-frame"` returns the input
    unchanged (video not failed).
- `apps/desktop/src/lib/higgsfield/generation-prompts.test.ts` (extend):
  - `buildVideoFramePrompt` includes the placement id and aspect ratio; includes
    `Original brief:` when `originalPrompt` is given and omits that line when not.
- Verification: `bun --filter @assetwell/desktop test` → all pass including the
  new cases.

Manual QA (report the result, do not block on it if no live Higgsfield session
is available in your environment): attach a 16:9 image, select `720x1280`,
Animate → card shows "preparing frame", poster switches to a composed 9:16
frame, then the final vertical video renders without blurred side bars.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `rg -n "video-frame" apps/desktop/src/lib/higgsfield/types.ts apps/desktop/src/lib/higgsfield/generation-state.ts apps/desktop/src/lib/higgsfield/generation-actions.ts` → present in all three
- [ ] `rg -n "gblur|blur" apps/desktop/electron/higgsfield-cli.ts` → unchanged vs `git show 1821fc8` (host untouched: `git diff 1821fc8..HEAD -- apps/desktop/electron` is empty)
- [ ] `bun --filter @assetwell/desktop test` → all pass, including the new video-frame, generation-state, and prompt cases
- [ ] `bun run fmt:check`, `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build` all exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `onCommandOutput` handler, `applyGenerationResult`, or `markRunFailed`
  in `higgsfield.tsx` don't match the excerpts (drift).
- You find that image generations with `waitForResult: true` do **not** deliver
  a local `filePath` in the result artifact (the chain depends on it; the
  fallback covers the missing-file case, but if it's _always_ missing the
  feature is inert and the design needs revisiting).
- `startTrackedGeneration` or the bridge `generate` signature rejects any field
  used in Step 6 (would mean the bridge contract drifted).
- Implementing the fallback requires marking the video failed and un-failing it
  later — that means the reducer guard in Step 3 didn't take; do not paper over
  it with state flips.
- The change appears to require touching `apps/desktop/electron` or
  `packages/desktop-bridge`.

## Maintenance notes

- **Cost**: each mismatched size now consumes one extra image generation
  (Higgsfield credits). If users complain, the escape hatch is a settings-level
  toggle — the maintainer explicitly rejected a per-generate toggle (2026-07-15).
- **Restart gap (pre-existing, now slightly wider)**: the chain lives in
  renderer memory (`PendingRun.onReady`). If the app quits between the frame
  finishing and the video starting, the video stays `pending`/`framing` in the
  restored snapshot with no run attached — same orphan behavior existing
  pending videos already have on restart. A future "reconcile stale pending
  runs on launch" task would fix both; deferred.
- **Reuse opportunity (deferred)**: when the source creative already has a
  ready image placement at a matching ratio, the frame step could reuse it and
  skip a generation. Left out to keep this change orthogonal.
- Reviewers should scrutinize: that no path calls `markRunFailed` with kind
  `"video-frame"` expecting the video to fail; that `sourceCompositionProtected`
  still reflects the _direct_ path's blur-fill decision (used by the fallback);
  and that the chained run's `runId` overwrite (frame run id → video run id on
  the same `VideoResult`) doesn't break anything that keys on `runId`.
- Plan 007 (composer size-select UX) references this plan's behavior in its
  user-facing copy ("sizes that don't match get a matching frame first") —
  land 006 before 007.
