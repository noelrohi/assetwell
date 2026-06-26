import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router"

import { AppShell } from "@/components/blocks/layout/app-shell"
import { BrandMemoryPage } from "@/pages/brand-memory"
import { CreatePage } from "@/pages/create"
import { CreativePage } from "@/pages/creative"
import { PromptTemplatesPage } from "@/pages/prompt-templates"
import { VideoPage } from "@/pages/video"
import { VideosPage } from "@/pages/videos"

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

const brandMemoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/brand-memory",
  component: BrandMemoryPage,
})

const promptTemplatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/prompt-templates",
  component: PromptTemplatesPage,
})

const creativeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/creative/$creativeId",
  component: CreativePage,
})

const videoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/video/$videoId",
  component: VideoPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  videosRoute,
  brandMemoryRoute,
  promptTemplatesRoute,
  creativeRoute,
  videoRoute,
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
