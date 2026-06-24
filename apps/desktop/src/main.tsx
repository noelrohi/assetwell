import React from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { Toaster } from "@/components/ui/sonner"
import { HiggsfieldProvider } from "@/lib/higgsfield"
import { router } from "@/router"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HiggsfieldProvider>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-center" />
    </HiggsfieldProvider>
  </React.StrictMode>,
)
