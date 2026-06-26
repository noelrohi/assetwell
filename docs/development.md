# Assetwell Development

## Toolchain

- Package manager: Bun (`bun@1.2.14`).
- Task runner: Turbo.
- Desktop app: Electron, Vite, React, Tailwind v4, tsdown.
- Wrapped executable: pinned `@higgsfield/cli` in `apps/desktop`, with global `higgsfield` used only as a fallback.

Use Bun commands; do not add npm lockfiles.

`apps/desktop/scripts/ensure-higgsfield-cli.mjs` downloads the pinned Higgsfield native binary when Bun has installed the package without running its postinstall. The desktop `dev`, `dev:electron`, `build`, and `build:electron` scripts run this check before launching or bundling.

## Commands

- `bun run dev`: run all development tasks through Turbo.
- `bun run dev:desktop`: run the desktop app development task.
- `bun run electron:dev`: run the Electron development workflow directly.
- `bun run --cwd apps/desktop prepare:higgsfield-cli`: ensure the pinned Higgsfield native binary exists locally.
- `bun run test`: run workspace tests through Turbo.
- `bun run typecheck`: typecheck workspace packages.
- `bun run lint`: run the workspace lint task.
- `bun run fmt:check`: check formatting.
- `bun run build`: build all workspace packages.
- `bun run electron:dist`: create packaged desktop artifacts.

CI and release automation are documented in [CI/CD](./ci.md).

Authentication should normally happen inside Assetwell through the Sign in action.

## Completion Checks

For documentation-only changes:

1. `bun run fmt:check`

For TypeScript or Electron bridge changes:

1. `bun run fmt:check`
2. `bun run test`
3. `bun run typecheck`
4. `bun run lint`
5. `bun run build`

If packaging behavior changes, also run `bun run electron:dist`.
