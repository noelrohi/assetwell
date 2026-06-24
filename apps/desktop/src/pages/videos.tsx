import * as React from "react"
import { Link } from "@tanstack/react-router"
import {
  IconArrowRight,
  IconBook,
  IconLoader2,
  IconPhotoPlus,
  IconPlayerPlayFilled,
  IconSparkles,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  aspectOf,
  placementSpecs,
  videoPlacements,
  type VideoPlacement,
} from "@/lib/placements"
import {
  videoPromptLibrary,
  useHiggsfieldApp,
} from "@/lib/higgsfield"

function VideoComposer() {
  const {
    videoModels,
    videoDraftSource,
    chooseVideoSource,
    setVideoDraftSource,
    makeVideos,
  } = useHiggsfieldApp()
  const [prompt, setPrompt] = React.useState("")
  const [model, setModel] = React.useState(videoModels[0]?.id ?? "")
  const [sizes, setSizes] = React.useState<VideoPlacement[]>(["1280x720"])

  const canMake =
    Boolean(videoDraftSource) &&
    prompt.trim().length > 0 &&
    sizes.length > 0 &&
    model.length > 0

  React.useEffect(() => {
    if (!model && videoModels[0]) setModel(videoModels[0].id)
    if (model && !videoModels.some((item) => item.id === model)) {
      setModel(videoModels[0]?.id ?? "")
    }
  }, [model, videoModels])

  function toggleSize(s: VideoPlacement) {
    setSizes(sizes.includes(s) ? sizes.filter((x) => x !== s) : [...sizes, s])
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-3 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        {/* attached image */}
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted/30">
          {videoDraftSource ? (
            <>
              <img
                src={videoDraftSource.url}
                alt="source"
                className="size-full object-cover"
              />
              <button
                onClick={() => setVideoDraftSource(null)}
                className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
              >
                <IconX className="size-3.5" />
              </button>
              <span className="absolute bottom-2 left-2 rounded-full bg-background/70 px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground backdrop-blur">
                source frame
              </span>
            </>
          ) : (
            <button
              onClick={() => void chooseVideoSource()}
              className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <IconPhotoPlus className="size-6" />
              <span className="text-xs">Attach image</span>
            </button>
          )}
        </div>

        {/* controls */}
        <div className="flex flex-col">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the motion — camera move, energy, timing…"
            className="min-h-[84px] flex-1 resize-none rounded-lg border-0 bg-transparent px-1 text-base leading-relaxed shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent"
          />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-8 gap-1.5 rounded-full border-border/70 bg-background/50 px-3 text-xs font-medium data-[size=default]:h-8">
                <IconSparkles className="size-3.5 text-ember" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-60">
                {videoModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex flex-col">
                      <span>{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 text-xs font-medium transition-colors hover:bg-accent">
                <IconBook className="size-3.5" />
                Prompts
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-1.5">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Video prompts
                </p>
                {videoPromptLibrary.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPrompt(p.body)
                      toast(`Loaded "${p.title}"`)
                    }}
                    className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <span className="text-sm">{p.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {p.body}
                    </span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.65rem] text-muted-foreground">
              sizes
            </span>
            {videoPlacements.map((s) => {
              const on = sizes.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleSize(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[0.65rem] transition-colors",
                    on
                      ? "border-ember/50 bg-ember/10 text-ember"
                      : "border-border/70 text-muted-foreground hover:bg-accent",
                  )}
                >
                  {s}
                </button>
              )
            })}

            <button
              onClick={() => {
                if (!canMake) return
                void makeVideos({
                  prompt,
                  model,
                  sizes,
                  source: videoDraftSource!,
                })
                toast(`Queued ${sizes.length} video${sizes.length > 1 ? "s" : ""}`)
                setPrompt("")
              }}
              disabled={!canMake}
              className={cn(
                "group ml-auto flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
                canMake
                  ? "bg-ember text-ember-foreground ember-glow hover:brightness-105"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              Animate
              <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VideosPage() {
  const { videos } = useHiggsfieldApp()

  return (
    <div className="mx-auto max-w-6xl px-8 pt-10 pb-24">
      <div className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both">
        <p className="font-mono text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
          Motion
        </p>
        <h1 className="mt-1.5 font-display text-3xl tracking-tight">
          Bring a frame to life
        </h1>
      </div>

      <div className="mt-6">
        <VideoComposer />
      </div>

      <h2 className="mt-12 font-display text-xl">Your videos</h2>
      <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {videos.map((v, i) => {
          const spec = placementSpecs[v.size]
          return (
            <div
              key={v.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both group overflow-hidden rounded-xl border border-border/70 bg-card/40 transition-colors hover:border-border"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className="relative w-full overflow-hidden bg-muted/40"
                style={{ aspectRatio: aspectOf(spec.width, spec.height) }}
              >
                {v.url && v.status === "ready" ? (
                  <video
                    src={v.url}
                    muted
                    loop
                    playsInline
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <img
                    src={v.posterUrl}
                    alt={v.prompt}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                {v.status === "pending" ? (
                  <div className="absolute inset-0 grid place-items-center bg-background/40">
                    <IconLoader2 className="size-5 animate-spin text-ember" />
                  </div>
                ) : v.status === "failed" ? (
                  <div className="absolute inset-0 grid place-items-center bg-background/50 text-destructive">
                    <span className="font-mono text-[0.65rem]">failed</span>
                  </div>
                ) : (
                  <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="ember-glow grid size-11 place-items-center rounded-full bg-background/70 text-foreground backdrop-blur">
                      <IconPlayerPlayFilled className="size-4" />
                    </span>
                  </div>
                )}
                <span className="absolute top-2 left-2 rounded-full bg-background/70 px-2 py-0.5 font-mono text-[0.6rem] text-muted-foreground backdrop-blur">
                  {v.size}
                </span>
              </div>
              <div className="px-3.5 py-3">
                <p className="line-clamp-1 text-sm">{v.prompt}</p>
                {v.sourceCreativeId && (
                  <Link
                    to="/creative/$creativeId"
                    params={{ creativeId: v.sourceCreativeId }}
                    className="mt-1 block truncate font-mono text-[0.65rem] text-muted-foreground transition-colors hover:text-ember"
                  >
                    from {v.sourceTitle}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
