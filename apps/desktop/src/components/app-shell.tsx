import { Outlet, useRouterState } from "@tanstack/react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { useHiggsfieldApp } from "@/lib/higgsfield"

function JobsIndicator() {
  const { runningJobs } = useHiggsfieldApp()
  if (runningJobs <= 0) return null
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 py-1 pr-3 pl-2.5 text-xs text-muted-foreground">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-ember/70" />
        <span className="ember-glow relative inline-flex size-2 rounded-full bg-ember" />
      </span>
      <span className="font-mono tabular-nums">{runningJobs} generating</span>
    </div>
  )
}

function InsetHeader() {
  const { state } = useSidebar()
  const title = useRouterState({
    select: (s) =>
      s.location.pathname.startsWith("/videos") ? "Videos" : "Create",
  })

  return (
    <header
      className={cn(
        "drag flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-3 transition-[padding] duration-200 ease-linear",
        // when the rail is hidden, clear the macOS traffic lights on the left
        state === "collapsed" && "pl-[5.5rem]",
      )}
    >
      <SidebarTrigger className="no-drag -ml-1" />
      <Separator orientation="vertical" className="no-drag mr-1 !h-4" />
      <span className="font-display text-sm">{title}</span>
      <div className="no-drag ml-auto">
        <JobsIndicator />
      </div>
    </header>
  )
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden border border-border/60">
        <InsetHeader />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
