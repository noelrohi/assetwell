import React from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { Toaster } from "@/components/ui/sonner"
import { HiggsfieldProvider } from "@/lib/higgsfield"
import { UpdaterProvider } from "@/lib/updater"
import { WhatsNewDialog } from "@/lib/whats-new"
import { router } from "@/router"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HiggsfieldProvider>
      <UpdaterProvider>
        <RouterProvider router={router} />
        <WhatsNewDialog />
        <Toaster theme="dark" position="bottom-center" />
      </UpdaterProvider>
    </HiggsfieldProvider>
  </React.StrictMode>,
)
