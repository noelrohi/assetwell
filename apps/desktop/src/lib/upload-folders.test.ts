import { describe, expect, test } from "bun:test"

import type { ReferenceAsset } from "./higgsfield/types"
import {
  applyUploadFolderAssignments,
  countReferencesByFolder,
  referencesInFolder,
} from "./upload-folders"

function reference(id: string, uploadId?: string): ReferenceAsset {
  return {
    id,
    uploadId,
    name: id,
    url: `https://example.com/${id}.png`,
  }
}

const folderIds = new Set(["folder-a", "folder-b"])

describe("Upload folder helpers", () => {
  test("applies assignments by upload id when present", () => {
    const [assigned] = applyUploadFolderAssignments(
      [reference("local-id", "remote-upload")],
      [{ uploadId: "remote-upload", folderId: "folder-a" }],
      folderIds,
    )

    expect(assigned.folderId).toBe("folder-a")
  })

  test("falls back to the reference id for local assignments", () => {
    const [assigned] = applyUploadFolderAssignments(
      [reference("local-id")],
      [{ uploadId: "local-id", folderId: "folder-b" }],
      folderIds,
    )

    expect(assigned.folderId).toBe("folder-b")
  })

  test("drops assignments to unknown folders", () => {
    const [assigned] = applyUploadFolderAssignments(
      [reference("upload-1")],
      [{ uploadId: "upload-1", folderId: "missing-folder" }],
      folderIds,
    )

    expect(assigned.folderId).toBe(null)
  })

  test("filters root and folder views", () => {
    const references = [
      { ...reference("root"), folderId: null },
      { ...reference("missing") },
      { ...reference("foldered"), folderId: "folder-a" },
    ]

    expect(referencesInFolder(references, null).map((item) => item.id)).toEqual([
      "root",
      "missing",
    ])
    expect(
      referencesInFolder(references, "folder-a").map((item) => item.id),
    ).toEqual(["foldered"])
  })

  test("counts references by folder and ignores unfoldered uploads", () => {
    const counts = countReferencesByFolder([
      { ...reference("root"), folderId: null },
      { ...reference("first"), folderId: "folder-a" },
      { ...reference("second"), folderId: "folder-a" },
      { ...reference("third"), folderId: "folder-b" },
    ])

    expect(counts.get("folder-a")).toBe(2)
    expect(counts.get("folder-b")).toBe(1)
    expect(counts.has("root")).toBe(false)
  })
})
