import { describe, expect, test } from "bun:test"

import {
  ANALYTICS_EVENT_NAMES,
  DEFAULT_POSTHOG_HOST,
  analytics,
  analyticsMediaKind,
  completedGenerationOutcome,
  createAnalytics,
  sanitizeAnalyticsEvent,
  type AnalyticsAdapterOptions,
  type AnalyticsClient,
} from "./analytics"

interface RecordedCapture {
  event: string
  properties: Record<string, unknown>
}

function makeClient() {
  const captures: RecordedCapture[] = []
  const inits: [string, Record<string, unknown>][] = []
  const optCalls: ("in" | "out")[] = []

  const client: AnalyticsClient = {
    init: (projectKey, options) => {
      inits.push([projectKey, options])
    },
    capture: (event, properties) => {
      captures.push({ event, properties })
    },
    optIn: () => {
      optCalls.push("in")
    },
    optOut: () => {
      optCalls.push("out")
    },
  }

  return { client, captures, inits, optCalls }
}

function makeAnalytics(overrides: Partial<AnalyticsAdapterOptions> = {}) {
  const recorder = makeClient()
  let loads = 0

  const adapter = createAnalytics({
    isProduction: true,
    projectKey: "phc_test",
    host: DEFAULT_POSTHOG_HOST,
    loadClient: async () => {
      loads += 1
      return recorder.client
    },
    ...overrides,
  })

  return { adapter, ...recorder, loadCount: () => loads }
}

const appContext = {
  appVersion: "0.0.16",
  platform: "darwin",
  isPackaged: true,
}

describe("analytics event allowlist", () => {
  test("exposes exactly the v1 events", () => {
    expect(ANALYTICS_EVENT_NAMES.sort()).toEqual([
      "analytics preference changed",
      "app opened",
      "export completed",
      "generation completed",
      "generation requested",
    ])
  })

  test("rebuilds payloads from the allowlist and drops extra properties", () => {
    expect(
      sanitizeAnalyticsEvent("generation completed", {
        media_kind: "video",
        outcome: "failed",
        prompt: "a neon skyline",
        filePath: "/Users/demo/Assetwell/take-1.png",
        workspaceId: "ws_123",
      }),
    ).toEqual({
      name: "generation completed",
      properties: { media_kind: "video", outcome: "failed" },
    })
  })

  test("rejects unknown events", () => {
    expect(sanitizeAnalyticsEvent("prompt submitted", { text: "hi" })).toBe(
      null,
    )
  })

  test("rejects values outside each property's finite domain", () => {
    expect(
      sanitizeAnalyticsEvent("generation requested", { media_kind: "text" }),
    ).toBe(null)
    expect(
      sanitizeAnalyticsEvent("generation completed", {
        media_kind: "image",
        outcome: "timed-out",
      }),
    ).toBe(null)
    expect(
      sanitizeAnalyticsEvent("app opened", {
        app_version: "0.0.16",
        platform: "darwin",
        is_packaged: "yes",
      }),
    ).toBe(null)
    expect(sanitizeAnalyticsEvent("export completed", {})).toBe(null)
  })

  test("bounds string property length", () => {
    const event = sanitizeAnalyticsEvent("app opened", {
      app_version: "v".repeat(500),
      platform: "darwin",
      is_packaged: false,
    })

    expect((event?.properties.app_version as string).length).toBe(64)
  })
})

describe("instrumentation classifiers", () => {
  test("only image and video requests are measurable", () => {
    expect(analyticsMediaKind("image")).toBe("image")
    expect(analyticsMediaKind("video")).toBe("video")
    expect(analyticsMediaKind("text")).toBe(null)
    expect(analyticsMediaKind(undefined)).toBe(null)
  })

  test("classifies terminal generation outcomes", () => {
    expect(completedGenerationOutcome({ succeeded: true })).toBe("success")
    expect(completedGenerationOutcome({ succeeded: false, signal: null })).toBe(
      "failed",
    )
    expect(
      completedGenerationOutcome({ succeeded: false, signal: "SIGTERM" }),
    ).toBe("cancelled")
  })
})

describe("analytics adapter", () => {
  test("stays a no-op outside production builds", async () => {
    const { adapter, captures, loadCount } = makeAnalytics({
      isProduction: false,
    })

    await adapter.start({ ...appContext, enabled: true })
    adapter.trackGenerationRequested("image")

    expect(adapter.isConfigured()).toBe(false)
    expect(loadCount()).toBe(0)
    expect(captures).toEqual([])
  })

  test("stays a no-op when no project key is configured", async () => {
    const { adapter, captures, loadCount } = makeAnalytics({ projectKey: "  " })

    await adapter.start({ ...appContext, enabled: true })
    adapter.trackExportCompleted("video")

    expect(adapter.isConfigured()).toBe(false)
    expect(loadCount()).toBe(0)
    expect(captures).toEqual([])
  })

  test("never loads the SDK while analytics are disabled", async () => {
    const { adapter, captures, loadCount } = makeAnalytics()

    await adapter.start({ ...appContext, enabled: false })
    adapter.trackGenerationRequested("image")
    adapter.trackGenerationCompleted("image", "success")
    adapter.trackExportCompleted("image")

    expect(loadCount()).toBe(0)
    expect(captures).toEqual([])
  })

  test("initializes with autocapture, pageviews, and replay disabled", async () => {
    const { adapter, inits } = makeAnalytics({
      host: "https://eu.i.posthog.com",
    })

    await adapter.start({ ...appContext, enabled: true })

    const [projectKey, options] = inits[0]!
    expect(projectKey).toBe("phc_test")
    expect(options).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      person_profiles: "identified_only",
      persistence: "localStorage",
    })
  })

  test("captures app opened once per renderer process under Strict Mode", async () => {
    const { adapter, captures, inits } = makeAnalytics()

    await Promise.all([
      adapter.start({ ...appContext, enabled: true }),
      adapter.start({ ...appContext, enabled: true }),
    ])
    await adapter.start({ ...appContext, enabled: true })

    expect(inits).toHaveLength(1)
    expect(captures).toEqual([
      {
        event: "app opened",
        properties: {
          app_version: "0.0.16",
          platform: "darwin",
          is_packaged: true,
        },
      },
    ])
  })

  test("captures only the allowlisted core outcomes", async () => {
    const { adapter, captures } = makeAnalytics()

    await adapter.start({ ...appContext, enabled: true })
    captures.length = 0

    adapter.trackGenerationRequested("image")
    adapter.trackGenerationCompleted("image", "success")
    adapter.trackGenerationCompleted("video", "cancelled")
    adapter.trackExportCompleted("video")

    expect(captures).toEqual([
      { event: "generation requested", properties: { media_kind: "image" } },
      {
        event: "generation completed",
        properties: { media_kind: "image", outcome: "success" },
      },
      {
        event: "generation completed",
        properties: { media_kind: "video", outcome: "cancelled" },
      },
      { event: "export completed", properties: { media_kind: "video" } },
    ])
  })

  test("opting out stops every later event and opts the SDK out", async () => {
    const { adapter, captures, optCalls } = makeAnalytics()

    await adapter.start({ ...appContext, enabled: true })
    captures.length = 0

    await adapter.setEnabled(false)
    adapter.trackGenerationRequested("video")
    adapter.trackGenerationCompleted("video", "success")
    adapter.trackExportCompleted("video")

    expect(captures).toEqual([])
    expect(optCalls.at(-1)).toBe("out")
  })

  test("opting in starts the SDK and records the preference change", async () => {
    const { adapter, captures, optCalls, loadCount } = makeAnalytics()

    await adapter.start({ ...appContext, enabled: false })
    expect(loadCount()).toBe(0)

    await adapter.setEnabled(true)

    expect(loadCount()).toBe(1)
    expect(optCalls).toEqual(["in"])
    expect(captures).toEqual([
      {
        event: "app opened",
        properties: {
          app_version: "0.0.16",
          platform: "darwin",
          is_packaged: true,
        },
      },
      {
        event: "analytics preference changed",
        properties: { enabled: true },
      },
    ])
  })

  test("opting back on does not re-emit app opened", async () => {
    const { adapter, captures } = makeAnalytics()

    await adapter.start({ ...appContext, enabled: true })
    await adapter.setEnabled(false)
    captures.length = 0
    await adapter.setEnabled(true)

    expect(captures).toEqual([
      { event: "analytics preference changed", properties: { enabled: true } },
    ])
  })

  test("swallows SDK load failures", async () => {
    const { adapter } = makeAnalytics({
      loadClient: async () => {
        throw new Error("network down")
      },
    })

    await adapter.start({ ...appContext, enabled: true })
    adapter.trackGenerationRequested("image")
    await adapter.setEnabled(false)
    await adapter.setEnabled(true)
  })

  test("swallows capture failures", async () => {
    const throwingClient: AnalyticsClient = {
      init: () => undefined,
      capture: () => {
        throw new Error("transport failed")
      },
      optIn: () => undefined,
      optOut: () => undefined,
    }
    const adapter = createAnalytics({
      isProduction: true,
      projectKey: "phc_test",
      host: DEFAULT_POSTHOG_HOST,
      loadClient: async () => throwingClient,
    })

    await adapter.start({ ...appContext, enabled: true })
    adapter.trackGenerationCompleted("video", "failed")
    adapter.trackExportCompleted("image")
  })

  test("the shipped adapter is unconfigured in tests and dev renderers", () => {
    expect(analytics.isConfigured()).toBe(false)
  })
})
