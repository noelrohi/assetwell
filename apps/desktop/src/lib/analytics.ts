/**
 * Anonymous product analytics for the Assetwell renderer.
 *
 * This is the only module allowed to import PostHog. Everything else calls the
 * narrow typed API below, so no caller can invent an event name, attach a
 * free-form property, or reach the SDK directly.
 *
 * Deliberate limits:
 * - it only runs in production renderer builds that were given a project key;
 * - it never identifies a person and never sends Higgsfield-owned identifiers,
 *   prompts, file paths, model names, or command output;
 * - it swallows every SDK and network failure, so analytics can never change
 *   product behavior.
 */

/** PostHog US cloud ingestion host. Overridable with `VITE_POSTHOG_HOST`. */
export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com"

/** Longest string value we will ever transmit for an allowlisted property. */
const MAX_PROPERTY_LENGTH = 64

export type AnalyticsMediaKind = "image" | "video"
export type AnalyticsGenerationOutcome = "success" | "failed" | "cancelled"

export interface AnalyticsAppContext {
  appVersion: string
  platform: string
  isPackaged: boolean
}

export interface AnalyticsStartRequest extends AnalyticsAppContext {
  enabled: boolean
}

/**
 * The SDK boundary. Keeping it this small is what makes the adapter testable
 * without a DOM and what stops PostHog's wider surface (identify, session
 * replay, feature flags, surveys) from being reachable from product code.
 */
export interface AnalyticsClient {
  init(projectKey: string, options: Record<string, unknown>): void
  capture(event: string, properties: Record<string, unknown>): void
  optIn(): void
  optOut(): void
}

export interface AnalyticsAdapterOptions {
  isProduction: boolean
  projectKey: string
  host: string
  loadClient: () => Promise<AnalyticsClient | null>
}

export interface Analytics {
  /** True when a project key exists in a production renderer build. */
  isConfigured(): boolean
  /**
   * Records host app info plus the persisted preference and, when analytics
   * are on, initializes PostHog and captures `app opened` exactly once per
   * renderer process (React Strict Mode double-invokes effects).
   */
  start(request: AnalyticsStartRequest): Promise<void>
  /** Opts in/out immediately; captures `analytics preference changed` on opt-in. */
  setEnabled(enabled: boolean): Promise<void>
  trackGenerationRequested(mediaKind: AnalyticsMediaKind): void
  trackGenerationCompleted(
    mediaKind: AnalyticsMediaKind,
    outcome: AnalyticsGenerationOutcome,
  ): void
  trackExportCompleted(mediaKind: AnalyticsMediaKind): void
}

type PropertyValue = string | boolean
type PropertyGuard = (value: unknown) => PropertyValue | null

function boundedString(value: unknown): PropertyValue | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_PROPERTY_LENGTH)
}

function boolean(value: unknown): PropertyValue | null {
  return typeof value === "boolean" ? value : null
}

function oneOf(allowed: readonly string[]): PropertyGuard {
  return (value) =>
    allowed.includes(value as string) ? (value as string) : null
}

const mediaKind = oneOf(["image", "video"])
const generationOutcome = oneOf(["success", "failed", "cancelled"])

/**
 * The complete v1 event surface. Every property is listed with a guard, and
 * `sanitizeAnalyticsEvent` rebuilds payloads from this table alone — an event
 * or property that is not written here cannot be transmitted.
 */
const ALLOWED_EVENTS = {
  "app opened": {
    app_version: boundedString,
    platform: boundedString,
    is_packaged: boolean,
  },
  "generation requested": {
    media_kind: mediaKind,
  },
  "generation completed": {
    media_kind: mediaKind,
    outcome: generationOutcome,
  },
  "export completed": {
    media_kind: mediaKind,
  },
  "analytics preference changed": {
    enabled: boolean,
  },
} satisfies Record<string, Record<string, PropertyGuard>>

export type AnalyticsEventName = keyof typeof ALLOWED_EVENTS

export const ANALYTICS_EVENT_NAMES = Object.keys(
  ALLOWED_EVENTS,
) as AnalyticsEventName[]

export interface SanitizedAnalyticsEvent {
  name: AnalyticsEventName
  properties: Record<string, PropertyValue>
}

/**
 * Rebuilds an event payload from the allowlist. Returns null when the event is
 * unknown or when any allowlisted property is missing or has a value outside
 * its guard, so a malformed call sends nothing rather than something partial.
 */
export function sanitizeAnalyticsEvent(
  name: string,
  properties: Record<string, unknown>,
): SanitizedAnalyticsEvent | null {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_EVENTS, name)) return null

  const guards = ALLOWED_EVENTS[name as AnalyticsEventName] as Record<
    string,
    PropertyGuard
  >
  const sanitized: Record<string, PropertyValue> = {}

  for (const [key, guard] of Object.entries(guards)) {
    const value = guard(properties[key])
    if (value === null) return null
    sanitized[key] = value
  }

  return { name: name as AnalyticsEventName, properties: sanitized }
}

/**
 * Narrows a media kind coming from the Higgsfield domain (which also knows
 * `text`) to the two values analytics may transmit. Returns null when there is
 * nothing measurable, so callers can skip the event entirely.
 */
export function analyticsMediaKind(
  value: string | null | undefined,
): AnalyticsMediaKind | null {
  return value === "image" || value === "video" ? value : null
}

/**
 * Classifies a finished generation run. A stopped run is a cancellation, not a
 * failure — the difference is the whole point of the funnel.
 */
export function completedGenerationOutcome(run: {
  succeeded: boolean
  signal?: string | null
}): AnalyticsGenerationOutcome {
  if (run.succeeded) return "success"
  return run.signal ? "cancelled" : "failed"
}

function postHogInitOptions(host: string) {
  return {
    api_host: host,
    // Nothing implicit: no DOM scraping, no navigation events, no replay.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_external_dependencies: true,
    advanced_disable_feature_flags: true,
    advanced_disable_feature_flags_on_first_load: true,
    // Anonymous events only: person profiles are created for identified users,
    // and this adapter never calls identify.
    person_profiles: "identified_only",
    // The random distinct ID lives in renderer local storage so returning
    // installations look like returning installations. It is never derived from
    // hardware, account, or file system state.
    persistence: "localStorage",
    disable_persistence: false,
  }
}

export function createAnalytics(options: AnalyticsAdapterOptions): Analytics {
  let enabled = false
  let context: AnalyticsAppContext | null = null
  let client: AnalyticsClient | null = null
  let startPromise: Promise<void> | null = null
  let appOpenedCaptured = false

  function isConfigured() {
    return options.isProduction && options.projectKey.trim().length > 0
  }

  async function ensureClient() {
    if (client || !isConfigured()) return client
    try {
      const loaded = await options.loadClient()
      if (!loaded) return null
      loaded.init(options.projectKey, postHogInitOptions(options.host))
      client = loaded
    } catch {
      client = null
    }
    return client
  }

  function capture(
    name: AnalyticsEventName,
    properties: Record<string, unknown>,
  ) {
    if (!enabled || !client) return
    const event = sanitizeAnalyticsEvent(name, properties)
    if (!event) return
    try {
      client.capture(event.name, event.properties)
    } catch {
      // Analytics must never surface to the product.
    }
  }

  async function runStart() {
    const active = await ensureClient()
    if (!active) return

    try {
      active.optIn()
    } catch {
      // Ignored: opt-in state is best-effort.
    }

    if (appOpenedCaptured || !context) return
    appOpenedCaptured = true
    capture("app opened", {
      app_version: context.appVersion,
      platform: context.platform,
      is_packaged: context.isPackaged,
    })
  }

  function ensureStarted() {
    if (!startPromise) startPromise = runStart()
    return startPromise
  }

  return {
    isConfigured,

    async start(request) {
      context = {
        appVersion: request.appVersion,
        platform: request.platform,
        isPackaged: request.isPackaged,
      }
      enabled = request.enabled
      if (!enabled) return
      await ensureStarted()
    },

    async setEnabled(next) {
      enabled = next

      if (!next) {
        try {
          client?.optOut()
        } catch {
          // Ignored: the local `enabled` flag already stops every capture.
        }
        return
      }

      await ensureStarted()
      capture("analytics preference changed", { enabled: true })
    },

    trackGenerationRequested(kind) {
      capture("generation requested", { media_kind: kind })
    },

    trackGenerationCompleted(kind, outcome) {
      capture("generation completed", { media_kind: kind, outcome })
    },

    trackExportCompleted(kind) {
      capture("export completed", { media_kind: kind })
    },
  }
}

interface RendererEnv {
  PROD?: boolean
  VITE_POSTHOG_KEY?: string
  VITE_POSTHOG_HOST?: string
}

function rendererEnv(): RendererEnv {
  // Vite replaces these exact `import.meta.env.*` tokens at build time.
  // Reading them through an aliased object skips that replacement and leaves
  // packaged builds permanently unconfigured.
  return {
    PROD: import.meta.env.PROD,
    VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY,
    VITE_POSTHOG_HOST: import.meta.env.VITE_POSTHOG_HOST,
  }
}

async function loadPostHogClient(): Promise<AnalyticsClient | null> {
  // The `no-external` build bundles everything it needs; PostHog never fetches
  // remote code into the renderer.
  const { default: posthog } =
    await import("posthog-js/dist/module.no-external")

  return {
    init: (projectKey, initOptions) => {
      posthog.init(
        projectKey,
        initOptions as Parameters<typeof posthog.init>[1],
      )
    },
    capture: (event, properties) => {
      posthog.capture(event, properties)
    },
    optIn: () => {
      posthog.opt_in_capturing()
    },
    optOut: () => {
      posthog.opt_out_capturing()
    },
  }
}

const env = rendererEnv()

export const analytics = createAnalytics({
  isProduction: env.PROD === true,
  projectKey: env.VITE_POSTHOG_KEY?.trim() ?? "",
  host: env.VITE_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST,
  loadClient: loadPostHogClient,
})
