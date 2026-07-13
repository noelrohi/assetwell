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
  const { creativeById, videos, videoModels } = useHiggsfieldApp()

  // Main nav pages already show their location in the sidebar, so the header
  // breadcrumb is reserved for nested pages that need a path back.
  const nestedId = pathname.split("/")[2] ?? ""
  const nestedVideo = videos.find((video) => video.id === nestedId)
  const nestedVideoModel = videoModels.find(
    (model) => model.id === nestedVideo?.model,
  )
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
            label: nestedVideoModel
              ? `${nestedVideoModel.label} Video`
              : "Video",
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

// Ring drawn in a 24-unit viewBox with a 2px stroke; radius 10 leaves a 1px
// margin to the control bounds so the round cap never clips.
const UPDATE_RING_RADIUS = 10
const UPDATE_RING_CIRCUMFERENCE = 2 * Math.PI * UPDATE_RING_RADIUS

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
  const {
    downloadedUpdate,
    downloadProgress,
    installing,
    installDownloadedUpdate,
  } = useUpdater()

  if (!downloadedUpdate) {
    if (!downloadProgress) return null

    const percent = Math.min(
      Math.max(Math.round(downloadProgress.percent), 0),
      100,
    )
    const dashoffset = UPDATE_RING_CIRCUMFERENCE * (1 - percent / 100)
    const label = downloadProgress.version
      ? `Downloading Assetwell ${downloadProgress.version} — ${percent}%`
      : `Downloading update — ${percent}%`

    return (
      <div
        role="status"
        aria-label={label}
        title={label}
        className={cn(
          "no-drag relative flex size-[var(--titlebar-control-size)] items-center justify-center text-ember",
          className,
        )}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="absolute inset-0 size-full -rotate-90"
        >
          <circle
            cx="12"
            cy="12"
            r={UPDATE_RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-20"
          />
          <circle
            cx="12"
            cy="12"
            r={UPDATE_RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={UPDATE_RING_CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <IconDownload className="relative size-3" />
      </div>
    )
  }

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

// The titlebar controls stay window-fixed in both states so collapsing the
// sidebar never drags them along with the inset; only the surface beneath them
// changes (sidebar → background), so we crossfade the sidebar trigger styling in
// place while measuring the whole control group for collapsed header padding.
function PersistentSidebarControls({
  onWidthChange,
}: {
  onWidthChange: (width: number) => void
}) {
  const { state } = useSidebar()
  const controlsRef = React.useRef<HTMLDivElement | null>(null)
  const surfaceClassName =
    state === "collapsed"
      ? titlebarBackgroundControlClassName
      : titlebarSidebarControlClassName

  React.useLayoutEffect(() => {
    const element = controlsRef.current
    if (!element) return

    const updateWidth = () => {
      onWidthChange(Math.ceil(element.getBoundingClientRect().width))
    }

    updateWidth()
    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [onWidthChange])

  return (
    <div
      ref={controlsRef}
      className="no-drag fixed left-[var(--titlebar-control-left)] top-[var(--titlebar-control-center-y)] z-50 flex -translate-y-1/2 items-center gap-[var(--titlebar-control-inner-gap)]"
    >
      <TitlebarSidebarTrigger className={surfaceClassName} />
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
        "flex h-[44px] shrink-0 items-center gap-2 px-5",
        chrome.headerDragClassName,
        isCollapsed && chrome.collapsedHeaderPaddingClassName,
      )}
    >
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
      }
    }

    return {
      mode: "macos-custom-titlebar",
      hasCustomTitlebar: true,
      sidebarTitlebarSpacerClassName:
        "drag h-[44px] flex-row items-center px-3 py-0",
      headerDragClassName: "drag",
      // The fixed titlebar control group reports its rendered width here, so
      // the collapsed breadcrumb stays clear when the update button appears.
      collapsedHeaderPaddingClassName:
        "pl-[calc(var(--titlebar-control-left)+var(--titlebar-controls-width)+var(--titlebar-control-gap))]",
    }
  }, [appInfo?.platform])
}

export function AppShell() {
  const chrome = useWindowChrome()
  const [titlebarControlsWidth, setTitlebarControlsWidth] = React.useState<
    number | null
  >(null)
  const handleTitlebarControlsWidth = React.useCallback((width: number) => {
    setTitlebarControlsWidth(width)
  }, [])

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
            "--titlebar-control-inner-gap": "4px",
            "--titlebar-control-size": "24px",
            "--titlebar-controls-width": titlebarControlsWidth
              ? `${titlebarControlsWidth}px`
              : "var(--titlebar-control-size)",
            "--titlebar-control-left":
              "calc(var(--traffic-light-left) + (var(--traffic-light-size) * 3) + (var(--traffic-light-gap) * 2) + var(--titlebar-control-gap))",
            "--titlebar-control-offset-y": "1px",
            "--titlebar-control-center-y":
              "calc(var(--traffic-light-top) + (var(--traffic-light-size) / 2) + var(--titlebar-control-offset-y))",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          titlebarSpacerClassName={chrome.sidebarTitlebarSpacerClassName}
        />
        <SidebarInset className="min-h-0 overflow-hidden border-l border-border bg-background">
          <InsetHeader chrome={chrome} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </SidebarInset>
        {/* Rendered last so the controls' no-drag region wins over the inset
            header's drag region; otherwise the trigger is unclickable while the
            sidebar is collapsed. */}
        {chrome.hasCustomTitlebar && (
          <PersistentSidebarControls
            onWidthChange={handleTitlebarControlsWidth}
          />
        )}
      </SidebarProvider>
    </NuqsAdapter>
  )
}
