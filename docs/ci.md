# CI/CD

CI is intentionally small and mirrors the local quality gates.

## Pull requests and master

`.github/workflows/ci.yml` runs on pull requests and pushes to `master`:

```bash
bun install --frozen-lockfile
bun run fmt:check
bun run typecheck
bun run lint
bun run build
```

`build` compiles the desktop renderer and Electron host. Native packaging stays in the release workflow because signing, notarization, and updater metadata require release credentials.

## Desktop releases

`.github/workflows/release.yml` publishes desktop releases from semver tags for macOS, Windows, and Linux.

Release flow for humans or agents:

1. Update `CHANGELOG.md` with a `## [X.Y.Z] - YYYY-MM-DD` entry.
2. Bump `apps/desktop/package.json` to `X.Y.Z`.
3. Run local checks: `bun run fmt:check`, `bun run typecheck`, `bun run lint`, `bun run build`.
4. Commit the changelog/version changes.
5. Create and push `vX.Y.Z`.
6. Watch the GitHub Actions release workflow.

The workflow verifies that `apps/desktop/package.json` matches the tag, creates or updates the GitHub Release, then runs `electron-builder` on a platform matrix:

```bash
bun run --cwd apps/desktop dist -- --mac dmg zip --arm64 --publish always
bun run --cwd apps/desktop dist -- --win nsis --x64 --publish always
bun run --cwd apps/desktop dist -- --linux AppImage --x64 --publish always
```

Manual workflow runs accept a specific release tag or `latest` to republish assets to the current latest GitHub Release. After all platform jobs finish, the workflow verifies that the latest release contains a macOS `.dmg`, a Windows `.exe`, and a Linux `.AppImage`.

## Signing secrets

Add these repository secrets before the first signed release:

- `APPLE_CERTIFICATE`: base64/p12 certificate accepted by `electron-builder` as `CSC_LINK`.
- `APPLE_CERTIFICATE_PASSWORD`: certificate password.
- `APPLE_ID`: Apple developer account email.
- `APPLE_PASSWORD`: app-specific Apple ID password.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

`GITHUB_TOKEN` is provided by GitHub Actions and is used to create releases and upload artifacts. Windows and Linux artifacts are currently published unsigned; add platform signing secrets before requiring trusted installer signatures on those platforms.

## Product analytics configuration

Packaged builds can report anonymous product analytics to PostHog. The renderer only initializes PostHog when the build was given a project key, so this configuration is what turns measurement on for releases.

Add these repository **variables** (Settings → Secrets and variables → Actions → Variables), not secrets:

- `POSTHOG_PROJECT_KEY`: the PostHog project API key (`phc_…`), passed to the Vite build as `VITE_POSTHOG_KEY`.
- `POSTHOG_HOST`: the PostHog ingestion host for your project's region, passed as `VITE_POSTHOG_HOST`. Leave it unset to use the app's default, `https://us.i.posthog.com`.

Both are read by the two `publish-electron` build steps in `.github/workflows/release.yml`. Vite exposes `VITE_`-prefixed variables to the renderer build automatically.

A PostHog project key is public by design — it ships inside every installer and can only write events. It is **not** a PostHog personal API key, which can read and administer your project and must never be added to this repository, in a variable or a secret.

If either variable is missing, the release still builds and the app simply ships with analytics disabled and makes no analytics network calls.

Analytics are optional for users too: **Share anonymous usage analytics** in the account menu writes `analyticsEnabled` into the app's `settings.json` and opts PostHog in or out immediately. It defaults on. Events carry no prompts, file paths, media, account details, workspace/model IDs, or command output — only `app opened` (app version, platform, packaged flag), `generation requested`, `generation completed`, `export completed`, and `analytics preference changed`.

### Dashboard to create in PostHog

1. **Active installations**: unique users on `app opened`, trended by day, week, and month (DAU/WAU/MAU).
2. **Retention**: a retention insight with `app opened` as both the cohortizing and returning event; read the day 1, 7, and 30 columns.
3. **Version adoption**: `app opened` broken down by the `app_version` property.
4. **Core funnel**: `app opened` → `generation requested` → `generation completed` (filtered to `outcome = success`) → `export completed`.

## Website environment variables

`apps/www` deploys to Vercel. Set these as **server** environment variables there (never commit values):

- `POSTHOG_PROJECT_KEY`: enables the anonymous `download redirected` event on `/api/download`. Leave it unset to disable download analytics; downloads keep working either way.
- `POSTHOG_HOST`: PostHog ingestion host, defaults to `https://us.i.posthog.com`. Use the same PostHog project as desktop analytics.

Download reporting uses two independent metrics: PostHog `download redirected` counts website download attempts, and GitHub release-asset `download_count` for `.dmg`/`.exe`/`.AppImage` counts primary installer requests. Neither is an installed-user count, and updater `.zip`/`.blockmap`/`latest*.yml` counts must not be summed into download totals. See `apps/www/README.md` for the dashboard query and the read-only `gh api` command.

## Auto-updates

Assetwell uses `electron-updater` with the GitHub provider configured in `apps/desktop/package.json`. Packaged apps check for updates shortly after launch, expose **Check for Updates…** in the app menu, download updates in the background, notify the user when an update is ready, show a titlebar Update button once the download is ready, and install on app quit or when the user restarts from the button.

The macOS updater needs both `zip` output and `latest-mac.yml`; Windows uses NSIS metadata, and Linux uses AppImage metadata. The release workflow publishes a macOS `dmg` and `zip`, a Windows NSIS installer, and a Linux AppImage so GitHub Releases can serve manual downloads and update metadata. Set `ASSETWELL_DISABLE_AUTO_UPDATES=1` to disable checks while debugging a packaged app.

## Still missing

- Windows/Linux code signing.
- A packaged-app smoke test after signing/notarization.
