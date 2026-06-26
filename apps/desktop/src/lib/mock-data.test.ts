import { describe, expect, test } from "bun:test"

import {
  account,
  creativeById,
  creatives,
  imageModels,
  imagePromptLibrary,
  referenceLibrary,
  runningJobs,
  videoModels,
  videoPromptLibrary,
  videos,
} from "./mock-data"
import { imagePlacements, videoPlacements } from "./placements"

function expectUnique(ids: string[]) {
  expect(new Set(ids).size).toBe(ids.length)
}

describe("mock data", () => {
  test("keeps catalogue and prompt seed IDs unique", () => {
    expectUnique(imageModels.map((model) => model.id))
    expectUnique(videoModels.map((model) => model.id))
    expectUnique(imagePromptLibrary.map((prompt) => prompt.id))
    expectUnique(videoPromptLibrary.map((prompt) => prompt.id))
    expectUnique(referenceLibrary.map((reference) => reference.id))

    expect(imageModels.length).toBeGreaterThan(0)
    expect(videoModels.length).toBeGreaterThan(0)
    expect(imagePromptLibrary.every((prompt) => prompt.body.trim())).toBe(true)
    expect(videoPromptLibrary.every((prompt) => prompt.body.trim())).toBe(true)
  })

  test("keeps creative fixtures internally consistent", () => {
    expectUnique(creatives.map((creative) => creative.id))

    for (const creative of creatives) {
      expect(creative.prompt.trim()).not.toBe("")
      expect(creative.takes.length).toBeGreaterThan(0)
      expectUnique(creative.takes.map((take) => take.id))

      const selectedTake = creative.takes.find(
        (take) => take.id === creative.selectedTakeId,
      )
      if (!selectedTake)
        throw new Error(`Missing selected take for ${creative.id}`)
      expect(selectedTake.status).toBe("ready")
      expect(creative.heroUrl).toBe(selectedTake.url)

      for (const take of creative.takes) {
        if (take.status === "ready") expect(take.url).toMatch(/^https:\/\//)
      }

      for (const placement of creative.placements) {
        expect(imagePlacements).toContain(placement.size)
        if (placement.status === "ready") {
          expect(placement.url).toMatch(/^https:\/\//)
        } else {
          expect(placement.url).toBeUndefined()
        }
      }
    }
  })

  test("keeps video fixtures on supported sizes", () => {
    expectUnique(videos.map((video) => video.id))

    for (const video of videos) {
      expect(videoPlacements).toContain(video.size)
      expect(video.prompt.trim()).not.toBe("")
      expect(video.posterUrl).toMatch(/^https:\/\//)
      if (video.sourceCreativeId) {
        expect(creativeById(video.sourceCreativeId)).toBeDefined()
      }
    }
  })

  test("keeps mock account and running job counters usable", () => {
    expect(account.email).toContain("@")
    expect(account.credits).toBeGreaterThanOrEqual(0)
    expect(runningJobs).toBe(
      creatives.filter((creative) => creative.status === "pending").length +
        videos.filter((video) => video.status === "pending").length,
    )
  })
})
