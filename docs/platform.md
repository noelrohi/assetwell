# Assetwell Platform — Product Model & v1 Spec

Assetwell is **bespoke desktop software for a small team of non-technical creatives who already use Higgsfield** and want a tailored 10/10 version of the parts they care about. Higgsfield is the AI image/video generation engine; users know it powers the app. The web app (higgsfield.ai) is their current 7/10 — the pain is its GUI.

The core thesis is **create efficiently**: a base creative image → resized into ad-placement sizes → optional video. Everything else is a bonus.

The desired flow is mirrored by the reference app at `~/sandbox/dilag`-adjacent `~/sandbox/assetwell` (same create→resize→video model, but built on OpenAI/Gemini + trigger.dev; Assetwell uses Higgsfield + a **local** queue instead).

> This document is the product source of truth. For the runtime/module layout and the bridge contract, see [architecture.md](./architecture.md). For the UI redesign stack and conventions, see [Section 9](#9-ui-implementation-status).

## 1. Positioning

- Bespoke, not a public general-purpose tool. The audience is a specific creative team that chose Higgsfield.
- Users know Higgsfield powers the app; the CLI, npm, accounts, and exit codes are implementation details they must never see.
- "10/10 custom" means _their_ small set of controls, pre-tuned — not feature parity with higgsfield.ai.

## 2. Onboarding

- **Bundle the Higgsfield CLI** inside the app — no npm, ever (the `bundled` executable source).
- First run: if not authenticated, a single **"Sign in to Higgsfield"** screen → browser login → land directly on **Create**.
- **One workspace**, auto-selected, never asked.
- CLI version, install state, and workspace IDs are never shown.
- After sign-in, open to the composer with an empty recent grid; generated creatives become the user's working set.

## 3. Create (image)

Composer inputs:

1. **Prompt** textarea (the main control).
2. **Dynamic aspect-ratio picker** — the base creative's ratio is user-chosen.
3. **Attach reference image** (Higgsfield `generate` takes an `assetPath`).
4. **Prompt library** picker — shipped starters + user-saved, plain text only (no templated `<field>` styles — styles/presets are cut).
5. **Model selection is shown** (image models via `listModels`).

Flow:

- Generate produces **1 base image**; the user can then generate placements from that hero.
- Then **one-click "Generate available sizes"** — the (B) checkpoint flow: review the base before mass-producing the currently-enabled placements.
- Placements = **regenerate at each target size, referencing the base image**. Ultra-wide banner sizes (`728×90`, `320×50`) are paused until their quality is reliable.
- Each available placement tile is single-shot with its own **Regenerate**. Failures are **isolated** — one bad size never kills the batch.
- **Parallel creatives** are allowed — a global "X jobs running" indicator.

## 4. Supported sizes

- **Image active (6):** 1200×628, 1024×768, 768×1024, 300×250, 600×300, 480×400.
- **Image paused (2):** 728×90, 320×50.
- **Video (4):** 1280×720, 720×1280, 1080×1080, 300×250.

Canonical target sizes and aspect ratios live in [`creative-sizes.md`](./creative-sizes.md). The renderer copy in `apps/desktop/src/lib/placements.ts` should stay in sync with that doc.

## 5. Video

- A **first-class standalone screen** — a freeform video composer: attached image + video prompt + video-size picker + video models.
- From a creative's detail page, an **"Animate"** button sends the currently-selected image (base or a placement) into the composer, pre-attached.
- **Opt-in per size** — video is slow and credit-expensive, so no auto-all.
- Generated videos are **linked back to their source creative when there is one, AND appear in a flat Videos gallery** (freeform videos are never orphaned).

## 6. Libraries

- **Prompt templates split Image / Video** — each shipped-starters + user-saved, plain text. They are managed from **Prompt templates** and picked inline from composers.
- **Brand memory** — a flat local folder of saved images (logo/product/mood), no tags/roles. The **Brand memory** screen adds/removes files; composer references query that folder before showing the picker.
- **soul-id is deferred to phase 2** (the marquee consistency feature, but it adds training/onboarding weight).

## 7. Navigation

- Top-level destinations: **Create** (composer + your creatives grid), **Videos** (composer + videos gallery), **Brand memory**, and **Prompt templates** — plus detail pages and an account corner menu (credit balance + sign out).
- **Starred is cut for v1** (a flat recent-first grid is enough).

## 8. Local-first output (the "why desktop" differentiator)

- Every generation **auto-saves to a local folder-per-creative** (`~/Assetwell` default, user-configurable), named by date + prompt slug, with files named by size (`1200x628.png`, `1280x720.mp4`).
- **The folder is the deliverable.** Primary action is **Reveal in Finder**; **Export as ZIP** is secondary (for off-machine sharing).
- The app keeps a small local index for the grids; the image/video files themselves are plain, user-owned files.

## 9. Credits & failure states

- Credit balance shown in the account corner; **hard-block generate at zero credits** with a "top up" action that opens Higgsfield's billing page in the browser (we don't own billing).
- Job failure → failed tile + Regenerate; the batch survives.
- Auth-expiry mid-session → a non-scary "Sign back in," resume in place.
- **Never show raw stderr** — humane plain-language errors, with a collapsed "Show details" for debugging only.

## 10. UI implementation status

The renderer is built (Darkroom Gallery aesthetic, TanStack Router, shadcn) and now routes real generation through the Higgsfield bridge. Local library state is persisted in SQLite with the previous JSON snapshot retained as a fallback, outputs are written to the configurable `~/Assetwell`-style output root, image/video outputs are post-processed to exact target dimensions, narrow banner placements are paused pending quality tuning, and auth/zero-credit states block generation. Remaining v1 hardening: durable recovery for Higgsfield jobs after app exit, richer model-parameter UX beyond aspect ratio, and a reindex/import flow for existing output folders.

---

_History: this spec was produced in a `grill-me` session on 2026-06-24 and supersedes the "wrapper-only" framing in earlier docs._
