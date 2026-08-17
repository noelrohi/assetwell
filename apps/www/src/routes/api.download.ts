import type { DownloadPlatformId } from "@assetwell/product/downloads"
import {
  getDownloadPlatform,
  isDownloadPlatformAvailable,
  pickDownloadReleaseAsset,
  resolveDownloadPlatform,
} from "@assetwell/product/downloads"
import { createFileRoute } from "@tanstack/react-router"

import type { DownloadRedirectInput } from "../lib/analytics.server"
import { captureDownloadRedirect } from "../lib/analytics.server"
import { LATEST_RELEASE_API_URL, RELEASES_URL } from "../lib/constants"

type GitHubAsset = {
  name: string
  browser_download_url: string
}

type GitHubRelease = {
  html_url?: string
  tag_name?: string
  assets?: Array<GitHubAsset>
}

export type DownloadResponseDeps = {
  fetchRelease?: () => Promise<Response>
  capture?: (input: DownloadRedirectInput) => Promise<unknown>
}

export const Route = createFileRoute("/api/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url)
        const platform = resolveDownloadPlatform(
          requestUrl.searchParams.get("platform"),
          request.headers.get("user-agent"),
        )

        return resolveDownloadResponse(platform)
      },
    },
  },
})

/**
 * Resolves the redirect for an available platform and records a best-effort
 * `download redirected` event. Analytics never changes the response.
 */
export async function resolveDownloadResponse(
  platform: DownloadPlatformId,
  deps: DownloadResponseDeps = {},
): Promise<Response> {
  const platformSpec = getDownloadPlatform(platform)

  if (!isDownloadPlatformAvailable(platform)) {
    return platformUnavailable(platformSpec)
  }

  const fetchRelease =
    deps.fetchRelease ??
    (() =>
      fetch(LATEST_RELEASE_API_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "assetwell-www",
        },
      }))
  const capture = deps.capture ?? captureDownloadRedirect

  const record = async (input: DownloadRedirectInput) => {
    try {
      await capture(input)
    } catch {
      // A failing analytics call must not change the redirect.
    }
  }

  try {
    const response = await fetchRelease()

    if (!response.ok) {
      await record({ platform, outcome: "fallback" })
      return redirectTo(RELEASES_URL)
    }

    const release = (await response.json()) as GitHubRelease
    const asset = pickDownloadReleaseAsset(release.assets ?? [], platform)

    await record({
      platform,
      releaseTag: release.tag_name ?? null,
      assetName: asset?.name ?? null,
      outcome: asset ? "installer" : "fallback",
    })

    return redirectTo(
      asset?.browser_download_url ?? release.html_url ?? RELEASES_URL,
    )
  } catch {
    await record({ platform, outcome: "fallback" })
    return redirectTo(RELEASES_URL)
  }
}

function platformUnavailable(platform: ReturnType<typeof getDownloadPlatform>) {
  return new Response(
    platform.unavailableReason ?? `${platform.name} downloads are unavailable.`,
    {
      status: 404,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  )
}

/**
 * Redirects are deliberately uncacheable so every visitor reaches the function
 * and is counted once; a CDN-cached 302 would undercount downloads.
 */
function redirectTo(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "private, no-store",
    },
  })
}
