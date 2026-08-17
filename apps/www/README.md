# Assetwell website

Public TanStack Start site for Assetwell.

## Development

From the repo root:

```bash
bun install
bun run dev:www
```

Open `http://localhost:3000`.

## Download routes

The public CTA links to `/download`, where visitors pick a platform. Platform availability and release-asset matching live in `@assetwell/product/downloads`.

`/api/download?platform=macos`, `/api/download?platform=windows`, and `/api/download?platform=linux` redirect to the latest matching release asset for each platform.

Those redirects are returned with `Cache-Control: private, no-store` so a CDN never serves them from cache and every visitor reaches the function. The unavailable-platform 404 is still publicly cacheable.

## Download analytics

`POSTHOG_PROJECT_KEY` and `POSTHOG_HOST` are **server** environment variables on Vercel (not `VITE_`-prefixed, so they never reach the browser). Point them at the same PostHog project used by desktop analytics. When `POSTHOG_PROJECT_KEY` is unset the route captures nothing and downloads behave exactly the same.

`/api/download` sends one anonymous `download redirected` event per request, with only these properties:

- `platform`: `macos` | `windows` | `linux`
- `release_version`: latest release tag without a leading `v`, or `unknown`
- `asset_kind`: `dmg` | `exe` | `appimage` | `release_page`
- `outcome`: `installer` (a primary installer was resolved) | `fallback` (redirected to the releases page)

Every event uses a random per-event distinct ID with `$process_person_profile: false` and GeoIP disabled. No cookies, IP, user-agent, or headers are sent, so events cannot be joined into a visitor identity.

PostHog dashboard query: a **trend** on `download redirected`, measured as **total event count**, broken down by `platform` and by `release_version`.

### Reading the two metrics

Cumulative primary installer counts from GitHub (read-only):

```sh
gh api repos/noelrohi/assetwell/releases --paginate \
  --jq '.[] | {tag: .tag_name, assets: [.assets[] | select(.name | test("\\.(dmg|exe|AppImage)$")) | {name, downloads: .download_count}]}'
```

- PostHog `download redirected` = **website download attempts**, breakable by platform and version.
- GitHub `.dmg` / `.exe` / `.AppImage` `download_count` = **primary release-asset requests**, the closest available completion proxy.
- Neither number is a count of unique installed users; a single person can appear many times, and downloads from outside the website never appear in PostHog.
- Do not sum updater `.zip`, `.blockmap`, or `latest*.yml` counts into download totals — those are auto-update traffic, not installs. The `gh` command above already filters them out.
- GitHub counters are cumulative per asset and disappear if a release asset is deleted.

## Social previews

Favicons, app icons, and the Open Graph image live in `public/`.

Set `VITE_SITE_URL` in production so canonical and Open Graph URLs are absolute:

```bash
VITE_SITE_URL=https://your-domain.example
```

## Vercel

TanStack Start deploys to Vercel through Nitro. This app's Vite config uses the Nitro Vercel preset, which writes the Vercel Build Output API files to `.vercel/output`.

Recommended Vercel setup:

- Root Directory: `apps/www`
- Install Command: `bun install`
- Build Command: `bun run build`
- Output Directory: leave unset
- Environment Variables: set `VITE_SITE_URL` to the deployed site URL, and set `POSTHOG_PROJECT_KEY` / `POSTHOG_HOST` as server environment variables to enable download analytics
