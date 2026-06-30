import path from "node:path"

export const LOCAL_ASSET_PROTOCOL = "assetwell-local"
export const LOCAL_ASSET_HOST = "asset"

const REFERENCE_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
])

const LOCAL_ASSET_PREVIEW_EXTENSIONS = new Set([
  ...REFERENCE_IMAGE_EXTENSIONS,
  ".mov",
  ".mp4",
  ".webm",
])

export function isReferenceImage(filePath: string) {
  return REFERENCE_IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function isPreviewableLocalAsset(filePath: string) {
  return LOCAL_ASSET_PREVIEW_EXTENSIONS.has(
    path.extname(filePath).toLowerCase(),
  )
}

export function localAssetUrl(filePath: string) {
  return `${LOCAL_ASSET_PROTOCOL}://${LOCAL_ASSET_HOST}/${encodeURIComponent(
    path.resolve(filePath),
  )}`
}

export function resolveLocalAssetUrl(assetUrl: string) {
  try {
    const url = new URL(assetUrl)
    if (url.protocol !== `${LOCAL_ASSET_PROTOCOL}:`) return null
    if (url.hostname !== LOCAL_ASSET_HOST) return null

    const filePath = decodeURIComponent(url.pathname.slice(1))
    if (!filePath || !path.isAbsolute(filePath)) return null

    return filePath
  } catch {
    return null
  }
}

export function localAssetContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".avif":
      return "image/avif"
    case ".gif":
      return "image/gif"
    case ".jpeg":
    case ".jpg":
      return "image/jpeg"
    case ".mov":
      return "video/quicktime"
    case ".mp4":
      return "video/mp4"
    case ".png":
      return "image/png"
    case ".webm":
      return "video/webm"
    case ".webp":
      return "image/webp"
    default:
      return "application/octet-stream"
  }
}
