# Kreeyts Architecture

Kreeyts is a small Electron desktop wrapper for the Higgsfield CLI. The architecture should grow from that product behavior, not from Dilag's larger product model.

Higgsfield owns authentication, accounts, workspaces, models, generation, uploads, Soul ID, Marketing Studio, and version reporting through the Higgsfield CLI. Kreeyts provides a native desktop host, a typed bridge, status checks, sign-in launch, a local asset picker, generation/upload actions, exact image output post-processing, local output folders, a persisted local library snapshot, output opening, and streamed progress.

## Runtime Modules

- `apps/desktop/src`: renderer UI. Routes should stay thin and compose product blocks.
- `apps/desktop/src/components/blocks`: product-specific renderer blocks grouped by surface (`layout`, `create`, `creative`, `videos`, `composer`). Keep page-local UI here before promoting anything to shared primitives.
- `apps/desktop/electron`: Electron Host code. Native capabilities, IPC channel names, and Electron APIs stay here.
- `packages/desktop-bridge`: the Desktop Bridge type contract shared by the renderer and Electron Host.
- `packages/ui`: reusable UI primitives only. Product-specific blocks stay in the desktop app.

## Desktop Bridge

The renderer talks to the Electron Host through `window.kreeyts`, typed by `DesktopBridge`.

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
- `higgsfield.generate({ model, prompt, mediaKind, assetPath, assetPaths, aspectRatio, outputSize, waitForResult })`: creates a Higgsfield generation job, streams progress, and saves local artifacts. Outputs with `outputSize` are center-cropped/resized to the exact target dimensions before saving locally.
- `higgsfield.openOutput({ target })`: opens a generated URL or local output path.
- `higgsfield.cancelCommand(runId)`: stops a running CLI process owned by the Electron Host.
- `higgsfield.onCommandOutput(listener)`: subscribes to product-level command output events.

This is intentionally small. New bridge methods should be product-level Higgsfield wrapper capabilities, not raw Electron wrappers or arbitrary CLI command runners. Channel names, executable paths, command arguments, and transport details belong in Electron Host adapters.

## IPC Ownership

Electron IPC channels are registered under `apps/desktop/electron/ipc`. Shared channel names live in `apps/desktop/electron/shared/channels.ts`.

The current IPC domains are:

- `app-info`: owns Electron metadata exposed through `DesktopBridge.app.getInfo()`.
- `higgsfield`: owns CLI process invocation, bundled/global executable resolution, install/auth/workspace detection, sign-in, model/account/generation/upload actions, cancellation, file picking, output opening, exact image post-processing, and streamed command output.
- `library`: owns the local library snapshot, settings, output-root picker/reveal, and ZIP export.

Add another IPC domain only when there is real behavior behind it. A folder of pass-through modules would make the interface larger without improving locality.

## Higgsfield CLI Adapter

`apps/desktop/electron/higgsfield-cli.ts` is the Electron Host adapter for the Higgsfield CLI. Kreeyts pins `@higgsfield/cli` as a desktop app dependency and prefers the package's vendored `hf` binary. If that bundled executable is unavailable, the adapter falls back to a global `higgsfield` command so development machines can still recover.

The adapter:

- invokes the resolved executable directly with argument arrays, not through a shell,
- owns a small local FIFO queue for generation commands (default three concurrent Higgsfield runs; override with `KREEYTS_MAX_HIGGSFIELD_RUNS` for development),
- checks version, authentication status, and workspace status,
- starts sign-in, credit checks, model listing/detail inspection, uploads, and generation through product actions,
- validates model, prompt, aspect-ratio, and file inputs before spawning the CLI,
- saves generated artifacts under the configured Kreeyts Output Root,
- post-processes generated images/videos to exact target dimensions when the renderer supplies `outputSize` (Electron `nativeImage` for images, bundled `ffmpeg-static` for videos),
- streams stdout, stderr, system messages, result artifacts, and exit events to the renderer without showing raw command invocations.

`apps/desktop/scripts/ensure-higgsfield-cli.mjs` materializes the pinned vendored binary for Bun-based development and build flows when the package postinstall did not run.

## Storage Ownership

Kreeyts has two storage locations:

- **App Data Root:** Electron `app.getPath("userData")`; app-owned JSON state lives under `state/` (`library.v1.json` and `settings.json`).
- **Kreeyts Output Root:** defaults to `~/Kreeyts` and can be changed by the user; generated images/videos are written as plain files in folder-per-creative directories.

The local library snapshot is a convenience index and can be rebuilt from future import/reindex flows. Generated artifacts are user-owned files. If Kreeyts closes while a CLI command is pending, the next launch marks that local item as failed/interrupted rather than pretending Higgsfield job state is recoverable.

## Deferred Seams

These are deliberate non-goals until Kreeyts has matching product behavior:

- project and session models,
- generated artifact policy,
- runtime bootstrap and event stream,
- native menu, zoom, theme, and updater modules,
- release and packaged-app smoke tests.
