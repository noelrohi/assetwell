import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { IconMovie, IconWand } from "@tabler/icons-react"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const NAV = [
  { to: "/", label: "Create", icon: IconWand, exact: true },
  { to: "/videos", label: "Videos", icon: IconMovie, exact: false },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        {/* clears the macOS traffic lights and gives the window a drag handle */}
        <div className="drag h-6" />
        <div className="flex items-center gap-2.5 px-1.5 pb-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-ember/80 to-ember/30 font-display text-sm text-ember-foreground">
            K
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-base leading-none tracking-tight">
              Kreeyts
            </span>
            <span className="font-mono text-[0.55rem] tracking-[0.25em] text-muted-foreground/70 uppercase">
              studio
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.map((item) => {
              const isActive = item.exact
                ? pathname === item.to
                : pathname.startsWith(item.to)
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                  >
                    <Link to={item.to} className="no-drag">
                      <Icon />
                      <span className="font-display text-[0.95rem]">
                        {item.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
