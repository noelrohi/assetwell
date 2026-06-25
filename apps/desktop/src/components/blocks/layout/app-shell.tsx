import type { CSSProperties } from "react"
import { Outlet } from "@tanstack/react-router"

import { AppSidebar } from "@/components/blocks/layout/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { cn } from "@/lib/utils"

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

function PersistentSidebarTrigger() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarTrigger
      className={cn(
        "no-drag fixed z-50 size-[var(--titlebar-control-size)] -translate-y-1/2 rounded-md border border-transparent shadow-none transition-[background-color,color,border-color] duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:size-3.5",
        "left-[var(--titlebar-control-left)] top-[var(--titlebar-control-center-y)]",
        isCollapsed
          ? "bg-background/70 text-muted-foreground/75 backdrop-blur supports-[backdrop-filter]:bg-background/55"
          : "bg-sidebar/70 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/55",
      )}
      aria-label="Toggle sidebar"
    />
  )
}

function InsetHeader() {
  const { state } = useSidebar()

  return (
    <header
      className={cn(
        "drag flex h-[44px] shrink-0 items-center gap-2 border-b border-border px-3 transition-[padding] duration-150 ease-out",
        state === "collapsed" &&
          "pl-[var(--titlebar-page-header-collapsed-left)]",
      )}
    >
      <div className="no-drag ml-auto">
        <JobsIndicator />
      </div>
    </header>
  )
}

export function AppShell() {
  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "16.5rem",
          "--traffic-light-left": "16px",
          "--traffic-light-top": "15px",
          "--traffic-light-size": "12px",
          "--traffic-light-gap": "10px",
          "--titlebar-control-gap": "12px",
          "--titlebar-control-size": "24px",
          "--titlebar-control-left":
            "calc(var(--traffic-light-left) + (var(--traffic-light-size) * 3) + (var(--traffic-light-gap) * 2) + var(--titlebar-control-gap))",
          "--titlebar-control-offset-y": "1px",
          "--titlebar-control-center-y":
            "calc(var(--traffic-light-top) + (var(--traffic-light-size) / 2) + var(--titlebar-control-offset-y))",
          "--titlebar-content-left":
            "calc(var(--titlebar-control-left) + var(--titlebar-control-size) + 4px)",
          "--titlebar-page-header-collapsed-left":
            "calc(var(--titlebar-content-left) + var(--titlebar-control-size) + 8px)",
        } as CSSProperties
      }
    >
      <AppSidebar />
      <PersistentSidebarTrigger />
      <SidebarInset className="min-h-0 overflow-hidden border-l border-border bg-background">
        <InsetHeader />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
