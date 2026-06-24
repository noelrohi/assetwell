# Architecture Gap Matrix From Dilag

Source reviewed: `/Users/rohi/sandbox/dilag` on 2026-06-24.
Target reviewed: this repo (`kreeyts`).

This matrix compares Kreeyts against Dilag's current desktop architecture. It is a planning document, not a migration checklist to copy every Dilag file. Kreeyts is a simple desktop wrapper for the Higgsfield CLI (`https://higgsfield.ai/cli`), so Dilag is useful only as a reference for Electron bridge shape, IPC seams, docs, and packaging discipline.

## Product Clarification

Kreeyts should wrap the Higgsfield CLI, not copy Dilag's design-studio or Pi-agent functionality. Higgsfield CLI provides login and creative-generation commands such as:

- upstream install command: `npm install -g @higgsfield/cli`; Kreeyts should prefer its pinned bundled CLI and use this only as a fallback concept
- login: `higgsfield auth login`
- command areas: `auth`, `account`, `workspace`, `model`, `generate`, `upload`, `soul-id`, `marketing-studio`, `version`

Useful Kreeyts seams are therefore likely:

- a small renderer-to-main bridge for Higgsfield CLI status and commands
- an Electron main adapter that invokes the `higgsfield` executable, streams output, and opens browser login when needed
- a small app-state module for preferences and recent jobs, if needed
- docs that describe this Higgsfield wrapper model

Out of scope unless explicitly requested: Dilag's Pi runtime, provider/model auth bridge, project/session model, generated HTML screen policy, timeline tree, design skills, and marketing web app.

For the current architecture after follow-up changes, see [architecture.md](./architecture.md).

## Resolution Notes

Resolved foundation gaps:

- Added maintained docs under `docs/`, plus `CONTEXT.md` for Kreeyts-specific domain language.
- Added a small Desktop Bridge product contract around Host App Info.
- Added a shared Electron IPC channel registry and one real IPC domain, `app-info`.
- Added a Higgsfield CLI bridge and Electron Host adapter for bundled-first executable resolution, install/auth/workspace status, sign-in, credit checks, model listing, asset picking/upload, generation, output opening, cancellation, and streamed command output.

Still deferred by design:

- project/session models,
- generated artifact policy,
- runtime bootstrap and event stream,
- native menu, zoom, theme, updater, and release automation.

## Original Baseline Inventory

| Area                          |                 Dilag |           Kreeyts | Gap                                                |
| ----------------------------- | --------------------: | ----------------: | -------------------------------------------------- |
| `apps/desktop/src`            | 145 files, 142 TS/TSX | 3 files, 2 TS/TSX | Kreeyts has only a starter renderer.               |
| `apps/desktop/electron`       |           17 TS files |        2 TS files | Kreeyts has no IPC domain modules or host runtime. |
| `packages/desktop-bridge/src` |            3 TS files |        2 TS files | Kreeyts bridge exposes only `platform`.            |
| `packages/ui/src`             |       38 TS/TSX files |    2 TS/TSX files | Kreeyts has only button/util primitives.           |
| `docs`                        |     5 maintained docs |              none | Kreeyts has no architecture or platform reference. |
| `apps/web`                    | marketing app present |            absent | Only a gap if Kreeyts needs a public site.         |

## Original Architecture Gap Matrix

| Priority | Dilag module / seam               | Dilag evidence                                                                           | Kreeyts status                                                                              | Architectural gap                                                                                                                | Recommendation                                                                                                                                             |
| -------- | --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Desktop bridge interface          | `packages/desktop-bridge/src/index.ts`, `types.ts`; `window.desktopBridge`               | `packages/desktop-bridge/src/types.ts` has `{ platform }`; preload exposes `window.kreeyts` | The renderer has no deep product-level interface. Any future native behavior would leak Electron details or duplicate IPC calls. | Define a Kreeyts product-level bridge before adding native features. Keep Electron channel names behind preload/main adapters.                             |
| P0       | Electron IPC host modules         | `apps/desktop/electron/ipc/*`, `shared/channels.ts`                                      | Only `main.ts` and `preload.ts`                                                             | No seam for native capabilities, persistence, agent/runtime work, menus, dialogs, files, updates, or events.                     | Add IPC domains only as product needs appear. Start with a shared channel registry and one real domain to avoid a shallow pass-through tree.               |
| P0       | Renderer app shell and routing    | `src/router.tsx`, `src/routes/*`, `src/components/blocks/layout/*`                       | Single `App()` in `src/main.tsx`                                                            | Kreeyts has no route-level locality for screens or flow state.                                                                   | Introduce routing when the second screen appears. Until then, keep the starter screen simple.                                                              |
| P1       | Runtime bootstrap                 | Dilag `main.tsx` calls `bridge.agent.start()` before rendering routes                    | None                                                                                        | No startup contract for long-running native/runtime prerequisites.                                                               | If Kreeyts embeds a runtime, create a bootstrap module that owns startup, failure UI, and retry behavior.                                                  |
| P1       | Normalized event stream           | Dilag `bridge.agent.onEvent()`, `context/global-events.tsx`, `context/session-store.tsx` | None                                                                                        | No event seam for main-to-renderer state updates. Future features may couple directly to Electron events.                        | Add a typed event stream when there is at least one real async producer. Keep renderer events product-level, not runtime-level.                            |
| P1       | Local app storage                 | Dilag documents `~/.dilag/state.sqlite`, project cwd files, and runtime data split       | None                                                                                        | Kreeyts has no data ownership model. File locations, migration surfaces, and privacy boundaries are undefined.                   | Decide the Kreeyts data root and ownership rules before persisting user data. Document canonical vs legacy paths early.                                    |
| P1       | Project/session model             | Dilag `projects`, `sessions`, agent session bridge, routes                               | None                                                                                        | No domain model for user workspaces, sessions, or generated outputs.                                                             | Add only the terms Kreeyts needs to `docs/platform.md` once product behavior is known. Avoid copying Dilag's model unless Kreeyts is also a design studio. |
| P1       | Generated output policy           | Dilag `packages/desktop-bridge/src/generated-screen-policy.ts`, design loader tests      | None                                                                                        | No policy module for generated artifacts.                                                                                        | If Kreeyts produces files, centralize file naming, directory rules, validation, and fallback behavior in one deep policy module.                           |
| P2       | State modules                     | Dilag uses Zustand/Immer and React Query in hooks/context                                | None                                                                                        | Kreeyts has no state seams beyond React local render.                                                                            | Wait until real shared state exists; then choose one state owner per domain to preserve locality.                                                          |
| P2       | Quality and regression tests      | Dilag Vitest setup plus focused tests under hooks/context/lib/blocks                     | No test script in root; desktop `lint` is `tsc --noEmit`                                    | No regression surface for bridge contracts, file policies, or renderer flows.                                                    | Add `test` only with the first non-trivial domain module. Prefer testing through public interfaces.                                                        |
| P2       | Native menu, zoom, theme, updater | Dilag `electron/menu.ts`, `ipc/zoom.ts`, `ipc/theme.ts`, updater context                 | None                                                                                        | Native desktop polish modules are absent.                                                                                        | Defer unless Kreeyts needs platform-native behavior. These are independent adapters, not foundational.                                                     |
| P2       | Shared UI depth                   | Dilag `packages/ui/src` plus app-specific blocks                                         | One shared `Button`                                                                         | Kreeyts shared UI is intentionally minimal.                                                                                      | Grow `packages/ui` only with reusable primitives. Keep product-specific blocks in `apps/desktop`.                                                          |
| P3       | Marketing site                    | Dilag `apps/web` Next.js app                                                             | None                                                                                        | No public web presence.                                                                                                          | Out of architecture scope unless Kreeyts needs marketing, docs, or onboarding pages.                                                                       |
| P3       | Release automation and docs       | Dilag `docs/ci.md`, release config, smoke script                                         | Basic Electron builder config                                                               | Release behavior is not documented or smoke-tested.                                                                              | Add release docs only when distribution starts. Add an Electron smoke test before relying on packaged builds.                                              |

## Deepening Opportunities

1. **Bridge contract module**
   - **Files:** `packages/desktop-bridge/src/index.ts`, `packages/desktop-bridge/src/types.ts`, `apps/desktop/electron/preload.ts`.
   - **Problem:** The current bridge interface is shallow: it exposes only `platform`, so it does not hide meaningful implementation.
   - **Solution:** When Kreeyts gets its first native capability, make the bridge a product-level module with a small interface and preload/main adapters behind it.
   - **Benefits:** Better leverage for renderer callers and better locality for Electron transport changes.

2. **IPC domain seam**
   - **Files:** `apps/desktop/electron/main.ts`, future `apps/desktop/electron/ipc/*`, future shared channels file.
   - **Problem:** Main process logic has no modular seam yet. Adding features directly to `main.ts` will spread native concerns.
   - **Solution:** Create IPC domain modules as capabilities appear, backed by a shared channel registry.
   - **Benefits:** Keeps native behavior local and makes the bridge interface the test surface.

3. **Data ownership document**
   - **Files:** future `docs/architecture.md`, future `docs/platform.md`.
   - **Problem:** Kreeyts has no documented storage or runtime data boundaries.
   - **Solution:** Before persistence, document app data root, project-owned files, generated files, and migration/fallback rules.
   - **Benefits:** Prevents storage decisions from leaking across renderer, main, and generated-output modules.

4. **Generated artifact policy module**
   - **Files:** future policy module under `packages/desktop-bridge/src` or `apps/desktop/src/lib` depending on consumers.
   - **Problem:** Dilag's generated-screen policy is a deep module; Kreeyts has no equivalent because it has no artifact model yet.
   - **Solution:** If Kreeyts generates files, centralize path rules, validation, and display eligibility in one module.
   - **Benefits:** Strong locality for artifact bugs and high leverage across host, renderer, and tests.

## Suggested Next Docs

| Doc                    | Purpose                                                       | When to add                                     |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `docs/README.md`       | Index maintained docs.                                        | Now, if more docs are planned.                  |
| `docs/architecture.md` | Current runtime architecture, bridge, process seams, storage. | Before implementing native/persistent features. |
| `docs/platform.md`     | Product model, screens, core flows, feature checklist.        | Once Kreeyts product behavior is defined.       |
| `docs/development.md`  | Toolchain, commands, package roles, completion contract.      | Before onboarding another contributor or agent. |
| `docs/ci.md`           | CI, release, signing, updater notes.                          | Before CI/release automation exists.            |
