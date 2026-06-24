import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"

import { AppShell } from "@/components/app-shell"
import { CreatePage } from "@/pages/create"
import { VideosPage } from "@/pages/videos"
import { CreativePage } from "@/pages/creative"

const rootRoute = createRootRoute({ component: AppShell })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: CreatePage,
})

const videosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/videos",
  component: VideosPage,
})

const creativeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/creative/$creativeId",
  component: CreativePage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  videosRoute,
  creativeRoute,
])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
