# Plan 008: Measure anonymous desktop engagement with PostHog

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update this plan's row in `plans/README.md` unless a reviewer says they maintain the index.
>
> **Drift check (run first)**: `git diff --stat fd26472..HEAD -- apps/desktop packages/desktop-bridge .github/workflows/release.yml docs`
> If an in-scope file changed, compare the current-state excerpts below with live code before proceeding. A material mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `fd26472`, 2026-07-15

## Why this matters

GitHub updater requests show that packaged copies may still launch, but they cannot produce unique active-installation or retention metrics. Add deliberately limited anonymous product analytics so the maintainer can see app opens, successful core actions, app-version adoption, DAU/WAU/MAU, and 1/7/30-day retention. Analytics must remain optional, must never affect product behavior, and must never capture creative content or Higgsfield-owned identifiers.

## Current state

- `apps/desktop/src/main.tsx` mounts the renderer providers but has no analytics initialization.
- `apps/desktop/electron/main.ts` starts the host and updater after `app.whenReady()`; do not put a browser analytics SDK in this process.
- `packages/desktop-bridge/src/types.ts:452-454` currently exposes only the output root:

```ts
export interface AssetwellSettings {
  outputRoot: string
}
```

- `apps/desktop/electron/settings-store.ts:8-12` stores app settings under the canonical App Data Root:

```ts
export interface SettingsFile {
  outputRoot?: unknown
  activeUploadWorkspaceId?: unknown
  uploadWorkspaces?: unknown
}
```

- `apps/desktop/src/components/blocks/layout/nav-user.tsx` is the existing account/settings menu and already shows library-folder controls. It imports its dropdown pieces from `apps/desktop/src/components/ui/dropdown-menu.tsx`, which also exports `DropdownMenuCheckboxItem` (not yet imported by nav-user — add it to the existing import). Put the analytics preference there rather than creating a settings page.
- The bridge already exposes host app info: `app.getInfo(): Promise<HostAppInfo>` (`packages/desktop-bridge/src/types.ts:502`), where `HostAppInfo` (`types.ts:1-6`) carries `version` and `isPackaged`. Use it for the `app_version` / `is_packaged` properties — do not add a new bridge method for this.
- `apps/desktop/src/lib/higgsfield/generation-actions.ts` owns starts and outcomes for image/video generation. `apps/desktop/electron/local-store.ts` owns successful exports.
- The Desktop Bridge must stay typed across `packages/desktop-bridge`, IPC channels, handlers, preload, and renderer usage. Match the existing `library.getSettings()` flow.
- Domain constraints from `CONTEXT.md`: the App Data Root is `app.getPath("userData")`; Assetwell does not own Higgsfield accounts, workspaces, models, uploads, or jobs. Never send those identifiers.

## Commands you will need

| Purpose           | Command                                                                                   | Expected on success                                |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Install           | `bun install`                                                                             | exit 0; `bun.lock` updated, no npm lockfile        |
| Focus tests       | `bun --filter @assetwell/desktop test`                                                    | all pass                                           |
| Focus typecheck   | `bun --filter @assetwell/desktop typecheck`                                               | exit 0                                             |
| Full verification | `bun run fmt:check && bun run test && bun run typecheck && bun run lint && bun run build` | every command exits 0                              |
| Packaging         | `bun run electron:dist`                                                                   | installers and updater metadata build successfully |

Reference before implementation: https://posthog.com/tutorials/electron-analytics and https://posthog.com/docs/product-analytics/privacy.

## Scope

**In scope**:

- `apps/desktop/package.json`, `bun.lock`
- `apps/desktop/src/lib/analytics.ts` and `apps/desktop/src/lib/analytics.test.ts` (create)
- `apps/desktop/src/main.tsx`
- `apps/desktop/src/lib/higgsfield/generation-actions.ts`
- the existing renderer export-success call sites found from `exportCreativeZip` / `exportVideo`
- `apps/desktop/src/components/blocks/layout/nav-user.tsx`
- `apps/desktop/src/lib/higgsfield.tsx`, `apps/desktop/src/lib/higgsfield/types.ts`
- `packages/desktop-bridge/src/types.ts`, `packages/desktop-bridge/src/index.ts`
- `apps/desktop/electron/settings-store.ts`, `apps/desktop/electron/local-store.ts`, `apps/desktop/electron/ipc/library.ts`
- `apps/desktop/electron/shared/channels.ts`, `apps/desktop/electron/preload.ts`
- corresponding existing tests under `apps/desktop/electron/`
- `.github/workflows/release.yml`, `docs/ci.md`

**Out of scope**:

- Session replay, autocapture, surveys, feature flags, user identification, Sentry, or advertising attribution.
- Capturing prompts, filenames/paths, media URLs, generated content, account email, plan, credits, workspace/upload/brand/folder IDs, model IDs, raw commands, stdout, or stderr.
- Changing generation, export, authentication, updater, or release behavior.
- Adding analytics to development/test builds by default.

## Git workflow

- Branch: `advisor/008-desktop-product-analytics`
- Use the repo's conventional style, e.g. `feat(desktop): add privacy-safe product analytics`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a tested, no-op-safe analytics adapter

Add `posthog-js` to `apps/desktop` with Bun. Create `apps/desktop/src/lib/analytics.ts` as the only module allowed to import PostHog. Import the bundled/no-external browser build recommended for Electron; do not load remote code.

The adapter must:

- initialize only when `import.meta.env.PROD`, `VITE_POSTHOG_KEY` is non-empty, and analytics are enabled;
- use `VITE_POSTHOG_HOST` with a documented default matching the chosen PostHog region;
- explicitly disable autocapture, automatic pageviews/pageleaves, and session recording;
- never call `identify`; configure person profiles as identified-only and send anonymous events;
- persist PostHog's random anonymous distinct ID in renderer local storage so retention works; do not derive it from hardware, email, Higgsfield state, or file paths;
- expose a narrow typed API, not arbitrary event strings/properties;
- swallow SDK/network failures and remain a no-op when unconfigured;
- prevent duplicate `app opened` events caused by React Strict Mode during one renderer process.

Allow exactly these v1 events and properties:

- `app opened`: `app_version`, `platform`, `is_packaged`
- `generation requested`: `media_kind` (`image` or `video` only)
- `generation completed`: `media_kind`, `outcome` (`success`, `failed`, `cancelled`)
- `export completed`: `media_kind`
- `analytics preference changed`: `enabled`

Unit-test disabled/unconfigured behavior, strict event/property allowlisting, opt-in/opt-out calls, failure swallowing, and single app-open capture using an injected/mock SDK boundary.

**Verify**: `bun test apps/desktop/src/lib/analytics.test.ts` → all new tests pass.

### Step 2: Persist and bridge the privacy preference

Extend `AssetwellSettings` with `analyticsEnabled: boolean`. Extend `SettingsFile` with an unknown raw field, normalize it in `readAssetwellSettingsSync()`, and default it to `true` only when absent. Add a product-level `library.setAnalyticsEnabled({ enabled })` bridge method that merges into the existing settings JSON without discarding output/workspace fields.

Update channel names, IPC registration, preload mapping, barrel exports, and tests together. In particular:

- `settings-store.test.ts`: missing value defaults true; booleans round-trip; malformed values default true; unrelated fields survive writes.
- `local-store.test.ts`: changing the preference preserves `outputRoot` and returns the normalized settings.
- `preload.test.ts` and `shared/channels.test.ts`: exact channel mapping.

Do not add a second settings file or store the preference under the Output Root.

**Verify**: `bun test apps/desktop/electron/settings-store.test.ts apps/desktop/electron/local-store.test.ts apps/desktop/electron/preload.test.ts apps/desktop/electron/shared/channels.test.ts` → all pass.

### Step 3: Initialize app-open tracking and expose the toggle

Initialize analytics after both host app info and persisted settings are available. Avoid mounting a second copy of `HiggsfieldProvider`; add a small provider/hook only if needed. A web-preview/dev renderer without `window.assetwell` must remain functional and untracked.

In `nav-user.tsx`, add `DropdownMenuCheckboxItem` labeled **Share anonymous usage analytics** with a short adjacent/sub-label such as **App opens and feature usage; never your content**. On change:

1. persist through `library.setAnalyticsEnabled`;
2. update renderer state only after success;
3. call PostHog opt-in/opt-out immediately;
4. capture `analytics preference changed` only when turning analytics on;
5. show a humane error toast if persistence fails.

When disabled, no subsequent event may be sent. Do not log the setting or PostHog key.

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0, then manually run `bun run electron:dev` and confirm the toggle persists after relaunch without analytics network calls in dev.

### Step 4: Instrument only core, content-free outcomes

Call the typed adapter at existing business-action boundaries:

- after a generation request is accepted by the bridge: `generation requested`;
- once when the matching command reaches terminal success/failure/cancellation: `generation completed`;
- after an export API resolves successfully with an output: `export completed`.

Use only `media_kind` and the finite outcome values. Do not include model, prompt, placement dimensions, brand, workspace, file, timing, account, or error data. Guard against duplicate terminal events using the existing completed-run protections.

Add focused tests around the instrumentation boundary or extract pure event-classification helpers when direct hook tests would be brittle. Analytics failure must not change action return values, toasts, or state transitions.

**Verify**: `bun --filter @assetwell/desktop test` → all pass.

### Step 5: Wire production configuration and document the dashboard

Add the public PostHog project token and host to each packaging build through GitHub Actions repository **variables**, not hardcoded source values:

- `POSTHOG_PROJECT_KEY` → passed to Vite as `VITE_POSTHOG_KEY`
- `POSTHOG_HOST` → passed to Vite as `VITE_POSTHOG_HOST`

In `.github/workflows/release.yml`, the `publish-electron` job has exactly two build steps that run `bun run --cwd apps/desktop dist`: **"Build and publish signed macOS app"** and **"Build and publish unsigned Windows/Linux app"**. Add to both steps' existing `env:` blocks:

```yaml
VITE_POSTHOG_KEY: ${{ vars.POSTHOG_PROJECT_KEY }}
VITE_POSTHOG_HOST: ${{ vars.POSTHOG_HOST }}
```

(`vars.*`, not `secrets.*` — the project token is public-by-design and repository variables keep that distinction visible.) Vite exposes `VITE_`-prefixed env vars to the renderer build by default; `apps/desktop/vite.config.ts` sets no custom `envPrefix`, so no config change is needed.

If either variable is absent, the release build must still succeed with analytics disabled. Document setup in `docs/ci.md`, including that the project token is public-by-design but must not be confused with a PostHog personal API key.

Document PostHog insights to create:

1. unique `app opened` installations by day/week/month;
2. retention based on `app opened` at day 1, 7, and 30;
3. app-version adoption from `app_version`;
4. funnel `app opened` → `generation requested` → successful `generation completed` → `export completed`.

**Verify**: inspect the workflow with `rg 'POSTHOG|VITE_POSTHOG' .github/workflows/release.yml docs/ci.md` → both variables and no personal API key; then run full verification and `bun run electron:dist`.

## Test plan

- `apps/desktop/src/lib/analytics.test.ts`: configuration/no-op, event allowlist, opt-out, failure isolation, Strict Mode duplicate guard.
- `apps/desktop/electron/settings-store.test.ts`: defaulting and normalization.
- `apps/desktop/electron/local-store.test.ts`: preference persistence preserves unrelated settings.
- `apps/desktop/electron/preload.test.ts` and `shared/channels.test.ts`: typed bridge completeness.
- Existing generation/export tests: analytics side effects never alter outcomes.

## Done criteria

- [ ] `posthog-js` is the only analytics SDK in the desktop app and has one import boundary.
- [ ] No analytics event can contain free-form product/user content.
- [ ] Analytics defaults are documented, visible, persistent, and immediately opt-outable.
- [ ] Missing configuration produces no network calls and does not break builds.
- [ ] `bun run fmt:check`, tests, typecheck, lint, build, and `bun run electron:dist` all exit 0.
- [ ] `rg -i 'prompt|filePath|workspaceId|email|stderr|stdout' apps/desktop/src/lib/analytics.ts` shows none of those as captured properties.
- [ ] Only in-scope files plus `plans/README.md` changed.

## STOP conditions

Stop and report if:

- PostHog's current Electron-compatible package cannot be bundled without remote code under the app's isolation/CSP constraints.
- Accurate retention would require hardware fingerprinting or Higgsfield account identification.
- A product outcome cannot be instrumented without transmitting free-form content or altering its behavior.
- The preference cannot be preserved by merging the existing `settings.json`.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

Review new events as a privacy/API surface: every added property needs a product reason and a test proving arbitrary values cannot leak. If Assetwell later adds a privacy policy URL or settings page, move the disclosure there but keep the sidebar toggle. Do not enable session replay merely because the SDK supports it.
