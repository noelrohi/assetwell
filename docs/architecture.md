# Assetwell Architecture

Assetwell is a small Electron desktop wrapper for the Higgsfield CLI with a public marketing/download site. The architecture should grow from that product behavior, not from Dilag's larger product model.

Higgsfield owns authentication, accounts, workspaces, models, generation, uploads, Soul ID, Marketing Studio, and version reporting through the Higgsfield CLI. Assetwell provides a native desktop host, a typed bridge, status checks, sign-in launch, a local asset picker, generation/upload actions, exact image output post-processing, local output folders, a persisted local library snapshot, output opening, and streamed progress.

## Runtime Modules

- `apps/desktop/src`: renderer UI. Routes should stay thin and compose product blocks.
- `apps/desktop/src/components/blocks`: product-specific renderer blocks grouped by surface (`layout`, `create`, `creative`, `videos`, `composer`). Keep page-local UI here before promoting anything to shared primitives.
- `apps/desktop/electron`: Electron Host code. Native capabilities, IPC channel names, and Electron APIs stay here.
- `apps/desktop/electron/updater.ts`: packaged-app auto-update bootstrap backed by GitHub release metadata.
- `apps/www`: TanStack Start marketing site. It owns public pages, canonical/OG metadata via `VITE_SITE_URL`, and the `/api/download` proxy for latest release assets.
- `packages/product`: shared product/domain registries used by app surfaces, including placement specs/availability, download-platform policy, and shared brand assets.
- `packages/desktop-bridge`: the Desktop Bridge type contract shared by the renderer and Electron Host.
- `packages/ui`: reusable UI primitives only. Product-specific blocks stay in the apps.

## Desktop Bridge

The renderer talks to the Electron Host through `window.assetwell`, typed by `DesktopBridge`.

The current contract is:

- `app.getInfo()`: returns Host App Info from Electron.
- `higgsfield.getStatus()`: checks bundled/global CLI availability, version, account authentication, and workspace status.
- `higgsfield.signIn()`: starts the Higgsfield browser sign-in flow and streams progress.
- `higgsfield.checkCredits()`: checks account plan and credits.
- `higgsfield.checkWorkspace()`: checks the active account/workspace context.
- `higgsfield.listModels({ mediaKind })`: lists available Higgsfield models for a creative format.
- `higgsfield.getModelDetails({ model, mediaKind })`: reads model params such as supported aspect ratios so the renderer can show valid controls.
- `higgsfield.chooseAsset(mediaKind)`: opens a native file picker for image, video, or audio assets.
- `higgsfield.uploadAsset({ filePath })`: uploads a selected local asset.
- `higgsfield.generate({ model, prompt, mediaKind, assetPath, assetPaths, aspectRatio, durationSeconds, outputSize, waitForResult })`: creates a Higgsfield generation job, streams progress, and saves local artifacts. Outputs with `outputSize` are center-cropped/resized to the exact target dimensions before saving locally.
- `library.loadSnapshot()`: loads the local library from SQLite, falling back to the legacy JSON snapshot and migrating it forward.
- `library.saveSnapshot(snapshot)`: saves the local library to SQLite and keeps a JSON snapshot as a fallback.
- `library.listReferenceAssets()`: scans the Brand Memory folder under the configured output root.
- `library.importReferenceAssets()`: opens a native image picker and copies selected files into Brand Memory.
- `library.revealReferenceAssets()`: opens the Brand Memory folder.
- `library.deleteReferenceAsset({ id })`: removes a scanned Brand Memory file by stable folder-derived id.
- `higgsfield.openOutput({ target })`: opens a generated URL or local output path.
- `higgsfield.cancelCommand(runId)`: stops a running CLI process owned by the Electron Host.
- `higgsfield.onCommandOutput(listener)`: subscribes to product-level command output events.

This is intentionally small. New bridge methods should be product-level Higgsfield wrapper capabilities, not raw Electron wrappers or arbitrary CLI command runners. Channel names, executable paths, command arguments, and transport details belong in Electron Host adapters.

## IPC Ownership

Electron IPC channels are registered under `apps/desktop/electron/ipc`. Shared channel names live in `apps/desktop/electron/shared/channels.ts`.

The current IPC domains are:

- `app-info`: owns Electron metadata exposed through `DesktopBridge.app.getInfo()`.
- `higgsfield`: owns CLI process invocation, bundled/global executable resolution, install/auth/workspace detection, sign-in, model/account/generation/upload actions, cancellation, file picking, output opening, exact image post-processing, and streamed command output.
- `library`: owns the local library store, JSON snapshot fallback, settings, output-root picker/reveal, and ZIP export.

Add another IPC domain only when there is real behavior behind it. A folder of pass-through modules would make the interface larger without improving locality.

## Higgsfield CLI Adapter

`apps/desktop/electron/higgsfield-cli.ts` is the Electron Host adapter for the Higgsfield CLI. Assetwell pins `@higgsfield/cli` as a desktop app dependency and prefers the package's vendored `hf` binary. If that bundled executable is unavailable, the adapter falls back to a global `higgsfield` command so development machines can still recover.

The adapter:

- invokes the resolved executable directly with argument arrays, not through a shell,
- owns a small local FIFO queue for generation commands (default three concurrent Higgsfield runs; override with `ASSETWELL_MAX_HIGGSFIELD_RUNS` for development),
- checks version, authentication status, and workspace status,
- starts sign-in, credit checks, model listing/detail inspection, uploads, and generation through product actions,
- validates model, prompt, aspect-ratio, and file inputs before spawning the CLI,
- saves generated artifacts under the configured Assetwell Output Root,
- post-processes generated images/videos to exact target dimensions when the renderer supplies `outputSize` (Electron `nativeImage` for images, bundled `ffmpeg-static` for videos),
- streams stdout, stderr, system messages, result artifacts, and exit events to the renderer without showing raw command invocations.

`apps/desktop/scripts/ensure-higgsfield-cli.mjs` materializes the pinned vendored binary for Bun-based development and build flows when the package postinstall did not run.

## Storage Ownership

Assetwell has two storage locations:

- **App Data Root:** Electron `app.getPath("userData")`; app-owned state lives under `state/` (`library.v1.sqlite` as the primary local library store, `library.v1.json` as a fallback snapshot, and `settings.json`).
- **Assetwell Output Root:** defaults to `~/Assetwell` and can be changed by the user; generated images/videos are written as plain files in folder-per-creative directories. The `Brand Memory/` child folder stores reusable reference images that the renderer scans through the library bridge.

The local library store remains a convenience index and can be rebuilt from future import/reindex flows. On launch Assetwell reads SQLite first, then falls back to the JSON snapshot and migrates it forward. Generated artifacts and Brand Memory files are user-owned files. If Assetwell closes while a CLI command is pending, the next launch marks that local item as failed/interrupted rather than pretending Higgsfield job state is recoverable.

## Website Download Policy

The website download page and API use `@assetwell/product/downloads` as the single platform registry. macOS is currently available; Windows and Linux are listed as coming soon. `/api/download` only resolves release assets for platforms marked available and falls back to the GitHub release page when no matching macOS asset exists.

The website uses Nitro's Vercel preset so TanStack Start server routes and static assets are emitted as Vercel Build Output API files under `.vercel/output`.

## Deferred Seams

These are deliberate non-goals until Assetwell has matching product behavior:

- project and session models,
- generated artifact policy,
- runtime bootstrap and event stream,
- native menu, zoom, and theme modules,
- packaged-app smoke tests.
