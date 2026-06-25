import {
  IconFolderCog,
  IconLogin2,
  IconLogout,
  IconSparkles,
} from "@tabler/icons-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useHiggsfieldApp } from "@/lib/higgsfield"

function AccountAvatar({ initial }: { initial: string }) {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-ember/80 to-ember/30 font-display text-xs text-ember-foreground">
      {initial}
    </span>
  )
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const { account, settings, signIn, chooseOutputRoot, revealOutputRoot } =
    useHiggsfieldApp()

  const isSignedIn = Boolean(account?.email)
  const name = account?.email?.split("@")[0] ?? "Assetwell"
  const email = account?.email ?? "Not signed in"
  const initial = name.charAt(0).toUpperCase()
  const credits =
    account?.credits == null ? "…" : Number(account.credits.toFixed(1))

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="no-drag data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <AccountAvatar initial={initial} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
              <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                <IconSparkles className="size-3.5 text-ember" />
                {credits}
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <AccountAvatar initial={initial} />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void chooseOutputRoot()}>
              <IconFolderCog />
              Library folder…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void revealOutputRoot()}>
              <IconFolderCog />
              Reveal library folder
            </DropdownMenuItem>
            {settings?.outputRoot ? (
              <DropdownMenuLabel className="truncate px-2 py-1 text-[11px] font-normal text-muted-foreground">
                {settings.outputRoot}
              </DropdownMenuLabel>
            ) : null}
            <DropdownMenuSeparator />
            {isSignedIn ? (
              <DropdownMenuItem variant="destructive">
                <IconLogout />
                Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => void signIn()}>
                <IconLogin2 />
                Sign in to Higgsfield
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
