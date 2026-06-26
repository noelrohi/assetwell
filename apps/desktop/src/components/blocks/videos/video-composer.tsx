import * as React from "react"
import {
  IconArrowRight,
  IconBook,
  IconClock,
  IconPhotoPlus,
  IconX,
} from "@tabler/icons-react"
import { useQueryState } from "nuqs"
import { toast } from "sonner"

import {
  ModelPicker,
  pickDefaultModelId,
  type ModelRecommendation,
} from "@/components/blocks/composer/model-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import { videoPlacements, type VideoPlacement } from "@/lib/placements"
import { videoPlacementSelectionParser } from "@/lib/query-state"
import { cn } from "@/lib/utils"

const defaultVideoModelMatch = [
  "seedance 2.0",
  "seedance2.0",
  "seedance2_0",
  "seedance20",
]

const recommendedVideoModels: ModelRecommendation[] = [
  {
    key: "kling-3-0",
    match: ["kling v3.0", "kling v3", "klingv3.0", "kling_v3", "klingv3"],
    exclude: ["turbo", "motion control", "motion_control", "motioncontrol"],
  },
  { key: "seedance-2-0", match: defaultVideoModelMatch },
]

const DEFAULT_VIDEO_DURATION_SECONDS = 8
const MIN_VIDEO_DURATION_SECONDS = 1
const MAX_VIDEO_DURATION_SECONDS = 60

function parseVideoDurationSeconds(value: string) {
  const duration = Number.parseInt(value, 10)

  if (
    !Number.isFinite(duration) ||
    duration < MIN_VIDEO_DURATION_SECONDS ||
    duration > MAX_VIDEO_DURATION_SECONDS
  ) {
    return null
  }

  return duration
}

function clampedVideoDurationSeconds(value: string) {
  const duration = Number.parseInt(value, 10)

  if (!Number.isFinite(duration)) return DEFAULT_VIDEO_DURATION_SECONDS

  return Math.min(
    Math.max(duration, MIN_VIDEO_DURATION_SECONDS),
    MAX_VIDEO_DURATION_SECONDS,
  )
}

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
  const durationInputId = React.useId()
  const defaultModelId = React.useMemo(
    () => pickDefaultModelId(videoModels, defaultVideoModelMatch),
    [videoModels],
  )
  const [model, setModel] = React.useState(defaultModelId)
  const [durationInput, setDurationInput] = React.useState(
    `${DEFAULT_VIDEO_DURATION_SECONDS}`,
  )
  const durationSeconds = React.useMemo(
    () => parseVideoDurationSeconds(durationInput),
    [durationInput],
  )
  const [sizes, setSizes] = useQueryState(
    "sizes",
    videoPlacementSelectionParser,
  )

  const canMake =
    Boolean(videoDraftSource) &&
    prompt.trim().length > 0 &&
    sizes.length > 0 &&
    model.length > 0 &&
    durationSeconds !== null

  React.useEffect(() => {
    if (!model || !videoModels.some((item) => item.id === model)) {
      setModel(defaultModelId)
    }
  }, [defaultModelId, model, videoModels])

  function toggleSize(size: VideoPlacement) {
    void setSizes((current) =>
      current.includes(size)
        ? current.filter((item) => item !== size)
        : [...current, size],
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
              recommendations={recommendedVideoModels}
            />

            <label
              htmlFor={durationInputId}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/45 px-2.5 text-xs font-medium transition-colors focus-within:ring-2",
                durationSeconds === null
                  ? "border-destructive/60 focus-within:ring-destructive/15"
                  : "focus-within:border-primary/50 focus-within:ring-primary/15",
              )}
              title="Video duration"
            >
              <IconClock className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Duration</span>
              <input
                id={durationInputId}
                value={durationInput}
                onChange={(event) =>
                  setDurationInput(
                    event.currentTarget.value.replace(/\D/g, "").slice(0, 2),
                  )
                }
                onBlur={() =>
                  setDurationInput(
                    `${clampedVideoDurationSeconds(durationInput)}`,
                  )
                }
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Video duration in seconds"
                aria-invalid={durationSeconds === null}
                className="w-7 bg-transparent text-right font-mono text-[0.7rem] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="font-mono text-[0.65rem] text-muted-foreground">
                sec
              </span>
            </label>

            <Popover>
              <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/45 px-3 text-xs font-medium transition-colors hover:bg-accent">
                <IconBook className="size-3.5" />
                Templates
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-1.5">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Video templates
                </p>
                {prompt.trim().length >= 3 && (
                  <button
                    onClick={() => savePromptPreset("video", prompt)}
                    className="mb-1 flex w-full rounded-md px-2 py-2 text-left text-sm font-medium text-ember transition-colors hover:bg-accent"
                  >
                    Save as template
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
                if (!canMake || durationSeconds === null) return
                void makeVideos({
                  prompt,
                  model,
                  sizes,
                  source: videoDraftSource!,
                  durationSeconds,
                })
                toast(
                  `Queued ${sizes.length} ${durationSeconds}s video${sizes.length > 1 ? "s" : ""}`,
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
