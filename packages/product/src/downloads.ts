export type DownloadPlatformAvailability = "available" | "coming-soon"
export type DownloadReleaseAsset = {
  name: string
  browser_download_url: string
}

type DownloadAssetMatcher = (normalizedAssetName: string) => boolean

export type DownloadPlatformSpec = {
  id: string
  name: string
  note: string
  availability: DownloadPlatformAvailability
  unavailableReason?: string
  unavailableLabel?: string
  assetMatchers: readonly DownloadAssetMatcher[]
}

export const DOWNLOAD_COMING_SOON_LABEL = "Coming soon"
export const DEFAULT_DOWNLOAD_PLATFORM = "macos"

const hasExtension = (extension: string): DownloadAssetMatcher => {
  return (name) => name.endsWith(extension)
}

const hasTokenAndExtension = (
  token: string,
  extension: string,
): DownloadAssetMatcher => {
  return (name) => name.includes(token) && name.endsWith(extension)
}

export const downloadPlatforms = [
  {
    id: "macos",
    name: "macOS",
    note: "macOS 11 and later",
    availability: "available",
    assetMatchers: [
      hasExtension(".dmg"),
      hasTokenAndExtension("mac", ".zip"),
      hasTokenAndExtension("darwin", ".zip"),
    ],
  },
  {
    id: "windows",
    name: "Windows",
    note: "Windows 10 and later",
    availability: "available",
    assetMatchers: [hasExtension(".exe")],
  },
  {
    id: "linux",
    name: "Linux",
    note: "AppImage for x64 Linux",
    availability: "available",
    assetMatchers: [hasExtension(".appimage")],
  },
] as const satisfies readonly DownloadPlatformSpec[]

type DownloadPlatformEntry = (typeof downloadPlatforms)[number]
export type DownloadPlatformId = DownloadPlatformEntry["id"]
export type AvailableDownloadPlatformId = Extract<
  DownloadPlatformEntry,
  { availability: "available" }
>["id"]
export type DownloadPlatform = DownloadPlatformSpec & {
  id: DownloadPlatformId
}

const downloadPlatformsById = Object.fromEntries(
  downloadPlatforms.map((platform) => [platform.id, platform]),
) as unknown as Record<DownloadPlatformId, DownloadPlatform>

export function getDownloadPlatform(platform: DownloadPlatformId) {
  return downloadPlatformsById[platform]
}

export function isDownloadPlatformAvailable(
  platform: DownloadPlatformId,
): platform is AvailableDownloadPlatformId {
  return getDownloadPlatform(platform).availability === "available"
}

export function normalizeDownloadPlatform(
  platform: string | null | undefined,
): DownloadPlatformId | null {
  if (!platform) return null

  const value = platform.trim().toLowerCase()

  if (["mac", "macos", "darwin", "osx"].includes(value)) return "macos"
  if (["win", "windows"].includes(value)) return "windows"
  if (["linux", "appimage"].includes(value)) return "linux"

  return null
}

export function detectDownloadPlatformFromUserAgent(
  userAgent: string | null | undefined,
): DownloadPlatformId | null {
  const value = userAgent?.toLowerCase() ?? ""

  if (value.includes("windows")) return "windows"
  if (value.includes("linux") && !value.includes("android")) return "linux"
  if (value.includes("mac")) return "macos"

  return null
}

export function resolveDownloadPlatform(
  platform: string | null | undefined,
  userAgent: string | null | undefined,
): DownloadPlatformId {
  return (
    normalizeDownloadPlatform(platform) ??
    detectDownloadPlatformFromUserAgent(userAgent) ??
    DEFAULT_DOWNLOAD_PLATFORM
  )
}

export function isDownloadableReleaseAssetName(name: string) {
  const normalizedName = name.toLowerCase()

  return (
    !normalizedName.endsWith(".blockmap") &&
    !normalizedName.endsWith(".yml") &&
    !normalizedName.endsWith(".yaml")
  )
}

export function pickDownloadReleaseAsset(
  assets: readonly DownloadReleaseAsset[],
  platform: DownloadPlatformId,
): DownloadReleaseAsset | null {
  const platformSpec = getDownloadPlatform(platform)
  if (platformSpec.availability !== "available") return null

  const candidates = assets.filter((asset) =>
    isDownloadableReleaseAssetName(asset.name),
  )

  for (const matcher of platformSpec.assetMatchers) {
    const asset = candidates.find((candidate) =>
      matcher(candidate.name.toLowerCase()),
    )

    if (asset) return asset
  }

  return null
}
