# Assetwell Context

## Domain Language

- **Assetwell Desktop App**: the Electron application shipped from `apps/desktop`.
- **Higgsfield CLI**: the Higgsfield command-line product that Assetwell wraps through pinned `@higgsfield/cli` and, only as a backup, a global `higgsfield` executable.
- **Bundled Higgsfield Engine**: the vendored native `hf` executable installed by `@higgsfield/cli` and preferred by the Electron Host.
- **Renderer**: the React UI running in the browser context.
- **Electron Host**: the main and preload process code under `apps/desktop/electron`.
- **Desktop Bridge**: the typed product interface exposed as `window.assetwell`.
- **Host App Info**: Electron-owned metadata about the running desktop app, including name, version, platform, and packaging mode.
- **Higgsfield CLI Status**: Electron-owned detection of whether the Higgsfield CLI is installed, what version it reports, and whether account authentication appears available.
- **Higgsfield Product Action**: a user-facing operation such as Sign in, Check credits, Choose model, Upload asset, Generate, or Open output. Product actions are exposed through the Desktop Bridge instead of raw CLI command arguments.
- **Higgsfield Command Run**: a spawned `higgsfield` process owned by the Electron Host, with stdout, stderr, and exit events streamed to the Renderer.
- **App Data Root**: Electron `app.getPath("userData")`, where Assetwell stores its local JSON snapshot, settings, and other app-owned state.
- **Assetwell Output Root**: the user-owned folder where generated creative files and Uploads reference images are written. It defaults to `~/Assetwell` on macOS, Windows, and Linux and is user-configurable from the account menu.
- **Higgsfield Workspace Selection**: the hidden account/team context verified through the Higgsfield CLI. Assetwell assumes the client's default Higgsfield workspace under the hood and does not expose workspace management in the product UI.
- **Assetwell Brand**: the visible organization layer for the small team's brands. Brand metadata is local Assetwell state that scopes Uploads views and creative/video outputs without changing Higgsfield storage.
- **Higgsfield Uploads Library**: shared image uploads in the default Higgsfield workspace, listed through `hf upload list` and created through `hf upload create`. Higgsfield does not provide folders/tags here; Assetwell overlays `uploadId -> brandId` metadata so uploads can appear under real brands or `Unsorted`. Assetwell also overlays `uploadId -> folderId` metadata as **Upload Folders** — flat, global, local-only grouping shown as drill-in folders on the Uploads page. Assetwell also overlays locally captured original filenames through `uploadId -> name` upload-names metadata for uploads created through Assetwell.
- **Uploads Compatibility Scope**: a legacy local folder under `Uploads/<scope id>/` retained for unauthenticated/dev fallback and existing reference files.
- **Local Library Snapshot**: the persisted JSON index of recent creatives, videos, prompt presets, local output paths, saved reference metadata, and brand scope ids. It is a convenience index; generated files remain plain files under the Assetwell Output Root.

## Current Product Shape

Assetwell is a minimal desktop wrapper for the Higgsfield CLI. It does not own Higgsfield authentication, models, accounts, workspaces, or generation jobs directly; it invokes the CLI and presents host-owned status and command output.

Assetwell now has a small local library index, local brand metadata, and generated artifacts saved to the Assetwell Output Root. It uses the default Higgsfield workspace and shared Higgsfield uploads through the CLI, but still does not own Higgsfield accounts, workspace lifecycle, model catalogs, upload storage, folders/tags, or generation jobs beyond the CLI commands it starts locally.
