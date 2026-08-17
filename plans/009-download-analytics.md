# Plan 009: Count download redirects and release-asset downloads

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report — do not improvise. When done, update this plan's row in `plans/README.md` unless a reviewer says they maintain the index.
>
> **Drift check (run first)**: `git diff --stat fd26472..HEAD -- apps/www bun.lock docs`
> Material changes to the download route or deployment configuration are a STOP condition until reconciled.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (use the same PostHog project as plan 008 when both land)
- **Category**: direction
- **Planned at**: commit `fd26472`, 2026-07-15

## Why this matters

GitHub exposes cumulative `download_count` per release asset, but those counts mix primary installers with updater ZIPs, blockmaps, and metadata. Assetwell already funnels website downloads through one server route, so it can separately measure download intent by platform while retaining GitHub's installer counts as the closest available completion proxy. The download must continue even when analytics is missing or unavailable.

## Current state

- `apps/www` is a TanStack Start app deployed to Vercel through Nitro.
- `apps/www/src/routes/download.tsx` (~line 118) links available platforms to `` `${DOWNLOAD_START_URL}?platform=${platform.id}` ``; `DOWNLOAD_START_URL` is `"/api/download"` in `apps/www/src/lib/constants.ts:13`.
- `apps/www/src/routes/api.download.ts` fetches the latest GitHub Release and redirects to the selected installer. **Every** 302 — installer hit, missing-asset fallback, and GitHub-error fallback — goes through the single `redirectTo()` helper at `api.download.ts:74-82`, which currently sets:

```ts
"Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600"
```

A CDN can therefore serve repeated redirects without invoking server code; server-side analytics would undercount unless successful redirect responses become non-cacheable.

- The route's `GitHubRelease` type currently lacks `tag_name`, and `GitHubAsset` has `name` and `browser_download_url`.
- `@assetwell/product/downloads` is the canonical platform/asset policy and must remain the selector.
- The existing tests in `apps/www/src/lib/downloads.test.ts` prove `.dmg`, `.exe`, and `.AppImage` selection while excluding updater metadata.

## Commands you will need

| Purpose           | Command                                                                                   | Expected on success             |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| Install           | `bun install`                                                                             | exit 0; only `bun.lock` changes |
| Website tests     | `bun --filter @assetwell/www test`                                                        | all pass                        |
| Website typecheck | `bun --filter @assetwell/www typecheck`                                                   | exit 0                          |
| Full verification | `bun run fmt:check && bun run test && bun run typecheck && bun run lint && bun run build` | every command exits 0           |

Read the current cumulative GitHub installer counts (read-only; expected output is JSON containing only primary installers, no updater ZIPs/blockmaps/`latest*.yml`):

```sh
gh api repos/noelrohi/assetwell/releases --paginate \
  --jq '.[] | {tag: .tag_name, assets: [.assets[] | select(.name | test("\\.(dmg|exe|AppImage)$")) | {name, downloads: .download_count}]}'
```

Reference: https://posthog.com/docs/libraries/node and https://docs.github.com/en/rest/releases/releases.

## Scope

**In scope**:

- `apps/www/package.json`, `bun.lock`
- `apps/www/.env.example`
- `apps/www/src/lib/analytics.server.ts` and test (create)
- `apps/www/src/routes/api.download.ts` and a focused route/helper test
- `apps/www/README.md`, `docs/ci.md`

**Out of scope**:

- Treating update ZIPs, blockmaps, or `latest*.yml` requests as installer downloads.
- Client-side click analytics, cookies, fingerprinting, IP storage, user-agent storage, or identifying website visitors.
- A database, scheduled snapshot job, public download counter, or custom dashboard inside Assetwell.
- Changing platform availability or release-asset selection policy.

## Git workflow

- Branch: `advisor/009-download-analytics`
- Suggested commit: `feat(www): track download redirects`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a server-only PostHog adapter

Add `posthog-node` to `apps/www`. Create `apps/www/src/lib/analytics.server.ts`; no client-rendered module may import it.

Expose a narrow function for a `download redirected` event with only:

- `platform`: `macos | windows | linux`
- `release_version`: normalized `tag_name` without a leading `v`, or `unknown`
- `asset_kind`: `dmg | exe | appimage | release_page`
- `outcome`: `installer | fallback`

Requirements:

- Read `POSTHOG_PROJECT_KEY` and `POSTHOG_HOST` only on the server.
- Return immediately when unconfigured.
- Use `captureImmediate` for Vercel/serverless with a request timeout no higher than one second.
- Use a random per-event distinct ID and `$process_person_profile: false`; do not derive identity from IP, headers, cookies, or URL parameters.
- Never pass request headers to PostHog and keep GeoIP disabled.
- Swallow analytics errors. A PostHog outage must not change a redirect.
- Keep event/property construction in a pure helper so it is unit-testable without network access.

**Verify**: `bun test apps/www/src/lib/analytics.server.test.ts` → all tests pass, including unconfigured no-op, exact allowlisted properties, and SDK failure swallowing.

### Step 2: Capture resolved download redirects without CDN undercounting

Extend the local GitHub response type with `tag_name?: string`. After selecting the installer and before returning the response, call the adapter. Record `installer` only when `pickDownloadReleaseAsset` returns a primary asset; otherwise record `fallback` / `release_page`.

Change the `redirectTo()` helper (`api.download.ts:74-82`) to send `Cache-Control: private, no-store` so every visitor reaches the function. This covers all three 302 paths — installer, missing-asset fallback, and GitHub-error fallback — which is required because fallbacks must also be captured. The upstream GitHub response can still rely on normal HTTP caching behavior, but the user-facing redirect cannot be CDN-cached. Keep the unavailable-platform 404 response (`platformUnavailable()`, `api.download.ts:62-72`) and its existing public cache header unchanged.

If GitHub returns non-OK or throws, best-effort capture a fallback event and immediately redirect to the GitHub Releases page. Analytics must add no more than its configured one-second timeout to the path.

Extract helpers if necessary rather than making the route test depend on Vercel. Tests must cover:

1. macOS installer event and redirect;
2. Windows installer event and redirect;
3. missing matching asset → release-page fallback;
4. GitHub non-OK/throw → release-page fallback;
5. analytics rejection still returns the same 302;
6. successful redirects are `private, no-store`.

**Verify**: `bun --filter @assetwell/www test && bun --filter @assetwell/www typecheck` → all pass.

### Step 3: Configure Vercel and document how to read both metrics

Add placeholders to `apps/www/.env.example`:

```text
POSTHOG_PROJECT_KEY=
POSTHOG_HOST=https://us.i.posthog.com
```

Do not put real values in the repository. Document in `apps/www/README.md` that both are Vercel server environment variables and should point to the same PostHog project as desktop analytics. Explain:

- PostHog `download redirected` = website download attempts, breakable by platform/version;
- GitHub `.dmg` / `.exe` / `.AppImage` `download_count` = primary release-asset requests and the closest completion proxy;
- neither metric is a unique installed user count;
- updater ZIP, blockmap, and `latest*.yml` counts must not be summed.

Include the read-only `gh api` command from "Commands you will need" in the README. Add the PostHog dashboard query: trend `download redirected`, total events, breakdown by `platform` and `release_version`.

**Verify**: `rg 'POSTHOG_PROJECT_KEY|download redirected|download_count' apps/www/.env.example apps/www/README.md docs/ci.md` → configuration and interpretation are documented with no credential value.

### Step 4: Run full checks

Run the repository verification order. Confirm no `package-lock.json`, npm lockfile, database, or client analytics bundle was added.

**Verify**: `bun run fmt:check && bun run test && bun run typecheck && bun run lint && bun run build` → all exit 0; `git status --short` contains only in-scope files and `plans/README.md`.

## Test plan

- New analytics adapter test: disabled, exact payload, anonymous profile setting, timeout configuration, failure isolation.
- New/focused download-route test: installer/fallback/error paths and no-store response.
- Existing `apps/www/src/lib/downloads.test.ts` remains the source of truth for primary installer selection.

## Done criteria

- [ ] Every available website download request is counted at the server route when PostHog is configured.
- [ ] PostHog downtime or missing configuration never blocks/changes a download.
- [ ] Event properties contain no request identity, headers, IP, cookie, or user-agent.
- [ ] Successful redirect responses are not publicly cached.
- [ ] Documentation clearly separates redirect attempts, GitHub installer requests, and active installations.
- [ ] All full verification commands pass.
- [ ] No files outside scope plus `plans/README.md` changed.

## STOP conditions

Stop and report if:

- Vercel/Nitro does not execute the handler in a Node-compatible runtime supported by the installed `posthog-node` version.
- Reliable capture requires adding cookies, fingerprinting, or a database.
- Disabling redirect caching causes unacceptable GitHub API rate-limit behavior in realistic traffic; report the measured/requested limits rather than silently restoring public caching.
- The latest-release response no longer includes the selected installer URL/tag.
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

GitHub asset counters are cumulative and disappear with deleted release assets. If historical daily completion curves become important, add a separate scheduled snapshot plan later; do not turn this request path into a database writer. Keep the event schema stable so dashboard trends survive future releases.
