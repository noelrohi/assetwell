import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** Id of the slot rendered in the app header (see InsetHeader). */
export const PAGE_HEADER_ACTIONS_SLOT = "page-header-actions"

/**
 * Renders its children into the persistent app header's action slot, letting a
 * page place contextual actions in the otherwise-empty title bar.
 */
export function PageHeaderActions({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setHost(document.getElementById(PAGE_HEADER_ACTIONS_SLOT))
  }, [])

  if (!host) return null
  return createPortal(children, host)
}
