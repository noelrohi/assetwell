import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import {
  clearCachedModelOptions,
  readCachedModelOptions,
  writeCachedModelOptions,
} from "./model-options-cache"

const STORAGE_KEY = "assetwell.model-options.v1"
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")

let localStorage: Storage

beforeEach(() => {
  localStorage = createMemoryStorage()
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  })
})

afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow)
  } else {
    Reflect.deleteProperty(globalThis, "window")
  }
})

describe("model options cache", () => {
  test("roundtrips cached model options", () => {
    const options = [
      {
        id: "image-model",
        label: "Image Model",
        hint: "Fast",
        badges: ["new"],
      },
    ]

    writeCachedModelOptions("image", options)

    expect(readCachedModelOptions("image")).toEqual(options)
  })

  test("ignores expired entries", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        entries: {
          image: {
            savedAt: Date.now() - CACHE_MAX_AGE_MS - 1,
            options: [{ id: "old", label: "Old", hint: null }],
          },
        },
      }),
    )

    expect(readCachedModelOptions("image")).toBeNull()
  })

  test("ignores malformed stored JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not json")

    expect(readCachedModelOptions("image")).toBeNull()
  })

  test("clears the stored cache", () => {
    writeCachedModelOptions("video", [
      { id: "video-model", label: "Video Model", hint: null },
    ])

    clearCachedModelOptions()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  test("normalizes entries and drops options without an id or label", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        entries: {
          image: {
            savedAt: Date.now(),
            options: [
              { id: "", label: "Missing ID", hint: null },
              { id: "missing-label", label: "  ", hint: null },
              { id: "bad-hint", label: "Bad hint", hint: 12 },
              {
                id: "bad-badges",
                label: "Bad badges",
                hint: null,
                badges: ["new", 42],
              },
              {
                id: "  valid-model  ",
                label: "  Valid Model  ",
                hint: null,
                badges: ["new"],
              },
            ],
          },
        },
      }),
    )

    expect(readCachedModelOptions("image")).toEqual([
      {
        id: "valid-model",
        label: "Valid Model",
        hint: null,
        badges: ["new"],
      },
    ])
  })
})

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}
