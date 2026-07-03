import { describe, expect, test } from "bun:test"

import {
  decodeUploadDragIds,
  encodeUploadDragIds,
  isImageFile,
  isInternalUploadDrag,
  isOsFileDrag,
  partitionImageFiles,
  resolveUploadDragIds,
  UPLOAD_DRAG_MIME_TYPE,
} from "./upload-drag"

describe("isImageFile", () => {
  test("accepts files with an image/* MIME type", () => {
    expect(isImageFile({ name: "photo", type: "image/png" })).toBe(true)
    expect(isImageFile({ name: "photo", type: "image/heic" })).toBe(true)
  })

  test("rejects files with a non-image MIME type", () => {
    expect(isImageFile({ name: "notes.png", type: "text/plain" })).toBe(false)
  })

  test("falls back to the extension when no MIME type is known", () => {
    expect(isImageFile({ name: "Logo Final.PNG" })).toBe(true)
    expect(isImageFile({ name: "clip.mp4" })).toBe(false)
    expect(isImageFile({ name: "no-extension" })).toBe(false)
  })
})

describe("partitionImageFiles", () => {
  test("splits images from everything else and counts the rest", () => {
    const files = [
      { name: "a.png", type: "image/png" },
      { name: "notes.txt", type: "text/plain" },
      { name: "b.webp", type: "image/webp" },
      { name: "clip.mp4", type: "video/mp4" },
    ]

    const { images, skippedCount } = partitionImageFiles(files)

    expect(images.map((file) => file.name)).toEqual(["a.png", "b.webp"])
    expect(skippedCount).toBe(2)
  })

  test("returns an empty partition for an empty list", () => {
    expect(partitionImageFiles([])).toEqual({ images: [], skippedCount: 0 })
  })
})

describe("upload drag id payload", () => {
  test("round-trips ids through encode/decode", () => {
    const ids = ["upload-1", "upload-2"]
    expect(decodeUploadDragIds(encodeUploadDragIds(ids))).toEqual(ids)
  })

  test("decode rejects malformed or empty payloads", () => {
    expect(decodeUploadDragIds("not json")).toBe(null)
    expect(decodeUploadDragIds(JSON.stringify([]))).toBe(null)
    expect(decodeUploadDragIds(JSON.stringify({ ids: ["x"] }))).toBe(null)
    expect(decodeUploadDragIds(JSON.stringify([1, 2, 3]))).toBe(null)
  })

  test("decode drops non-string entries but keeps the valid ones", () => {
    expect(decodeUploadDragIds(JSON.stringify(["a", 1, "b"]))).toEqual([
      "a",
      "b",
    ])
  })
})

describe("resolveUploadDragIds", () => {
  test("drags the full selection when the dragged card is selected", () => {
    const selectedIds = new Set(["upload-1", "upload-2", "upload-3"])

    expect(resolveUploadDragIds("upload-2", selectedIds)).toEqual([
      "upload-1",
      "upload-2",
      "upload-3",
    ])
  })

  test("drags only the card when it is outside the current selection", () => {
    const selectedIds = new Set(["upload-1", "upload-2"])

    expect(resolveUploadDragIds("upload-3", selectedIds)).toEqual(["upload-3"])
  })

  test("drags only the card when nothing is selected", () => {
    expect(resolveUploadDragIds("upload-1", new Set())).toEqual(["upload-1"])
  })
})

describe("drag type detection", () => {
  test("recognizes an internal upload-card drag", () => {
    const source = { types: [UPLOAD_DRAG_MIME_TYPE] }
    expect(isInternalUploadDrag(source)).toBe(true)
    expect(isOsFileDrag(source)).toBe(false)
  })

  test("recognizes an OS file drag", () => {
    const source = { types: ["Files"] }
    expect(isOsFileDrag(source)).toBe(true)
    expect(isInternalUploadDrag(source)).toBe(false)
  })

  test("treats a missing DataTransfer as neither kind of drag", () => {
    expect(isInternalUploadDrag(null)).toBe(false)
    expect(isOsFileDrag(null)).toBe(false)
  })

  test("an internal drag is never also treated as an OS file drag", () => {
    const source = { types: ["Files", UPLOAD_DRAG_MIME_TYPE] }
    expect(isInternalUploadDrag(source)).toBe(true)
    expect(isOsFileDrag(source)).toBe(false)
  })
})
