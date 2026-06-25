# AGENTS.md

## Project Shape

- Bun monorepo (`packageManager`: `bun@1.2.14`) with Turbo; use Bun commands and do not add npm/yarn/pnpm lockfiles.
- `apps/desktop` is the Electron + Vite + React desktop app shipped as Kreeyts.
- `apps/desktop/src` is the renderer; `apps/desktop/electron` is the Electron Host and owns native APIs, IPC, and CLI spawning.
- `packages/desktop-bridge` is the shared typed `window.kreeyts` contract; update it with preload, IPC handlers, and renderer usage together.
- `packages/ui` is only reusable UI primitives; product-specific UI belongs in `apps/desktop/src`.

## Commands

- Install: `bun install`.
- Desktop dev: `bun run dev:desktop` or direct `bun run electron:dev`; both route through scripts that prepare the Higgsfield CLI.
- Root checks: `bun run fmt:check`, `bun run typecheck`, `bun run lint`, `bun run build`.
- Focus desktop typecheck: `bun --filter @kreeyts/desktop typecheck`.
- Focus current Bun test files directly, for example `bun test apps/desktop/electron/higgsfield-output.test.ts`; there is no package `test` script yet.
- Packaging: `bun run electron:dist`; run this when Electron Builder files, bundled assets, or packaging behavior changes.

## Verification Order

- Docs-only changes: run `bun run fmt:check`.
- TypeScript, Electron bridge, or app behavior changes: run `bun run fmt:check`, then `bun run typecheck`, then `bun run lint`, then `bun run build`.
- `turbo lint` depends on upstream `build`; do not assume lint is cheap or independent.

## Higgsfield CLI

- Kreeyts wraps pinned `@higgsfield/cli` from `apps/desktop`; the Electron Host prefers the vendored native `hf` executable and falls back to global `higgsfield` only for recovery.
- `apps/desktop/scripts/ensure-higgsfield-cli.mjs` materializes the pinned vendored binary when Bun skipped package postinstall; desktop dev/build scripts run it automatically.
- Invoke Higgsfield through product actions on the Desktop Bridge, not by exposing raw CLI arguments to the renderer.
- Spawn CLI commands with argument arrays from the Electron Host, not through a shell.

## Bridge And IPC

- Renderer access is via `window.kreeyts` exposed in `apps/desktop/electron/preload.ts`; keep `contextIsolation: true` and `nodeIntegration: false` assumptions intact.
- IPC domains live under `apps/desktop/electron/ipc`; shared channel names live in `apps/desktop/electron/shared/channels.ts`.
- Add bridge methods only for product-level Higgsfield capabilities or host-owned app info, not arbitrary Electron wrappers.
- Do not show CLI install state, workspace IDs, raw commands, or raw stderr in user-facing UI; use humane product language and reserve details for debugging surfaces.

## Product Constraints

- Kreeyts does not own Higgsfield auth, accounts, workspaces, models, uploads, or generation jobs; it wraps the CLI and presents host-owned status/output.
- The renderer is currently mock-driven in places (`apps/desktop/src/lib/mock-data.ts`) and not fully wired to bridge results; verify whether a flow is real before assuming persistence or job state exists.
- Do not invent app storage paths yet. Persistence requires defining the canonical App Data Root, migration rules, and privacy expectations first.
- Supported creative sizes are canonical in `apps/desktop/src/lib/placements.ts`; update that source before duplicating size lists elsewhere.

## References

- `CONTEXT.md` defines current domain language and product boundaries.
- `docs/architecture.md` is the runtime/module-layout source of truth.
- `docs/platform.md` is the product model and v1 spec; it intentionally goes beyond what is fully implemented today.
- `docs/development.md` records the full command/check guidance.
