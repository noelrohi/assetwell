# Kreeyts Architecture

Kreeyts is a small Electron desktop wrapper for the Higgsfield CLI. The architecture should grow from that product behavior, not from Dilag's larger product model.

Higgsfield owns authentication, accounts, workspaces, models, generation, uploads, Soul ID, Marketing Studio, and version reporting through the Higgsfield CLI. Kreeyts provides a native desktop host, a typed bridge, status checks, sign-in launch, a local asset picker, generation/upload actions, output opening, and streamed progress.

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
- `higgsfield.chooseAsset(mediaKind)`: opens a native file picker for image, video, or audio assets.
- `higgsfield.uploadAsset({ filePath })`: uploads a selected local asset.
- `higgsfield.generate({ model, prompt, mediaKind, assetPath, waitForResult })`: creates a Higgsfield generation job and streams progress.
- `higgsfield.openOutput({ target })`: opens a generated URL or local output path.
- `higgsfield.cancelCommand(runId)`: stops a running CLI process owned by the Electron Host.
- `higgsfield.onCommandOutput(listener)`: subscribes to product-level command output events.

This is intentionally small. New bridge methods should be product-level Higgsfield wrapper capabilities, not raw Electron wrappers or arbitrary CLI command runners. Channel names, executable paths, command arguments, and transport details belong in Electron Host adapters.

## IPC Ownership

Electron IPC channels are registered under `apps/desktop/electron/ipc`. Shared channel names live in `apps/desktop/electron/shared/channels.ts`.

The current IPC domain is:

- `app-info`: owns Electron metadata exposed through `DesktopBridge.app.getInfo()`.
- `higgsfield`: owns CLI process invocation, bundled/global executable resolution, install/auth/workspace detection, sign-in, model/account/generation/upload actions, cancellation, file picking, output opening, and streamed command output.

Add another IPC domain only when there is real behavior behind it. A folder of pass-through modules would make the interface larger without improving locality.

## Higgsfield CLI Adapter

`apps/desktop/electron/higgsfield-cli.ts` is the Electron Host adapter for the Higgsfield CLI. Kreeyts pins `@higgsfield/cli` as a desktop app dependency and prefers the package's vendored `hf` binary. If that bundled executable is unavailable, the adapter falls back to a global `higgsfield` command so development machines can still recover.

The adapter:

- invokes the resolved executable directly with argument arrays, not through a shell,
- checks version, authentication status, and workspace status,
- starts sign-in, credit checks, model listing, uploads, and generation through product actions,
- validates model, prompt, and file inputs before spawning the CLI,
- streams stdout, stderr, system messages, and exit events to the renderer without showing raw command invocations.

`apps/desktop/scripts/ensure-higgsfield-cli.mjs` materializes the pinned vendored binary for Bun-based development and build flows when the package postinstall did not run.

## Storage Ownership

Kreeyts does not persist user data yet. Before adding persistence, define:

- the canonical App Data Root,
- what data belongs to the app rather than a user-selected workspace,
- migration and fallback rules,
- privacy expectations for local files.

Until those rules exist, modules should not invent storage paths independently.

## Deferred Seams

These are deliberate non-goals until Kreeyts has matching product behavior:

- project and session models,
- generated artifact policy,
- runtime bootstrap and event stream,
- native menu, zoom, theme, and updater modules,
- release and packaged-app smoke tests.
