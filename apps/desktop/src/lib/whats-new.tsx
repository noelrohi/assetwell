import * as React from "react"
import type { AssetwellReleaseNotes } from "@assetwell/desktop-bridge"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const LAST_SEEN_VERSION_KEY = "assetwell:whatsNew:lastSeenVersion"

export type WhatsNewBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }

export function parseReleaseNotes(markdown: string): WhatsNewBlock[] {
  const blocks: WhatsNewBlock[] = []
  const paragraphLines: string[] = []
  const listItems: string[] = []

  const flushParagraph = () => {
    if (!paragraphLines.length) return
    blocks.push({ kind: "paragraph", text: paragraphLines.join(" ") })
    paragraphLines.length = 0
  }

  const flushList = () => {
    if (!listItems.length) return
    blocks.push({ kind: "list", items: [...listItems] })
    listItems.length = 0
  }

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const text = normalizeInlineMarkdown(headingMatch[2])
      if (text) blocks.push({ kind: "heading", text })
      continue
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph()
      const item = normalizeInlineMarkdown(line.slice(2))
      if (item) listItems.push(item)
      continue
    }

    flushList()
    const text = normalizeInlineMarkdown(line)
    if (text) paragraphLines.push(text)
  }

  flushParagraph()
  flushList()

  return blocks
}

function normalizeInlineMarkdown(text: string) {
  return text
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .trim()
}

export function WhatsNewDialog() {
  const [releaseNotes, setReleaseNotes] =
    React.useState<AssetwellReleaseNotes | null>(null)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const bridge = getDesktopBridge()
    const appBridge = bridge?.app
    if (!appBridge) return
    const appApi = appBridge

    let active = true

    async function loadReleaseNotes() {
      try {
        const info = await appApi.getInfo()
        if (!active) return

        if (readLastSeenVersion() === info.version) return

        const notes = await appApi.getCurrentReleaseNotes()
        if (!active) return

        if (!notes) {
          writeLastSeenVersion(info.version)
          return
        }

        setReleaseNotes(notes)
        setOpen(true)
      } catch {
        // Keep this user-facing surface silent; update news are optional.
      }
    }

    void loadReleaseNotes()

    return () => {
      active = false
    }
  }, [])

  const blocks = React.useMemo(
    () => parseReleaseNotes(releaseNotes?.body ?? ""),
    [releaseNotes],
  )

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen && releaseNotes) {
        writeLastSeenVersion(releaseNotes.version)
      }
    },
    [releaseNotes],
  )

  if (!releaseNotes) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            What&apos;s new in Assetwell {releaseNotes.version}
          </DialogTitle>
          {releaseNotes.title ? (
            <DialogDescription>{releaseNotes.title}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {blocks.map((block, index) => {
            if (block.kind === "heading") {
              return (
                <h3
                  key={`${block.kind}-${index}`}
                  className="text-sm font-semibold text-foreground"
                >
                  {block.text}
                </h3>
              )
            }

            if (block.kind === "list") {
              return (
                <ul
                  key={`${block.kind}-${index}`}
                  className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground"
                >
                  {block.items.map((item, itemIndex) => (
                    <li key={`${item}-${itemIndex}`}>{item}</li>
                  ))}
                </ul>
              )
            }

            return (
              <p
                key={`${block.kind}-${index}`}
                className="text-sm leading-6 text-muted-foreground"
              >
                {block.text}
              </p>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => handleOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function readLastSeenVersion() {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(LAST_SEEN_VERSION_KEY)
  } catch {
    return null
  }
}

function writeLastSeenVersion(version: string) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(LAST_SEEN_VERSION_KEY, version)
  } catch {
    // Persistence is best-effort only.
  }
}

function getDesktopBridge() {
  return typeof window === "undefined" ? undefined : window.assetwell
}
