import React from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { AppAuthGate } from "@/components/blocks/layout/app-auth-gate"
import { Toaster } from "@/components/ui/sonner"
import { HiggsfieldProvider } from "@/lib/higgsfield"
import { UpdaterProvider } from "@/lib/updater"
import { WhatsNewDialog } from "@/lib/whats-new"
import { router } from "@/router"
import "./index.css"

function preventDefaultDragNavigation(event: DragEvent) {
  event.preventDefault()
}

// Keep this listener in the bubble phase: React's root-level drop handlers
// receive Uploads page drops first, then this document guard catches margins
// and other screens so Chromium never navigates to a dropped file:// URL.
document.addEventListener("dragover", preventDefaultDragNavigation)
document.addEventListener("drop", preventDefaultDragNavigation)

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HiggsfieldProvider>
      <UpdaterProvider>
        <AppAuthGate>
          <RouterProvider router={router} />
          <WhatsNewDialog />
        </AppAuthGate>
        <Toaster theme="dark" position="bottom-center" />
      </UpdaterProvider>
    </HiggsfieldProvider>
  </React.StrictMode>,
)
