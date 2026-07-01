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

`packages/desktop-bridge/src/types.ts` is the source of truth for method names, request/response shapes, and event payloads. At the domain level the bridge exposes:

- `app`: host-owned app metadata and release-note lookup.
- `higgsfield`: product-level CLI capabilities such as status, sign-in, credits/workspace checks, model list/detail reads, asset picking/uploading, generation, output opening, cancellation, and streamed command output.
- `library`: Assetwell-owned local persistence, settings, output-root picker/reveal, Uploads workspace/reference-file snapshots and mutations, and export helpers.
- `updater`: packaged-app downloaded-update state and install handoff.

This is intentionally small. New bridge methods should be product-level Higgsfield wrapper capabilities or host-owned Assetwell behaviors, not raw Electron wrappers or arbitrary CLI command runners. Channel names, executable paths, command arguments, and transport details belong in Electron Host adapters.

## IPC Ownership

Electron IPC channels are registered under `apps/desktop/electron/ipc`. Shared channel names live in `apps/desktop/electron/shared/channels.ts`.

The current IPC domains are:

- `app-info`: owns Electron metadata exposed through `DesktopBridge.app.getInfo()`.
- `higgsfield`: owns CLI process invocation, bundled/global executable resolution, install/auth/workspace detection, sign-in, model/account/generation/upload actions, cancellation, file picking, output opening, exact image post-processing, and streamed command output.
- `library`: owns the local library store façade, JSON snapshot fallback, settings, output-root picker/reveal, ZIP export, and delegates Uploads workspace/reference-file behavior to `uploads-store`.

Add another IPC domain only when there is real behavior behind it. A folder of pass-through modules would make the interface larger without improving locality.

## Higgsfield CLI Adapter

`apps/desktop/electron/higgsfield-cli.ts` is the Electron Host adapter for the Higgsfield CLI. Assetwell pins `@higgsfield/cli` as a desktop app dependency and prefers the package's vendored `hf` binary. If that bundled executable is unavailable, the adapter falls back to a global `higgsfield` command so development machines can still recover.

The adapter:

- invokes the resolved executable directly with argument arrays, not through a shell,
- owns a small local FIFO queue for generation commands (default three concurrent Higgsfield runs; override with `ASSETWELL_MAX_HIGGSFIELD_RUNS` for development),
- checks version, authentication status, and workspace status,
- starts sign-in, credit checks, model listing/detail inspection, uploads, and generation through product actions,
- validates model, prompt, aspect-ratio, and file inputs before spawning the CLI,
- saves generated artifacts under the active Uploads workspace's output scope inside the configured Assetwell Output Root,
- post-processes generated images/videos to exact target dimensions when the renderer supplies `outputSize` (Electron `nativeImage` for images, bundled `ffmpeg-static` for videos),
- streams stdout, stderr, system messages, result artifacts, and exit events to the renderer without showing raw command invocations.

`apps/desktop/scripts/ensure-higgsfield-cli.mjs` materializes the pinned vendored binary for Bun-based development and build flows when the package postinstall did not run.

## Storage Ownership

Assetwell has two storage locations:

- **App Data Root:** Electron `app.getPath("userData")`; app-owned state lives under `state/` (`library.v1.sqlite` as the primary local library store, `library.v1.json` as a fallback snapshot, and `settings.json`).
- **Assetwell Output Root:** defaults to `~/Assetwell` and can be changed by the user. Generated images/videos are written as plain files in `Outputs/<Upload workspace id>/<folder-per-creative>/`, so switching Uploads workspaces also switches the visible creative/video output library. The `Uploads/` child folder stores reusable reference images in local workspace subfolders such as `Uploads/Default/` and `Uploads/Brand A/`. Upload workspace `id` is the sanitized folder key; `name` is the user-facing label stored in settings. These workspaces are Assetwell-local folder labels only and never call `hf workspace set`.

The local library store remains a convenience index and can be rebuilt from future import/reindex flows. On launch Assetwell reads SQLite first, then falls back to the JSON snapshot and migrates it forward. Generated artifacts and Uploads files are user-owned files. If the legacy `Brand Memory/` folder exists, Assetwell migrates it into the `Default` Uploads workspace. If Assetwell closes while a CLI command is pending, the next launch marks that local item as failed/interrupted rather than pretending Higgsfield job state is recoverable.

## Website Download Policy

The website download page and API use `@assetwell/product/downloads` as the single platform registry. macOS, Windows, and Linux are available, and `/api/download` resolves the latest matching GitHub Release asset for the requested platform before falling back to the release page.

The website uses Nitro's Vercel preset so TanStack Start server routes and static assets are emitted as Vercel Build Output API files under `.vercel/output`.

## Deferred Seams

These are deliberate non-goals until Assetwell has matching product behavior:

- project and session models,
- generated artifact policy,
- runtime bootstrap and event stream,
- native menu, zoom, and theme modules,
- packaged-app smoke tests.
