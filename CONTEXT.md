# Kreeyts Context

## Domain Language

- **Kreeyts Desktop App**: the Electron application shipped from `apps/desktop`.
- **Higgsfield CLI**: the Higgsfield command-line product that Kreeyts wraps through pinned `@higgsfield/cli` and, only as a backup, a global `higgsfield` executable.
- **Bundled Higgsfield Engine**: the vendored native `hf` executable installed by `@higgsfield/cli` and preferred by the Electron Host.
- **Renderer**: the React UI running in the browser context.
- **Electron Host**: the main and preload process code under `apps/desktop/electron`.
- **Desktop Bridge**: the typed product interface exposed as `window.kreeyts`.
- **Host App Info**: Electron-owned metadata about the running desktop app, including name, version, platform, and packaging mode.
- **Higgsfield CLI Status**: Electron-owned detection of whether the Higgsfield CLI is installed, what version it reports, and whether account authentication appears available.
- **Higgsfield Product Action**: a user-facing operation such as Sign in, Check credits, Choose model, Upload asset, Generate, or Open output. Product actions are exposed through the Desktop Bridge instead of raw CLI command arguments.
- **Higgsfield Command Run**: a spawned `higgsfield` process owned by the Electron Host, with stdout, stderr, and exit events streamed to the Renderer.
- **App Data Root**: the future canonical location for local Kreeyts state. It is intentionally undefined until persistence is introduced.

## Current Product Shape

Kreeyts is a minimal desktop wrapper for the Higgsfield CLI. It does not own Higgsfield authentication, models, accounts, workspaces, or generation jobs directly; it invokes the CLI and presents host-owned status and command output.

Kreeyts does not yet have projects, sessions, generated artifacts, long-running runtime work beyond spawned CLI commands, or persistent user data.
