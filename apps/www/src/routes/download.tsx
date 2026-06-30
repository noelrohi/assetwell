import {
  DOWNLOAD_COMING_SOON_LABEL,
  detectDownloadPlatformFromUserAgent,
  downloadPlatforms,
  type DownloadPlatform,
  type DownloadPlatformId,
} from "@assetwell/product/downloads"
import { Button } from "@assetwell/ui/button"
import { createFileRoute } from "@tanstack/react-router"
import { Download } from "lucide-react"
import * as React from "react"

import {
  SiteBackground,
  SiteFooter,
  SiteHeader,
} from "../components/site-chrome"
import { DOWNLOAD_START_URL } from "../lib/constants"

export const Route = createFileRoute("/download")({ component: DownloadPage })

type PlatformCard = DownloadPlatform & {
  glyph: React.ReactNode
}

const platformGlyphs: Record<DownloadPlatformId, React.ReactNode> = {
  macos: <AppleGlyph />,
  windows: <WindowsGlyph />,
  linux: <LinuxGlyph />,
}

const platforms: Array<PlatformCard> = downloadPlatforms.map((platform) => ({
  ...platform,
  glyph: platformGlyphs[platform.id],
}))

const availablePlatformNames = formatPlatformList(
  downloadPlatforms
    .filter((platform) => platform.availability === "available")
    .map((platform) => platform.name),
)

function DownloadPage() {
  const recommended = useDetectedPlatform()

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <SiteBackground />
      <SiteHeader />

      <main className="flex flex-1 items-center px-6 pt-32 pb-20 sm:pt-40">
        <div className="mx-auto w-full max-w-3xl">
          <div className="text-center">
            <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Now in early access
            </p>
            <h1 className="text-balance text-4xl font-light tracking-tight sm:text-5xl">
              Download Assetwell
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground">
              Pick your platform and make your first full set of ad creatives in
              a few minutes.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {platforms.map((platform) => (
              <PlatformTile
                key={platform.id}
                platform={platform}
                recommended={recommended === platform.id}
              />
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Available for {availablePlatformNames} from the latest release.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

function PlatformTile({
  platform,
  recommended,
}: {
  platform: PlatformCard
  recommended: boolean
}) {
  const available = platform.availability === "available"

  return (
    <div
      className={cn(
        "relative flex flex-col items-center rounded-2xl border bg-card/50 p-6 text-center shadow-sm transition-colors",
        available ? "hover:bg-card/80" : "opacity-70",
        recommended && available && "border-primary/50",
      )}
    >
      {recommended && available && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[0.65rem] font-medium text-primary-foreground">
          Your device
        </span>
      )}

      <div className="flex size-12 items-center justify-center text-foreground/90">
        {platform.glyph}
      </div>
      <h2 className="mt-4 text-base font-medium">{platform.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{platform.note}</p>

      <div className="mt-5 w-full">
        {available ? (
          <Button asChild className="w-full rounded-full">
            <a href={`${DOWNLOAD_START_URL}?platform=${platform.id}`}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        ) : (
          <span className="flex h-9 w-full items-center justify-center rounded-full border border-dashed border-border text-xs font-medium text-muted-foreground">
            {platform.unavailableLabel ?? DOWNLOAD_COMING_SOON_LABEL}
          </span>
        )}
      </div>
    </div>
  )
}

function useDetectedPlatform(): DownloadPlatformId | null {
  const [platform, setPlatform] = React.useState<DownloadPlatformId | null>(
    null,
  )

  React.useEffect(() => {
    setPlatform(detectDownloadPlatformFromUserAgent(navigator.userAgent))
  }, [])

  return platform
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ")
}

function formatPlatformList(names: readonly string[]): string {
  if (names.length <= 1) return names.join("")
  if (names.length === 2) return names.join(" and ")

  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-9" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 3.02-.86.99-2.27 1.76-3.4 1.67-.14-1.12.43-2.3 1.12-3.06.78-.86 2.16-1.5 3.4-1.63zM20.7 17.2c-.62 1.43-.92 2.07-1.72 3.34-1.12 1.77-2.7 3.97-4.66 3.99-1.74.02-2.19-1.13-4.55-1.12-2.36.01-2.85 1.14-4.59 1.12-1.96-.02-3.45-2.01-4.57-3.78C-1.27 16.86-1.4 11.3 1.6 8.13c1.06-1.13 2.45-1.8 3.92-1.8 1.74 0 2.83 1.14 4.27 1.14 1.39 0 2.24-1.14 4.25-1.14 1.32 0 2.72.72 3.72 1.96-3.27 1.79-2.74 6.46.94 8.91z" />
    </svg>
  )
}

function WindowsGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden>
      <path d="M3 5.6 10.4 4.6v6.9H3zM11.5 4.45 21 3.2v8.3h-9.5zM3 12.5h7.4v6.9L3 18.4zM11.5 12.5H21v8.3l-9.5-1.25z" />
    </svg>
  )
}

function LinuxGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="currentColor" aria-hidden>
      <path d="M12 2c-2.2 0-3.6 1.9-3.6 4.4 0 1.6.3 2.4-.6 3.8-1 1.5-2.6 3-3.3 5.1-.5 1.5-.2 2.4.3 2.7.2-1 .7-2 1.2-2.7.1 1.6.8 3.6 2.4 4.7 1 .7 2.3 1 3.6 1s2.6-.3 3.6-1c1.6-1.1 2.3-3.1 2.4-4.7.5.7 1 1.7 1.2 2.7.5-.3.8-1.2.3-2.7-.7-2.1-2.3-3.6-3.3-5.1-.9-1.4-.6-2.2-.6-3.8C15.6 3.9 14.2 2 12 2zm-1.5 4.2c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9zm3 0c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9zM12 9c.9 0 1.9.5 2.4 1-.5.5-1.5.8-2.4.8s-1.9-.3-2.4-.8c.5-.5 1.5-1 2.4-1z" />
    </svg>
  )
}
