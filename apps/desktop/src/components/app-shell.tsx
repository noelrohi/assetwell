import { Link, Outlet } from "@tanstack/react-router"
import {
  IconChevronDown,
  IconSparkles,
  IconLogout,
  IconFolderCog,
  IconLogin2,
} from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useHiggsfieldApp } from "@/lib/higgsfield"

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="group relative px-1 py-2 text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "!text-foreground" }}
      activeOptions={{ exact: to === "/" }}
    >
      {({ isActive }) => (
        <>
          <span className="font-display text-[0.95rem]">{children}</span>
          <span
            className={cn(
              "absolute -bottom-px left-1 h-px w-[calc(100%-0.5rem)] origin-left scale-x-0 bg-ember transition-transform duration-300 ease-out",
              isActive && "scale-x-100",
            )}
          />
        </>
      )}
    </Link>
  )
}

function JobsIndicator({ runningJobs }: { runningJobs: number }) {
  if (runningJobs <= 0) return null
  return (
    <div className="no-drag flex items-center gap-2 rounded-full border border-border/70 bg-card/60 py-1 pr-3 pl-2.5 text-xs text-muted-foreground">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-2 animate-ping rounded-full bg-ember/70" />
        <span className="ember-glow relative inline-flex size-2 rounded-full bg-ember" />
      </span>
      <span className="font-mono tabular-nums">{runningJobs} generating</span>
    </div>
  )
}

export function AppShell() {
  const { account, runningJobs, signIn } = useHiggsfieldApp()
  const accountName = account?.email?.split("@")[0] ?? "Kreeyts"
  const accountEmail = account?.email ?? "Higgsfield account"
  const credits =
    account?.credits == null ? "..." : Number(account.credits.toFixed(1))

  return (
    <div className="flex min-h-screen flex-col">
      <header className="drag sticky top-0 z-40 flex h-14 items-center gap-6 border-b border-border/60 bg-background/80 pr-5 pl-[88px] backdrop-blur-xl">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-lg leading-none tracking-tight">
            Kreeyts
          </span>
          <span className="hidden font-mono text-[0.6rem] tracking-[0.25em] text-muted-foreground/70 uppercase sm:inline">
            studio
          </span>
        </div>

        <nav className="no-drag flex items-center gap-5">
          <NavLink to="/">Create</NavLink>
          <NavLink to="/videos">Videos</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <JobsIndicator runningJobs={runningJobs} />

          <div className="no-drag flex items-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs">
            <IconSparkles className="size-3.5 text-ember" />
            <span className="font-mono tabular-nums text-foreground">
              {credits}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="no-drag flex items-center gap-1.5 rounded-full pl-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-ember/80 to-ember/30 font-display text-xs text-ember-foreground">
                {accountName.charAt(0).toUpperCase()}
              </span>
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm">{accountName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {accountEmail}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-mono tabular-nums">
                  {credits}
                </span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signIn()}>
                <IconLogin2 className="size-4" />
                Sign in to Higgsfield
              </DropdownMenuItem>
              <DropdownMenuItem>
                <IconFolderCog className="size-4" />
                Library folder…
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive">
                <IconLogout className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
