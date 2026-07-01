import {
  availableImagePlacementSpecs,
  formatPlacementSize,
  getPlacementSpec,
  type ImagePlacement,
} from "@assetwell/product/placements"
import { Button } from "@assetwell/ui/button"
import { createFileRoute } from "@tanstack/react-router"
import {
  CheckCircle2,
  Download,
  Film,
  FolderOpen,
  Images,
  Layers3,
  Loader2,
  Maximize2,
  Paperclip,
  Wand2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  AssetwellLogo,
  SiteBackground,
  SiteFooter,
  SiteHeader,
} from "../components/site-chrome"
import { DOWNLOAD_URL } from "../lib/constants"

export const Route = createFileRoute("/")({ component: Home })

const featureCards: Array<{
  title: string
  description: string
  icon: LucideIcon
}> = [
  {
    title: "Every size from one image",
    description:
      "Make your image once, then turn it into all the sizes you run — feed, story, banner, square — without starting over for each one.",
    icon: Maximize2,
  },
  {
    title: "Turn a photo into a video",
    description:
      "Got a winner? Make a moving version of it in a couple of clicks, at the size and length you want.",
    icon: Film,
  },
  {
    title: "Your files, on your computer",
    description:
      "Everything saves to a plain folder you own. Open it, drop it into your campaign, done — no logins, no digging through a cloud library.",
    icon: FolderOpen,
  },
]

const workflow = [
  {
    title: "Describe what you want",
    detail:
      "Type a prompt, pick a starting size, and add a reference if you have one.",
  },
  {
    title: "Make every size at once",
    detail:
      "One click turns your pick into all the sizes you need. If one comes out off, redo just that one — the rest stay put.",
  },
  {
    title: "Grab the folder, or make a video",
    detail:
      "Open the finished folder and you're done — or turn a favorite into a video first.",
  },
]

const imageSizes = availableImagePlacementSpecs.map((placement) => ({
  id: placement.id,
  size: formatPlacementSize(placement.id),
  label: placement.label,
}))

function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteBackground />

      <SiteHeader />

      <main>
        <section className="relative px-6 pt-28 sm:pt-36">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 isolate hidden opacity-65 contain-strict lg:block"
          >
            <div className="absolute left-0 top-0 h-320 w-140 -translate-y-87.5 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
            <div className="absolute left-0 top-0 h-320 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
          </div>

          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
                <span className="size-1.5 rounded-full bg-emerald-400" />A
                desktop app for ad creatives
              </p>
              <h1 className="mx-auto max-w-4xl text-balance text-5xl font-light tracking-tight md:text-7xl xl:text-[5.25rem]">
                Every ad size, made in one place.
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground">
                Write one prompt, pick the image you like, then make every size
                you need on a single screen. No juggling cloud tabs, no
                re-uploading the same picture — just the finished set, saved
                right to your computer.
              </p>

              <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <div className="rounded-[calc(var(--radius-xl)+0.125rem)] border bg-foreground/10 p-0.5">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-xl px-5 text-base"
                  >
                    <a href={DOWNLOAD_URL}>
                      <Download className="mr-2 size-4" />
                      <span className="text-nowrap">Download Assetwell</span>
                    </a>
                  </Button>
                </div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 rounded-xl px-5"
                >
                  <a href="#how-it-works">
                    <span className="text-nowrap">See how it works</span>
                  </a>
                </Button>
              </div>
            </div>

            <div className="relative mt-12 w-full overflow-hidden px-0 sm:mt-16 md:mt-20">
              <div className="relative mx-auto aspect-[3024/1748] w-full max-w-7xl overflow-hidden rounded-2xl border bg-background shadow-2xl shadow-zinc-950/25 ring-1 ring-background dark:ring-white/10">
                <ProductMock />
              </div>
            </div>
          </div>
        </section>

        <section id="benefits" className="py-16 md:py-32">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center">
              <h2 className="text-balance text-4xl font-light lg:text-5xl">
                Anyone can make one image. The set is the grind.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Resizing it for every size, cutting a video version, and digging
                files out of a cloud app — that's the part you'd rather skip. So
                we made it one click.
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-sm gap-6 md:mt-16 md:max-w-full md:grid-cols-3">
              {featureCards.map((feature) => (
                <article
                  key={feature.title}
                  className="group rounded-2xl border bg-card/50 p-6 text-center shadow-sm shadow-zinc-950/5 transition-colors hover:bg-card/80"
                >
                  <CardDecorator>
                    <feature.icon className="size-6" />
                  </CardDecorator>
                  <h3 className="mt-6 text-lg font-medium">{feature.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-border bg-muted/35 py-24 md:py-32"
        >
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto max-w-3xl space-y-6 text-center">
              <h2 className="text-balance text-3xl font-light md:text-4xl lg:text-5xl">
                From idea to a full set in three steps
              </h2>
              <p className="text-muted-foreground">
                Start with one image. Every size, the video cut, and the saved
                folder come right off it — no back-and-forth, no waiting around.
              </p>
            </div>

            <div className="-mx-6 mt-10 px-6 [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_70%,transparent_100%)]">
              <div className="rounded-2xl border bg-background p-3 shadow-lg dark:bg-muted/40">
                <div className="grid gap-2 md:grid-cols-2">
                  <WorkflowPanel />
                  <FormatPanel />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-3xl">
            <div className="relative overflow-hidden rounded-3xl p-12 text-center sm:p-16">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-card to-card" />
              <div className="absolute inset-0 rounded-3xl border border-border" />

              <div className="relative">
                <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
                  Make your next set the easy way
                </h2>
                <p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">
                  One prompt in, a full set of ad creatives out — saved on your
                  computer, ready to ship.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 gap-3 rounded-full px-8 text-base"
                  >
                    <a href={DOWNLOAD_URL}>
                      <Download className="size-5" />
                      Download Assetwell
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-12 gap-3 rounded-full px-8 text-base"
                  >
                    <a href="#how-it-works">See how it works</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

const mockNav = [
  { label: "Create", icon: Wand2, active: true },
  { label: "Videos", icon: Film, active: false },
  { label: "Uploads", icon: Images, active: false },
  { label: "Prompt templates", icon: Layers3, active: false },
]

const mockPlacementStates = [
  "ready",
  "ready",
  "ready",
  "ready",
  "running",
  "idle",
] as const

const mockPlacements = availableImagePlacementSpecs.map((placement, index) => ({
  size: formatPlacementSize(placement.id),
  state: mockPlacementStates[index] ?? "idle",
}))
const readyMockPlacementCount = mockPlacements.filter(
  (placement) => placement.state === "ready",
).length
const mockPlacementProgress = Math.round(
  (readyMockPlacementCount / mockPlacements.length) * 100,
)

function ProductMock() {
  return (
    <div className="absolute inset-0 bg-[#0d0d0f] p-3 sm:p-5">
      <div className="flex h-full overflow-hidden rounded-xl border border-white/10 bg-[#111114] text-white shadow-2xl">
        <aside className="hidden w-60 border-r border-white/10 bg-white/[0.03] p-4 md:block">
          <div className="mb-7 flex items-center gap-2 px-1">
            <AssetwellLogo className="size-7" />
            <span className="text-sm font-semibold">Assetwell</span>
          </div>
          <div className="space-y-1 text-sm">
            {mockNav.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                  item.active ? "bg-white/10 text-white" : "text-white/55"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm text-white/45">
              <span>Create</span>
              <span className="text-white/25">/</span>
              <span className="text-white/80">Warm product launch</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/55">
                <span className="size-1.5 animate-pulse rounded-full bg-[#e7a23c]" />
                1 job running
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/70">
                <FolderOpen className="size-3.5" />
                Open folder
              </span>
            </div>
          </div>

          <div className="grid flex-1 gap-4 p-5 lg:grid-cols-[1fr_248px]">
            <div className="flex flex-col gap-4">
              <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#e7a23c]/25 via-[#1a1410] to-[#0f0d0c]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(231,162,60,0.35),transparent_45%)]" />
                <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[0.6rem] text-white/70 backdrop-blur">
                  Your image · 1024×1024
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="rounded-lg bg-white/[0.03] px-3 py-2.5 text-sm text-white/70">
                  Warm, premium launch shot — product centered, soft studio
                  light, crop ready for paid social.
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 font-mono text-[0.65rem] text-white/65">
                    1024×1024
                  </span>
                  <span className="flex items-center gap-1 rounded-full border border-[#e7a23c]/40 px-2.5 py-1 text-[0.65rem] text-[#e7a23c]">
                    <Paperclip className="size-3" />1 reference
                  </span>
                  <span className="ml-auto rounded-full bg-[#e7a23c] px-3 py-1 text-[0.65rem] font-medium text-black">
                    Create
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Maximize2 className="size-4 text-white/55" />
                  <p className="text-sm font-medium">Ad sizes</p>
                </div>
                <span className="font-mono text-[0.65rem] text-white/45">
                  {readyMockPlacementCount}/{mockPlacements.length}
                </span>
              </div>

              <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#e7a23c]"
                  style={{ width: `${mockPlacementProgress}%` }}
                />
              </div>

              <div className="mt-3 flex h-8 items-center justify-center gap-2 rounded-full bg-[#e7a23c] text-[0.7rem] font-medium text-black">
                Make every size
              </div>

              <div className="mt-3 space-y-1">
                {mockPlacements.map((p) => (
                  <div
                    key={p.size}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs"
                  >
                    <span className="font-mono text-white/70">{p.size}</span>
                    {p.state === "ready" && (
                      <CheckCircle2 className="size-3.5 text-emerald-300" />
                    )}
                    {p.state === "running" && (
                      <Loader2 className="size-3.5 animate-spin text-[#e7a23c]" />
                    )}
                    {p.state === "idle" && (
                      <span className="size-3.5 rounded-full border border-white/20" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkflowPanel() {
  return (
    <div className="space-y-3 rounded-xl border bg-card/50 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        The flow
      </p>
      {workflow.map((step, index) => (
        <div
          key={step.title}
          className="flex items-start gap-4 rounded-lg border bg-background/60 p-4"
        >
          <span className="mt-0.5 font-mono text-xs text-muted-foreground">
            0{index + 1}
          </span>
          <div>
            <p className="text-sm font-medium">{step.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {step.detail}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function FormatPanel() {
  return (
    <div className="space-y-3 rounded-xl border bg-card/50 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Every size, made for you
      </p>
      <div className="grid grid-cols-2 gap-3">
        {imageSizes.map((format) => (
          <div
            key={format.size}
            className="rounded-lg border bg-background/60 p-4"
          >
            <div className="mb-4 flex h-16 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-transparent">
              <PlacementSwatch placement={format.id} />
            </div>
            <p className="font-mono text-sm font-medium">{format.size}</p>
            <p className="text-xs text-muted-foreground">{format.label}</p>
          </div>
        ))}
      </div>
      <p className="px-0.5 text-xs leading-5 text-muted-foreground">
        Plus video sizes, with more on the way.
      </p>
    </div>
  )
}

function PlacementSwatch({ placement }: { placement: ImagePlacement }) {
  const { width: w, height: h } = getPlacementSpec(placement)
  const max = 40
  const width = w >= h ? max : (max * w) / h
  const height = h >= w ? max : (max * h) / w
  return (
    <span
      className="rounded-[3px] border border-primary/50 bg-primary/10"
      style={{ width, height }}
    />
  )
}

function CardDecorator({ children }: { children: ReactNode }) {
  return (
    <div className="mask-radial-from-40% mask-radial-to-60% relative mx-auto size-36 duration-200 [--color-border:color-mix(in_oklab,var(--color-zinc-950)_10%,transparent)] group-hover:[--color-border:color-mix(in_oklab,var(--color-zinc-950)_20%,transparent)] dark:[--color-border:color-mix(in_oklab,var(--color-white)_15%,transparent)] dark:group-hover:[--color-border:color-mix(in_oklab,var(--color-white)_20%,transparent)]">
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-50"
      />

      <div className="absolute inset-0 m-auto flex size-12 items-center justify-center border-l border-t bg-background">
        {children}
      </div>
    </div>
  )
}
