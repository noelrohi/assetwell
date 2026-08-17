import type { DownloadPlatformId } from "@assetwell/product/downloads"
import { PostHog } from "posthog-node"

/**
 * Server-only analytics for the download redirect route.
 *
 * This module reads server environment variables and talks to PostHog. It must
 * never be imported from a client-rendered module.
 */

export const DOWNLOAD_REDIRECTED_EVENT = "download redirected"

/** Keep analytics off the critical path of a redirect. */
export const ANALYTICS_REQUEST_TIMEOUT_MS = 1000

export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"

export type DownloadAssetKind = "dmg" | "exe" | "appimage" | "release_page"
export type DownloadOutcome = "installer" | "fallback"

export type DownloadRedirectInput = {
  platform: DownloadPlatformId
  /** GitHub release `tag_name`, when the release response provided one. */
  releaseTag?: string | null
  /** Selected release-asset name, or null for a release-page fallback. */
  assetName?: string | null
  outcome: DownloadOutcome
}

export type DownloadRedirectEvent = {
  event: typeof DOWNLOAD_REDIRECTED_EVENT
  properties: {
    platform: DownloadPlatformId
    release_version: string
    asset_kind: DownloadAssetKind
    outcome: DownloadOutcome
    $process_person_profile: false
  }
}

const PLATFORM_INSTALLER_KIND: Record<
  DownloadPlatformId,
  Exclude<DownloadAssetKind, "release_page">
> = {
  macos: "dmg",
  windows: "exe",
  linux: "appimage",
}

/** Normalized `tag_name` without a leading `v`, or `unknown`. */
export function normalizeReleaseVersion(tag: string | null | undefined) {
  const value = tag?.trim() ?? ""
  if (!value) return "unknown"

  return value.replace(/^v/i, "").trim() || "unknown"
}

/**
 * Coarse asset kind for a resolved download. A primary asset that is not one of
 * the three canonical installer extensions (for example a macOS `.zip`) reports
 * its platform's installer kind rather than inventing a new value.
 */
export function resolveDownloadAssetKind(
  platform: DownloadPlatformId,
  assetName: string | null | undefined,
): DownloadAssetKind {
  if (!assetName) return "release_page"

  const name = assetName.toLowerCase()
  if (name.endsWith(".dmg")) return "dmg"
  if (name.endsWith(".exe")) return "exe"
  if (name.endsWith(".appimage")) return "appimage"

  return PLATFORM_INSTALLER_KIND[platform]
}

/**
 * Pure event construction so the payload allowlist is unit-testable without a
 * network call. Only these four properties ever leave the server.
 */
export function buildDownloadRedirectEvent(
  input: DownloadRedirectInput,
): DownloadRedirectEvent {
  const assetName = input.outcome === "installer" ? input.assetName : null

  return {
    event: DOWNLOAD_REDIRECTED_EVENT,
    properties: {
      platform: input.platform,
      release_version: normalizeReleaseVersion(input.releaseTag),
      asset_kind: resolveDownloadAssetKind(input.platform, assetName),
      outcome: input.outcome,
      $process_person_profile: false,
    },
  }
}

type ServerEnv = Record<string, string | undefined>

function readServerEnv(): ServerEnv {
  const runtime = globalThis as { process?: { env?: ServerEnv } }

  return runtime.process?.env ?? {}
}

export type AnalyticsConfig = {
  projectKey: string
  host: string
}

export function readAnalyticsConfig(
  env: ServerEnv = readServerEnv(),
): AnalyticsConfig | null {
  const projectKey = env.POSTHOG_PROJECT_KEY?.trim()
  if (!projectKey) return null

  return {
    projectKey,
    host: env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST,
  }
}

export type AnalyticsClient = {
  captureImmediate: (payload: {
    distinctId: string
    event: string
    properties: Record<string, unknown>
    disableGeoip?: boolean
  }) => Promise<unknown>
}

let cachedClient: AnalyticsClient | null = null

function getClient(config: AnalyticsConfig): AnalyticsClient {
  cachedClient ??= new PostHog(config.projectKey, {
    host: config.host,
    requestTimeout: ANALYTICS_REQUEST_TIMEOUT_MS,
    disableGeoip: true,
    flushAt: 1,
    flushInterval: 0,
  })

  return cachedClient
}

export type CaptureDeps = {
  config?: AnalyticsConfig | null
  client?: AnalyticsClient
  /** Random per-event distinct ID; never derived from the request. */
  newDistinctId?: () => string
}

/**
 * Best-effort capture of a resolved download redirect.
 *
 * Returns `false` when analytics is unconfigured or the SDK failed. A PostHog
 * outage must never change the redirect the visitor receives.
 */
export async function captureDownloadRedirect(
  input: DownloadRedirectInput,
  deps: CaptureDeps = {},
): Promise<boolean> {
  try {
    const config =
      deps.config === undefined ? readAnalyticsConfig() : deps.config
    if (!config) return false

    const client = deps.client ?? getClient(config)
    const distinctId = (deps.newDistinctId ?? crypto.randomUUID.bind(crypto))()
    const { event, properties } = buildDownloadRedirectEvent(input)

    await client.captureImmediate({
      distinctId,
      event,
      properties,
      disableGeoip: true,
    })

    return true
  } catch {
    return false
  }
}
