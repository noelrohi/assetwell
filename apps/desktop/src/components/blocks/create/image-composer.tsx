import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  IconArrowRight,
  IconBook,
  IconPaperclip,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { ModelPicker } from "@/components/blocks/composer/model-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { imagePromptLibrary, useHiggsfieldApp } from "@/lib/higgsfield"
import { baseRatios } from "@/lib/placements"
import { cn } from "@/lib/utils"

export function ImageComposer() {
  const navigate = useNavigate()
  const { imageModels, referenceLibrary, chooseReferenceAsset, makeCreative } =
    useHiggsfieldApp()
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
          <Select value={ratioId} onValueChange={setRatioId}>
            <SelectTrigger className="h-8 gap-1.5 rounded-full border-border/70 bg-background/45 px-3 text-xs font-medium data-[size=default]:h-8">
              <span
                className="rounded-[3px] border border-foreground/50"
                style={{
                  width:
                    ratio.width >= ratio.height
                      ? 14
                      : (14 * ratio.width) / ratio.height,
                  height:
                    ratio.height >= ratio.width
                      ? 14
                      : (14 * ratio.height) / ratio.width,
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

          <ModelPicker models={imageModels} value={model} onChange={setModel} />

          <Popover>
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

          <Popover>
            <PopoverTrigger className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background/45 px-3 text-xs font-medium transition-colors hover:bg-accent">
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
