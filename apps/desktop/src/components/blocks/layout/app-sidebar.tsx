import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { IconMovie, IconWand } from "@tabler/icons-react"

import { NavUser } from "@/components/blocks/layout/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      className="group/sidebar-resizable bg-sidebar/80 backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/70"
      {...props}
    >
      <SidebarHeader className="drag h-[44px] flex-row items-center px-3 py-0" />

      <SidebarContent className="scrollbar-none bg-transparent">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
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
                      className="h-8 text-[15px] data-[active=true]:bg-sidebar-accent/60 data-[active=true]:font-normal"
                    >
                      <Link to={item.to} className="no-drag">
                        <Icon size={17} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative bg-sidebar/70 pb-3 backdrop-blur-xl supports-[backdrop-filter]:bg-sidebar/60">
        <div className="pointer-events-none absolute -top-10 right-0 left-0 h-10 bg-gradient-to-t from-sidebar/70 via-sidebar/35 to-transparent supports-[backdrop-filter]:from-sidebar/60" />
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
