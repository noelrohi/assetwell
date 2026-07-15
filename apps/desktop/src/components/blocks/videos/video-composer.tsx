import * as React from "react"
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconPhotoPlus,
  IconSelector,
  IconX,
} from "@tabler/icons-react"
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
import { DEFAULT_VIDEO_DURATION_SECONDS } from "@/lib/higgsfield/constants"
import { matchesHiggsfieldRatio } from "@/lib/higgsfield/model-aspect-ratios"
import {
  defaultVideoSizes,
  placementSpecs,
  videoPlacements,
  type VideoPlacement,
} from "@/lib/placements"
import { cn } from "@/lib/utils"

const klingVideoModelMatch = [
  "kling v3.0",
  "kling v3",
  "klingv3.0",
  "kling_v3",
  "klingv3",
]
const klingVideoModelExclude = [
  "turbo",
  "motion control",
  "motion_control",
  "motioncontrol",
]
const seedanceVideoModelMatch = [
  "seedance 2.0",
  "seedance2.0",
  "seedance2_0",
  "seedance20",
]

const recommendedVideoModels: ModelRecommendation[] = [
  {
    key: "kling-3-0",
    match: klingVideoModelMatch,
    exclude: klingVideoModelExclude,
  },
  { key: "seedance-2-0", match: seedanceVideoModelMatch },
]

const MIN_VIDEO_DURATION_SECONDS = 1
const MAX_VIDEO_DURATION_SECONDS = 60
const DURATION_PRESETS = [3, 5, 8, 10, 15]

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
    () =>
      pickDefaultModelId(
        videoModels,
        klingVideoModelMatch,
        klingVideoModelExclude,
      ),
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
  const [sizes, setSizes] = React.useState<VideoPlacement[]>(() =>
    defaultVideoSizes(videoDraftSource?.width, videoDraftSource?.height),
  )
  const lastDraftSource = React.useRef(videoDraftSource)
  const [durationPickerOpen, setDurationPickerOpen] = React.useState(false)

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

  React.useEffect(() => {
    if (videoDraftSource === lastDraftSource.current) return
    lastDraftSource.current = videoDraftSource
    if (!videoDraftSource) return
    setSizes(defaultVideoSizes(videoDraftSource.width, videoDraftSource.height))
  }, [videoDraftSource])

  function toggleSize(size: VideoPlacement) {
    setSizes((current) =>
      current.includes(size)
        ? current.filter((item) => item !== size)
        : [...current, size],
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-secondary p-3 text-secondary-foreground shadow-2xl shadow-black/10 backdrop-blur-xl transition duration-200 focus-within:ring-1 focus-within:ring-ring/40">
      <div className="flex min-w-0 flex-col">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe the motion — camera move, energy, timing…"
          className="min-h-[88px] resize-none rounded-lg border-0 bg-transparent px-1 pt-1 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0 dark:bg-transparent"
        />

        {videoDraftSource && (
          <div className="flex flex-wrap gap-2 px-1 pt-2">
            <span className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 py-1 pr-2 pl-1 text-xs text-muted-foreground">
              <img
                src={videoDraftSource.url}
                alt="source frame"
                className="size-5 rounded-full object-cover"
              />
              <span className="max-w-40 truncate">
                source frame
                {videoDraftSource.width && videoDraftSource.height
                  ? ` · ${videoDraftSource.width}×${videoDraftSource.height}`
                  : ""}
              </span>
              <button
                onClick={() => setVideoDraftSource(null)}
                className="text-muted-foreground/70 transition-colors hover:text-foreground"
                aria-label="Remove source frame"
              >
                <IconX className="size-3.5" />
              </button>
            </span>
          </div>
        )}

        <div className="mt-1 flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <button
              onClick={() => void chooseVideoSource()}
              aria-label="Attach image"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors hover:bg-accent",
                videoDraftSource && "bg-ember/10 text-ember hover:bg-ember/15",
              )}
            >
              <IconPhotoPlus className="size-3.5" />
              Attach image
            </button>

            <ModelPicker
              models={videoModels}
              value={model}
              onChange={setModel}
              recommendations={recommendedVideoModels}
            />

            <Popover
              open={durationPickerOpen}
              onOpenChange={setDurationPickerOpen}
            >
              <PopoverTrigger
                aria-label="Video duration"
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors hover:bg-accent data-[state=open]:bg-accent",
                  durationSeconds === null && "text-destructive",
                )}
              >
                <IconClock className="size-3.5 text-muted-foreground" />
                <span className="font-mono tabular-nums">
                  {durationInput || "0"}s
                </span>
                <IconSelector className="size-3.5 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-56 p-2">
                <div className="px-2 pt-1 pb-2">
                  <p className="text-xs font-medium text-foreground">
                    Duration
                  </p>
                  <p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground/75">
                    {MIN_VIDEO_DURATION_SECONDS}–{MAX_VIDEO_DURATION_SECONDS}{" "}
                    seconds per clip.
                  </p>
                </div>
                <div className="mb-2 flex flex-wrap gap-1 px-1">
                  {DURATION_PRESETS.map((preset) => {
                    const selected = durationSeconds === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setDurationInput(`${preset}`)
                          setDurationPickerOpen(false)
                        }}
                        className={cn(
                          "h-7 rounded-full px-2.5 font-mono text-[0.7rem] tabular-nums transition-colors",
                          selected
                            ? "bg-ember/10 text-ember"
                            : "text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {preset}s
                      </button>
                    )
                  })}
                </div>
                <label
                  htmlFor={durationInputId}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/45 px-2.5 py-1.5 transition-colors focus-within:border-primary/50"
                >
                  <span className="text-xs text-muted-foreground">Custom</span>
                  <input
                    id={durationInputId}
                    value={durationInput}
                    onChange={(event) =>
                      setDurationInput(
                        event.currentTarget.value
                          .replace(/\D/g, "")
                          .slice(0, 2),
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
                    className="w-full bg-transparent text-right font-mono text-[0.7rem] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    sec
                  </span>
                </label>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger
                aria-label="Choose sizes"
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors hover:bg-accent data-[state=open]:bg-accent"
              >
                <span>
                  {sizes.length
                    ? `${sizes.length} size${sizes.length > 1 ? "s" : ""}`
                    : "Sizes"}
                </span>
                <IconSelector className="size-3.5 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-64 p-2">
                <div className="px-2 pt-1 pb-2">
                  <p className="text-xs font-medium text-foreground">Sizes</p>
                  <p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground/75">
                    Render one clip per selected size. Sizes that don’t match
                    your source get a matching frame generated first.
                  </p>
                </div>
                <div className="grid gap-1">
                  {videoPlacements.map((size) => {
                    const selected = sizes.includes(size)
                    const spec = placementSpecs[size]
                    const autoFramed = Boolean(
                      videoDraftSource?.width &&
                      videoDraftSource.height &&
                      !matchesHiggsfieldRatio(
                        videoDraftSource.width,
                        videoDraftSource.height,
                        spec.aspectRatio,
                      ),
                    )
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                          selected
                            ? "bg-ember/10 text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <span className="min-w-0 flex-1 font-mono text-xs leading-none">
                          {size}
                        </span>
                        {autoFramed && (
                          <span className="shrink-0 rounded-full bg-ember/10 px-1.5 py-0.5 text-[0.55rem] font-medium text-ember">
                            re-frame
                          </span>
                        )}
                        {selected && (
                          <IconCheck className="size-3.5 shrink-0 text-ember" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors hover:bg-accent">
                Templates
                <IconSelector className="size-3.5 shrink-0 text-muted-foreground" />
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
              "group flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all sm:ml-auto",
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
  )
}
