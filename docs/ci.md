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

`.github/workflows/release.yml` publishes signed macOS desktop releases from semver tags.

Release flow for humans or agents:

1. Update `CHANGELOG.md` with a `## [X.Y.Z] - YYYY-MM-DD` entry.
2. Bump `apps/desktop/package.json` to `X.Y.Z`.
3. Run local checks: `bun run fmt:check`, `bun run typecheck`, `bun run lint`, `bun run build`.
4. Commit the changelog/version changes.
5. Create and push `vX.Y.Z`.
6. Watch the GitHub Actions release workflow.

The workflow verifies that `apps/desktop/package.json` matches the tag, creates or updates the GitHub Release, then runs `electron-builder` on `macos-14`:

```bash
bun run --cwd apps/desktop dist -- --mac dmg zip --arm64 --publish always -c.publish.releaseType=release
```

## Signing secrets

Add these repository secrets before the first signed release:

- `APPLE_CERTIFICATE`: base64/p12 certificate accepted by `electron-builder` as `CSC_LINK`.
- `APPLE_CERTIFICATE_PASSWORD`: certificate password.
- `APPLE_ID`: Apple developer account email.
- `APPLE_PASSWORD`: app-specific Apple ID password.
- `APPLE_TEAM_ID`: Apple Developer Team ID.

`GITHUB_TOKEN` is provided by GitHub Actions and is used to create releases and upload artifacts.

## Auto-updates

Assetwell uses `electron-updater` with the GitHub provider configured in `apps/desktop/package.json`. Packaged apps check for updates shortly after launch, download updates in the background, notify the user when an update is ready, and install on app quit.

The macOS updater needs both `zip` output and `latest-mac.yml`; the release workflow publishes `dmg` and `zip` so GitHub Releases can serve manual downloads and update metadata. Set `ASSETWELL_DISABLE_AUTO_UPDATES=1` to disable checks while debugging a packaged app.

## Still missing

- Windows/Linux release jobs and signing.
- A packaged-app smoke test after signing/notarization.
- A renderer/menu surface for manual “Check for updates”.
- Public download page or stable download URL.
