import React from "react"
import { createRoot } from "react-dom/client"
import { IconSparkles } from "@tabler/icons-react"
import { Button } from "@kreeyts/ui/button"
import "./index.css"

function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
          Electron + Vite + tsdown + shadcn/ui
        </div>
        <div className="space-y-4">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Kreeyts is ready.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Monorepo layout copied from Dilag, with a desktop app, shared UI package,
            desktop bridge package, Tailwind v4, and shadcn-compatible aliases.
          </p>
        </div>
        <Button size="lg" className="gap-2">
          <IconSparkles className="size-5" />
          Start building
        </Button>
      </section>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
