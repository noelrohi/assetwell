import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  IconArrowRight,
  IconBook,
  IconCheck,
  IconChevronDown,
  IconPaperclip,
  IconPlus,
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
import {
  baseRatios,
  nearestBaseRatio,
  supportedBaseRatios,
  type BaseRatio,
} from "@/lib/placements"
import { cn } from "@/lib/utils"

const defaultImageModelMatch = ["gpt image 2", "gpt_image_2"]

const recommendedImageModels: ModelRecommendation[] = [
  { key: "gpt-image-2", match: defaultImageModelMatch },
  { key: "nano-banana-2", match: ["nano banana 2", "nano_banana_2"] },
  { key: "nano-banana-pro", match: ["nano banana pro", "nano_banana_pro"] },
]

export function ImageComposer() {
  const navigate = useNavigate()
  const {
    imageModels,
    referenceLibrary,
    imagePrompts,
    chooseReferenceAsset,
    refreshReferenceLibrary,
    savePromptPreset,
    getModelAspectRatios,
    makeCreative,
  } = useHiggsfieldApp()
  const [prompt, setPrompt] = React.useState("")
  const [ratioId, setRatioId] = React.useState<string>(baseRatios[0].id)
  const defaultModelId = React.useMemo(
    () => pickDefaultModelId(imageModels, defaultImageModelMatch),
    [imageModels],
  )
  const [model, setModel] = React.useState(defaultModelId)
  const [refs, setRefs] = React.useState<string[]>([])
  const [ratioPickerOpen, setRatioPickerOpen] = React.useState(false)
  const fallbackRatioIds = React.useMemo(
    () => baseRatios.map((ratio) => ratio.id),
    [],
  )
  const [modelRatios, setModelRatios] =
    React.useState<string[]>(fallbackRatioIds)

  const selectedModel = imageModels.find((item) => item.id === model)
  const selectedRatio =
    baseRatios.find((item) => item.id === ratioId) ?? baseRatios[0]
  const ratioOptions = React.useMemo(
    () => supportedBaseRatios(modelRatios),
    [modelRatios],
  )
  const ratio =
    ratioOptions.find((item) => item.id === ratioId) ??
    nearestBaseRatio(selectedRatio, ratioOptions)
  const ratioSupportCopy =
    ratioOptions.length < baseRatios.length
      ? `${ratioOptions.length} size${ratioOptions.length === 1 ? "" : "s"} for ${selectedModel?.label ?? "this model"}`
      : "Common Higgsfield sizes"
  const canMake = prompt.trim().length > 0 && model.length > 0

  React.useEffect(() => {
    if (!model || !imageModels.some((item) => item.id === model)) {
      setModel(defaultModelId)
    }
  }, [defaultModelId, imageModels, model])

  React.useEffect(() => {
    if (!model) {
      setModelRatios(fallbackRatioIds)
      return
    }

    setModelRatios(fallbackRatioIds)

    let cancelled = false
    void getModelAspectRatios(model, "image")
      .then((ratios) => {
        if (cancelled) return
        setModelRatios(ratios.length ? ratios : fallbackRatioIds)
      })
      .catch(() => {
        if (!cancelled) setModelRatios(fallbackRatioIds)
      })
    return () => {
      cancelled = true
    }
  }, [fallbackRatioIds, getModelAspectRatios, model])

  React.useEffect(() => {
    if (!ratioOptions.some((r) => r.id === ratioId)) {
      setRatioId(nearestBaseRatio(selectedRatio, ratioOptions).id)
    }
  }, [ratioId, ratioOptions, selectedRatio])

  async function make() {
    if (!canMake) return
    const creativeId = await makeCreative({
      prompt,
      ratioId: ratio.id,
      ratioW: ratio.width,
      ratioH: ratio.height,
      model,
      referenceIds: refs,
    })
    if (!creativeId) return

    toast("Queued base image", {
      description: `${ratio.label} · ${imageModels.find((m) => m.id === model)?.label ?? model}`,
    })
    setPrompt("")
    setRefs([])
    navigate({ to: "/creative/$creativeId", params: { creativeId } })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-sidebar-border/90 bg-sidebar/95 text-sidebar-foreground shadow-2xl shadow-black/10 backdrop-blur-xl transition-colors duration-200 focus-within:border-primary/50">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) make()
        }}
        placeholder="Describe the image you want to create…"
        className="min-h-[104px] resize-none rounded-none border-0 bg-transparent px-4 pt-4 text-[15px] leading-relaxed shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0 dark:bg-transparent"
      />

      {refs.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {refs.map((id) => {
            const ref = referenceLibrary.find((r) => r.id === id)
            if (!ref) return null
            return (
              <span
                key={id}
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 py-1 pr-2 pl-1 text-xs text-muted-foreground"
              >
                <img
                  src={ref.url}
                  alt={ref.name}
                  className="size-5 rounded-full object-cover"
                />
                <span className="max-w-32 truncate">{ref.name}</span>
                <button
                  onClick={() => setRefs(refs.filter((r) => r !== id))}
                  className="text-muted-foreground/70 transition-colors hover:text-foreground"
                  aria-label={`Remove ${ref.name}`}
                >
                  <IconX className="size-3.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 px-3 pt-1 pb-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Popover open={ratioPickerOpen} onOpenChange={setRatioPickerOpen}>
            <PopoverTrigger
              className="flex h-8 min-w-[132px] items-center gap-1.5 rounded-full border border-border/70 bg-background/45 px-3 text-xs font-medium transition-colors hover:bg-accent data-[state=open]:bg-accent"
              aria-label="Choose base size"
            >
              <RatioSwatch ratio={ratio} />
              <span className="font-mono leading-none">{ratio.id}</span>
              <span className="min-w-0 max-w-24 truncate text-muted-foreground">
                {ratio.label}
              </span>
              <IconChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-72 p-2">
              <div className="px-2 pt-1 pb-2">
                <p className="text-xs font-medium text-foreground">Base size</p>
                <p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground/75">
                  {ratioSupportCopy}. Options update per model, and switching
                  back is instant.
                </p>
              </div>
              <div className="grid gap-1">
                {ratioOptions.map((r) => {
                  const selected = r.id === ratio.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRatioId(r.id)
                        setRatioPickerOpen(false)
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                        selected
                          ? "bg-ember/10 text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <RatioSwatch ratio={r} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-xs leading-none">
                          {r.id}
                        </span>
                        <span className="mt-1 block text-[0.68rem] leading-none text-muted-foreground">
                          {r.label}
                        </span>
                      </span>
                      {selected && (
                        <IconCheck className="size-3.5 shrink-0 text-ember" />
                      )}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>

          <ModelPicker
            models={imageModels}
            value={model}
            onChange={setModel}
            recommendations={recommendedImageModels}
          />

          <Popover
            onOpenChange={(open) => {
              if (open) void refreshReferenceLibrary()
            }}
          >
            <PopoverTrigger
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/45 px-3 text-xs font-medium transition-colors hover:bg-accent",
                refs.length > 0 && "border-ember/40 text-ember",
              )}
            >
              <IconPaperclip className="size-3.5" />
              {refs.length > 0
                ? `${refs.length} ref${refs.length > 1 ? "s" : ""}`
                : "Reference"}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-3">
              <div className="mb-3 flex items-start justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Brand Memory references
                  </p>
                  <p className="mt-0.5 text-[0.68rem] leading-4 text-muted-foreground/70">
                    Files are read from the Brand Memory folder.
                  </p>
                </div>
                <button
                  onClick={() => void chooseReferenceAsset()}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border/70 px-2 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <IconPlus className="size-3" />
                  Add
                </button>
              </div>
              {referenceLibrary.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-6 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No Brand Memory files yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add logos, product shots, or mood references once, then pick
                    them here for any creative.
                  </p>
                  <button
                    onClick={() => void chooseReferenceAsset()}
                    className="mt-3 inline-flex h-8 items-center justify-center rounded-full bg-ember px-3 text-xs font-medium text-ember-foreground ember-glow"
                  >
                    Add files
                  </button>
                </div>
              ) : (
                <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1">
                  {referenceLibrary.map((ref) => {
                    const on = refs.includes(ref.id)
                    return (
                      <button
                        key={ref.id}
                        onClick={() =>
                          setRefs(
                            on
                              ? refs.filter((r) => r !== ref.id)
                              : [...refs, ref.id],
                          )
                        }
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                          on
                            ? "border-ember"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        <img
                          src={ref.url}
                          alt={ref.name}
                          className="size-full object-cover"
                        />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/90 to-transparent px-1.5 pt-3 pb-1 text-left text-[0.6rem] text-foreground">
                          {ref.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/45 px-3 text-xs font-medium transition-colors hover:bg-accent">
              <IconBook className="size-3.5" />
              Templates
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-1.5">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Prompt templates
              </p>
              <div className="max-h-72 space-y-0.5 overflow-auto">
                {prompt.trim().length >= 3 && (
                  <button
                    onClick={() => savePromptPreset("image", prompt)}
                    className="mb-1 flex w-full rounded-md px-2 py-2 text-left text-sm font-medium text-ember transition-colors hover:bg-accent"
                  >
                    Save as template
                  </button>
                )}
                {imagePrompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPrompt(p.body)
                      toast(`Loaded "${p.title}"`)
                    }}
                    className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <span className="text-sm">{p.title}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {p.body}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <button
          onClick={make}
          disabled={!canMake}
          className={cn(
            "group flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all sm:ml-auto",
            canMake
              ? "bg-ember text-ember-foreground ember-glow hover:brightness-105"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          Create
          <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}

function RatioSwatch({ ratio }: { ratio: BaseRatio }) {
  return (
    <span
      className="shrink-0 rounded-[3px] border border-current/55 text-foreground"
      style={{
        width:
          ratio.width >= ratio.height ? 14 : (14 * ratio.width) / ratio.height,
        height:
          ratio.height >= ratio.width ? 14 : (14 * ratio.height) / ratio.width,
      }}
    />
  )
}
