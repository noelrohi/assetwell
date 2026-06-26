import { describe, expect, test } from "bun:test"

import { parseReleaseNotes } from "./whats-new"

describe("release notes parsing", () => {
  test("parses headings, grouped bullets, and paragraphs in order", () => {
    expect(
      parseReleaseNotes(`## Highlights
- Faster exports
- Cleaner previews

Everything feels a little smoother.`),
    ).toEqual([
      { kind: "heading", text: "Highlights" },
      { kind: "list", items: ["Faster exports", "Cleaner previews"] },
      { kind: "paragraph", text: "Everything feels a little smoother." },
    ])
  })

  test("treats star bullets like dash bullets", () => {
    expect(parseReleaseNotes("* First\n* Second")).toEqual([
      { kind: "list", items: ["First", "Second"] },
    ])
  })

  test("reduces markdown links to their labels", () => {
    expect(
      parseReleaseNotes("Try [Assetwell](https://example.com) today."),
    ).toEqual([{ kind: "paragraph", text: "Try Assetwell today." }])
  })

  test("strips bold emphasis markers", () => {
    expect(parseReleaseNotes("**Brand Memory** is easier to scan.")).toEqual([
      { kind: "paragraph", text: "Brand Memory is easier to scan." },
    ])
  })

  test("joins adjacent plain text lines into one paragraph", () => {
    expect(
      parseReleaseNotes("The first line\ncontinues on the second."),
    ).toEqual([
      { kind: "paragraph", text: "The first line continues on the second." },
    ])
  })

  test("returns no blocks for an empty string", () => {
    expect(parseReleaseNotes("")).toEqual([])
  })

  test("returns no blocks for blank-only input", () => {
    expect(parseReleaseNotes("\n  \n\t\n")).toEqual([])
  })
})
