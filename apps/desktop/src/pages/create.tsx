import * as React from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  IconArrowRight,
  IconBook,
  IconChevronDown,
  IconPaperclip,
  IconPlus,
  IconSparkles,
  IconWand,
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
import { CreativeCard } from "@/components/creative-card"
import { cn } from "@/lib/utils"
import { aspectOf, baseRatios } from "@/lib/placements"
import {
  imagePromptLibrary,
  useHiggsfieldApp,
} from "@/lib/higgsfield"

function Composer() {
  const navigate = useNavigate()
  const {
    imageModels,
    referenceLibrary,
    chooseReferenceAsset,
    makeCreative,
  } = useHiggsfieldApp()
  const [prompt, setPrompt] = React.useState("")
  const [ratioId, setRatioId] = React.useState<string>(baseRatios[0].id)
  const [model, setModel] = React.useState(imageModels[0]?.id ?? "")
  const [refs, setRefs] = React.useState<string[]>([])

  const ratio = baseRatios.find((r) => r.id === ratioId)!
  const canMake = prompt.trim().length > 0 && model.length > 0

  React.useEffect(() => {
    if (!model && imageModels[0]) setModel(imageModels[0].id)
    if (model && !imageModels.some((item) => item.id === model)) {
      setModel(imageModels[0]?.id ?? "")
    }
  }, [imageModels, model])

  async function make() {
    if (!canMake) return
    const creativeId = await makeCreative({
      prompt,
      ratioId,
      ratioW: ratio.width,
      ratioH: ratio.height,
      model,
      referenceIds: refs,
    })
    if (!creativeId) return

    toast("Queued 4 takes", {
      description: `${ratio.label} · ${imageModels.find((m) => m.id === model)?.label ?? model}`,
    })
    setPrompt("")
    setRefs([])
    navigate({ to: "/creative/$creativeId", params: { creativeId } })
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-colors focus-within:border-border">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) make()
        }}
        placeholder="Describe the creative you want to make…"
        className="min-h-[104px] resize-none rounded-2xl border-0 bg-transparent px-5 pt-5 text-base leading-relaxed shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:bg-transparent"
      />

      {refs.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 pb-1">
          {refs.map((id) => {
            const ref = referenceLibrary.find((r) => r.id === id)!
            return (
              <span
                key={id}
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 py-1 pr-2 pl-1 text-xs"
              >
                <img
                  src={ref.url}
                  alt={ref.name}
                  className="size-5 rounded-full object-cover"
                />
                {ref.name}
                <button
                  onClick={() => setRefs(refs.filter((r) => r !== id))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 px-3 py-2.5">
        {/* aspect ratio */}
        <Select value={ratioId} onValueChange={setRatioId}>
          <SelectTrigger className="h-8 gap-1.5 rounded-full border-border/70 bg-background/50 px-3 text-xs font-medium data-[size=default]:h-8">
            <span
              className="rounded-[3px] border border-foreground/50"
              style={{
                width: ratio.width >= ratio.height ? 14 : (14 * ratio.width) / ratio.height,
                height: ratio.height >= ratio.width ? 14 : (14 * ratio.height) / ratio.width,
              }}
            />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {baseRatios.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <span className="font-mono text-xs">{r.id}</span>
                <span className="text-muted-foreground">{r.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* model */}
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="h-8 gap-1.5 rounded-full border-border/70 bg-background/50 px-3 text-xs font-medium data-[size=default]:h-8">
            <IconSparkles className="size-3.5 text-ember" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-64">
            {imageModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex flex-col">
                  <span>{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.hint}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* reference library */}
        <Popover>
          <PopoverTrigger
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 text-xs font-medium transition-colors hover:bg-accent",
              refs.length > 0 && "border-ember/40 text-ember",
            )}
          >
            <IconPaperclip className="size-3.5" />
            {refs.length > 0 ? `${refs.length} reference${refs.length > 1 ? "s" : ""}` : "Reference"}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
              Reference library
            </p>
            <div className="grid grid-cols-3 gap-2">
              {referenceLibrary.map((ref) => {
                const on = refs.includes(ref.id)
                return (
                  <button
                    key={ref.id}
                    onClick={() =>
                      setRefs(on ? refs.filter((r) => r !== ref.id) : [...refs, ref.id])
                    }
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-lg border-2 transition-all",
                      on ? "border-ember" : "border-transparent hover:border-border",
                    )}
                  >
                    <img src={ref.url} alt={ref.name} className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/90 to-transparent px-1.5 pt-3 pb-1 text-left text-[0.6rem] text-foreground">
                      {ref.name}
                    </span>
                  </button>
                )
              })}
              <button
                onClick={() => void chooseReferenceAsset()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                <IconPlus className="size-4" />
                <span className="text-[0.6rem]">Upload</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* prompt library */}
        <Popover>
          <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 text-xs font-medium transition-colors hover:bg-accent">
            <IconBook className="size-3.5" />
            Prompts
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-1.5">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Prompt library
            </p>
            <div className="max-h-72 space-y-0.5 overflow-auto">
              {imagePromptLibrary.map((p) => (
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

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-[0.65rem] text-muted-foreground sm:inline">
            ×4 takes
          </span>
          <button
            onClick={make}
            disabled={!canMake}
            className={cn(
              "group flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
              canMake
                ? "bg-ember text-ember-foreground hover:brightness-105 ember-glow"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            Make creative
            <IconArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function FeaturedDemo() {
  const navigate = useNavigate()
  const { demoCreative } = useHiggsfieldApp()
  const c = demoCreative
  const minis = c.placements.filter((p) => p.status === "ready").slice(0, 5)

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/60 to-card/20">
      <div className="grid gap-0 md:grid-cols-[300px_1fr]">
        <Link
          to="/creative/$creativeId"
          params={{ creativeId: c.id }}
          className="group relative aspect-square overflow-hidden border-border/60 md:border-r"
        >
          <img
            src={c.heroUrl}
            alt={c.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute top-3 left-3 rounded-full border border-ember/40 bg-background/70 px-2 py-0.5 font-mono text-[0.6rem] tracking-[0.2em] text-ember uppercase backdrop-blur-sm">
            demo
          </span>
        </Link>

        <div className="flex flex-col justify-between gap-5 p-6">
          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
              Start here
            </p>
            <h2 className="mt-2 font-display text-2xl leading-tight text-balance">
              {c.title}
            </h2>
            <p className="mt-2 line-clamp-2 max-w-xl text-sm text-muted-foreground">
              {c.prompt}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {minis.map((p) => (
              <div
                key={p.size}
                className="overflow-hidden rounded-md border border-border/60 bg-muted/40"
                style={{
                  height: 34,
                  aspectRatio: aspectOf(
                    Number(p.size.split("x")[0]),
                    Number(p.size.split("x")[1]),
                  ),
                }}
              >
                <img src={p.url} alt={p.size} className="size-full object-cover" />
              </div>
            ))}
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              +{c.placements.length - minis.length} more sizes · 1 video
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate({ to: "/creative/$creativeId", params: { creativeId: c.id } })}
              className="flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background/50 px-4 text-sm transition-colors hover:bg-accent"
            >
              Explore the example
            </button>
            <button
              onClick={() => toast("Demo prompt loaded into the composer")}
              className="flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-ember transition-colors hover:bg-ember/10"
            >
              <IconWand className="size-4" />
              Remix this
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CreatePage() {
  const { creatives } = useHiggsfieldApp()
  const rest = creatives.filter((c) => !c.isDemo)

  return (
    <div className="mx-auto max-w-6xl px-8 pt-10 pb-24">
      <div className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both">
        <p className="font-mono text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
          New creative
        </p>
        <h1 className="mt-1.5 font-display text-3xl tracking-tight">
          What are we making today?
        </h1>
      </div>

      <div className="mt-6">
        <Composer />
      </div>

      <div className="mt-10">
        <FeaturedDemo />
      </div>

      <div className="mt-12 flex items-baseline justify-between">
        <h2 className="font-display text-xl">Your creatives</h2>
        <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <IconChevronDown className="size-3.5" />
          recent first
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {rest.map((c, i) => (
          <CreativeCard key={c.id} creative={c} index={i} />
        ))}
      </div>
    </div>
  )
}
