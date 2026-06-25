import * as React from "react"
import {
  IconArrowRight,
  IconBook,
  IconPhotoPlus,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { ModelPicker } from "@/components/blocks/composer/model-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { videoPlacements, type VideoPlacement } from "@/lib/placements"
import { cn } from "@/lib/utils"

export function VideoComposer() {
  const {
    videoModels,
    videoPrompts,
    videoDraftSource,
    chooseVideoSource,
    savePromptPreset,
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

  function toggleSize(size: VideoPlacement) {
    setSizes(
      sizes.includes(size)
        ? sizes.filter((item) => item !== size)
        : [...sizes, size],
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-sidebar-border/90 bg-sidebar/95 p-3 text-sidebar-foreground shadow-2xl shadow-black/10 backdrop-blur-xl transition-colors duration-200 focus-within:border-primary/50">
      <div className="grid gap-3 md:grid-cols-[168px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border/70 bg-muted/25">
          {videoDraftSource ? (
            <>
              <img
                src={videoDraftSource.url}
                alt="source"
                className="size-full object-cover"
              />
              <button
                onClick={() => setVideoDraftSource(null)}
                className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
                aria-label="Remove source frame"
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

        <div className="flex min-w-0 flex-col">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the motion — camera move, energy, timing…"
            className="min-h-[88px] flex-1 resize-none rounded-lg border-0 bg-transparent px-1 pt-1 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0 dark:bg-transparent"
          />

          <div className="mt-1 flex flex-wrap items-center gap-2 pt-2">
            <ModelPicker
              models={videoModels}
              value={model}
              onChange={setModel}
            />

            <Popover>
              <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/45 px-3 text-xs font-medium transition-colors hover:bg-accent">
                <IconBook className="size-3.5" />
                Prompts
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-1.5">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Video prompts
                </p>
                {prompt.trim().length >= 3 && (
                  <button
                    onClick={() => savePromptPreset("video", prompt)}
                    className="mb-1 flex w-full rounded-md px-2 py-2 text-left text-sm font-medium text-ember transition-colors hover:bg-accent"
                  >
                    Save current prompt
                  </button>
                )}
                {videoPrompts.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setPrompt(preset.body)
                      toast(`Loaded "${preset.title}"`)
                    }}
                    className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <span className="text-sm">{preset.title}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {preset.body}
                    </span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {videoPlacements.map((size) => {
              const selected = sizes.includes(size)
              return (
                <button
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[0.65rem] transition-colors",
                    selected
                      ? "border-ember/50 bg-ember/10 text-ember"
                      : "border-border/70 text-muted-foreground hover:bg-accent",
                  )}
                >
                  {size}
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
                toast(
                  `Queued ${sizes.length} video${sizes.length > 1 ? "s" : ""}`,
                )
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
