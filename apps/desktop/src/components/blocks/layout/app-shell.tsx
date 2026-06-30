import * as React from "react"
import { Link, Outlet, useRouterState } from "@tanstack/react-router"
import { IconDownload, IconLoader2 } from "@tabler/icons-react"
import { NuqsAdapter } from "nuqs/adapters/tanstack-router"
import type { HostAppInfo } from "@assetwell/desktop-bridge"

import { PAGE_HEADER_ACTIONS_SLOT } from "@/components/blocks/layout/page-header-actions"
import { AppSidebar } from "@/components/blocks/layout/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { useUpdater } from "@/lib/updater"
import { cn } from "@/lib/utils"

function PageBreadcrumb() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { creativeById, videos } = useHiggsfieldApp()

  // Main nav pages already show their location in the sidebar, so the header
  // breadcrumb is reserved for nested pages that need a path back.
  const nestedId = pathname.split("/")[2] ?? ""
  const trail: { label: string; to?: string }[] | null = pathname.startsWith(
    "/creative/",
  )
    ? [
        { label: "Create", to: "/" },
        { label: creativeById(nestedId)?.title ?? "Creative" },
      ]
    : pathname.startsWith("/video/")
      ? [
          { label: "Videos", to: "/videos" },
          {
            label:
              videos.find((video) => video.id === nestedId)?.prompt ?? "Video",
          },
        ]
      : null

  if (!trail) return null

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem className="min-w-0">
                {item.to && !isLast ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">
                    {item.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

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

const titlebarControlClassName =
  "no-drag size-[var(--titlebar-control-size)] rounded-md border border-transparent shadow-none transition-[background-color,color,border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring/50 [&>svg]:size-3.5"

const titlebarBackgroundControlClassName =
  "bg-background/70 text-muted-foreground/75 backdrop-blur hover:bg-accent hover:text-foreground supports-[backdrop-filter]:bg-background/55"

const titlebarSidebarControlClassName =
  "bg-sidebar/70 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground supports-[backdrop-filter]:bg-sidebar/55"

function TitlebarSidebarTrigger({ className }: { className?: string }) {
  return (
    <SidebarTrigger
      className={cn(titlebarControlClassName, className)}
      aria-label="Toggle sidebar"
    />
  )
}

function TitlebarUpdateButton({ className }: { className?: string }) {
  const { downloadedUpdate, installing, installDownloadedUpdate } = useUpdater()

  if (!downloadedUpdate) return null

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn(
        "no-drag size-[var(--titlebar-control-size)] rounded-md border border-ember/30 bg-ember/10 p-0 text-ember shadow-none transition-[background-color,color,border-color] duration-150 ease-out hover:border-ember/50 hover:bg-ember/20 hover:text-ember focus-visible:ring-2 focus-visible:ring-ember/30 [&>svg]:size-3.5",
        className,
      )}
      onClick={() => void installDownloadedUpdate()}
      disabled={installing}
      aria-label="Restart and install update"
      title={`Restart and install Assetwell ${downloadedUpdate.version}`}
    >
      {installing ? <IconLoader2 className="animate-spin" /> : <IconDownload />}
    </Button>
  )
}

function PersistentSidebarControls() {
  const { state } = useSidebar()

  if (state === "collapsed") return null

  return (
    <>
      <TitlebarSidebarTrigger
        className={cn(
          "fixed left-[var(--titlebar-control-left)] top-[var(--titlebar-control-center-y)] z-50 -translate-y-1/2",
          titlebarSidebarControlClassName,
        )}
      />
      <TitlebarUpdateButton
        className={cn(
          "fixed left-[calc(var(--titlebar-control-left)+var(--titlebar-control-step))] top-[var(--titlebar-control-center-y)] z-50 -translate-y-1/2",
          titlebarSidebarControlClassName,
        )}
      />
    </>
  )
}

function CollapsedTitlebarControls() {
  return (
    <div className="no-drag flex shrink-0 items-center gap-1">
      <TitlebarSidebarTrigger className={titlebarBackgroundControlClassName} />
      <TitlebarUpdateButton />
    </div>
  )
}

function InsetHeader({ chrome }: { chrome: WindowChrome }) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <header
      className={cn(
        "flex h-[44px] shrink-0 items-center gap-2 px-5 transition-[padding] duration-150 ease-out",
        chrome.headerDragClassName,
        isCollapsed && chrome.collapsedHeaderPaddingClassName,
      )}
    >
      {isCollapsed && chrome.collapsedTitlebarControls}
      <div className="no-drag flex min-w-0 flex-1 items-center">
        <PageBreadcrumb />
      </div>
      <div className="no-drag flex shrink-0 items-center gap-2">
        <div
          id={PAGE_HEADER_ACTIONS_SLOT}
          className="flex items-center gap-2"
        />
        <JobsIndicator />
      </div>
    </header>
  )
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { cliStatus, signIn } = useHiggsfieldApp()

  if (
    cliStatus?.installed === false ||
    cliStatus?.authStatus === "unauthenticated"
  ) {
    return (
      <div className="grid min-h-full place-items-center px-6 py-16">
        <div className="max-w-md rounded-3xl border border-border bg-card/70 p-8 text-center shadow-2xl shadow-black/10">
          <p className="font-display text-3xl">Connect Higgsfield</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in once, then Assetwell will open directly to Create and use
            your Higgsfield account, models, and credits behind the scenes.
          </p>
          {cliStatus?.installed === false ? (
            <p className="mt-4 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Higgsfield is not available in this build. Reinstall Assetwell or
              contact support.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={cliStatus?.installed === false}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-ember px-5 text-sm font-medium text-ember-foreground ember-glow transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            Sign in to Higgsfield
          </button>
        </div>
      </div>
    )
  }

  return children
}

function getDesktopBridge() {
  return typeof window === "undefined" ? undefined : window.assetwell
}

function useHostAppInfo() {
  const [appInfo, setAppInfo] = React.useState<HostAppInfo | null>(null)

  React.useEffect(() => {
    let mounted = true
    const bridge = getDesktopBridge()

    if (!bridge) {
      setAppInfo(null)
      return () => {
        mounted = false
      }
    }

    void bridge.app
      .getInfo()
      .then((info) => {
        if (mounted) setAppInfo(info)
      })
      .catch(() => {
        if (mounted) setAppInfo(null)
      })

    return () => {
      mounted = false
    }
  }, [])

  return appInfo
}

type WindowChrome = {
  mode: "standard" | "macos-custom-titlebar"
  hasCustomTitlebar: boolean
  sidebarTitlebarSpacerClassName: string | null
  headerDragClassName: string | null
  collapsedHeaderPaddingClassName: string | null
  collapsedTitlebarControls: React.ReactNode | null
}

function useWindowChrome(): WindowChrome {
  const appInfo = useHostAppInfo()

  return React.useMemo(() => {
    if (appInfo?.platform !== "darwin") {
      return {
        mode: "standard",
        hasCustomTitlebar: false,
        sidebarTitlebarSpacerClassName: null,
        headerDragClassName: null,
        collapsedHeaderPaddingClassName: null,
        collapsedTitlebarControls: null,
      }
    }

    return {
      mode: "macos-custom-titlebar",
      hasCustomTitlebar: true,
      sidebarTitlebarSpacerClassName:
        "drag h-[44px] flex-row items-center px-3 py-0",
      headerDragClassName: "drag",
      collapsedHeaderPaddingClassName: "pl-[var(--titlebar-control-left)]",
      collapsedTitlebarControls: <CollapsedTitlebarControls />,
    }
  }, [appInfo?.platform])
}

export function AppShell() {
  const chrome = useWindowChrome()

  return (
    <NuqsAdapter>
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
            "--titlebar-control-step":
              "calc(var(--titlebar-control-size) + 4px)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          titlebarSpacerClassName={chrome.sidebarTitlebarSpacerClassName}
        />
        {chrome.hasCustomTitlebar && <PersistentSidebarControls />}
        <SidebarInset className="min-h-0 overflow-hidden border-l border-border bg-background">
          <InsetHeader chrome={chrome} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <OnboardingGate>
              <Outlet />
            </OnboardingGate>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </NuqsAdapter>
  )
}
