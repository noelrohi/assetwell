import { describe, expect, test } from "bun:test"

import { IPC_CHANNELS } from "./channels"

type ChannelTree = string | { readonly [key: string]: ChannelTree }

function collectValues(value: ChannelTree): string[] {
  if (typeof value === "string") return [value]
  return Object.values(value).flatMap(collectValues)
}

describe("IPC channels", () => {
  test("keeps channel names unique and namespaced", () => {
    const channels = collectValues(IPC_CHANNELS)

    expect(new Set(channels).size).toBe(channels.length)
    expect(channels.every((channel) => channel.startsWith("assetwell:"))).toBe(
      true,
    )
  })
})
