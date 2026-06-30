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
bun run --cwd apps/desktop dist -- --mac dmg zip --arm64 --publish always -c.publish.releaseType=release
bun run --cwd apps/desktop dist -- --win nsis --x64 --publish always -c.publish.releaseType=release
bun run --cwd apps/desktop dist -- --linux AppImage --x64 --publish always -c.publish.releaseType=release
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

## Auto-updates

Assetwell uses `electron-updater` with the GitHub provider configured in `apps/desktop/package.json`. Packaged apps check for updates shortly after launch, expose **Check for Updates…** in the app menu, download updates in the background, notify the user when an update is ready, show a titlebar Update button once the download is ready, and install on app quit or when the user restarts from the button.

The macOS updater needs both `zip` output and `latest-mac.yml`; Windows uses NSIS metadata, and Linux uses AppImage metadata. The release workflow publishes a macOS `dmg` and `zip`, a Windows NSIS installer, and a Linux AppImage so GitHub Releases can serve manual downloads and update metadata. Set `ASSETWELL_DISABLE_AUTO_UPDATES=1` to disable checks while debugging a packaged app.

## Still missing

- Windows/Linux code signing.
- A packaged-app smoke test after signing/notarization.
