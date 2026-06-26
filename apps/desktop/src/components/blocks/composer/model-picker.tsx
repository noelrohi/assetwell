import * as React from "react"
import {
  IconCheck,
  IconSelector,
  IconSparkles,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type ModelOption = { id: string; label: string; hint: string | null }

export type ModelRecommendation = {
  key: string
  match: string | string[]
}

const MODEL_FAVOURITES_STORAGE_KEY = "assetwell.model-favourites.v1"

function normalizeModelSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function matchesRecommendation(model: ModelOption, match: string | string[]) {
  const modelValue = normalizeModelSearchValue(`${model.id} ${model.label}`)
  const values = Array.isArray(match) ? match : [match]

  return values.some((value) =>
    modelValue.includes(normalizeModelSearchValue(value)),
  )
}

export function pickDefaultModelId(
  models: ModelOption[],
  preferred: string | string[],
): string {
  const match = models.find((model) => matchesRecommendation(model, preferred))
  return match?.id ?? models[0]?.id ?? ""
}

function readFavouriteModelIds() {
  if (typeof window === "undefined") return []
  try {
    const value = window.localStorage.getItem(MODEL_FAVOURITES_STORAGE_KEY)
    const parsed: unknown = value ? JSON.parse(value) : []
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}

function writeFavouriteModelIds(ids: string[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MODEL_FAVOURITES_STORAGE_KEY, JSON.stringify(ids))
}

export function ModelPicker({
  models,
  value,
  onChange,
  recommendations = [],
}: {
  models: ModelOption[]
  value: string
  onChange: (id: string) => void
  recommendations?: ModelRecommendation[]
}) {
  const [open, setOpen] = React.useState(false)
  const [favouriteIds, setFavouriteIds] = React.useState<string[]>(() =>
    readFavouriteModelIds(),
  )
  const selected = models.find((model) => model.id === value)
  const favouriteSet = React.useMemo(
    () => new Set(favouriteIds),
    [favouriteIds],
  )
  const favouriteModels = models.filter((model) => favouriteSet.has(model.id))
  const recommendedModels = recommendations.flatMap((recommendation) => {
    const model = models.find((item) =>
      matchesRecommendation(item, recommendation.match),
    )
    return model ? [model] : []
  })
  const recommendedSet = React.useMemo(
    () => new Set(recommendedModels.map((model) => model.id)),
    [recommendedModels],
  )
  const visibleRecommendedModels = recommendedModels.filter(
    (model, index, array) =>
      !favouriteSet.has(model.id) &&
      array.findIndex((item) => item.id === model.id) === index,
  )
  const otherModels = models.filter(
    (model) => !favouriteSet.has(model.id) && !recommendedSet.has(model.id),
  )
  const selectedIsFavourite = selected ? favouriteSet.has(selected.id) : false

  function toggleFavourite(modelId: string) {
    setFavouriteIds((current) => {
      const next = current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId]
      writeFavouriteModelIds(next)
      return next
    })
  }

  function renderModelItem(model: ModelOption) {
    const active = model.id === value
    const favourite = favouriteSet.has(model.id)
    const FavouriteIcon = favourite ? IconStarFilled : IconStar

    return (
      <CommandItem
        key={model.id}
        value={`${model.label} ${model.hint ?? ""}`}
        onSelect={() => {
          onChange(model.id)
          setOpen(false)
        }}
        className="items-start gap-2.5 py-2 pr-2"
      >
        <IconSparkles
          className={cn(
            "mt-0.5 size-3.5 shrink-0",
            active ? "!text-ember" : "text-muted-foreground",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-foreground">{model.label}</span>
          {model.hint && (
            <span className="truncate text-xs text-muted-foreground">
              {model.hint}
            </span>
          )}
        </span>
        {active && (
          <IconCheck className="mt-0.5 size-3.5 shrink-0 !text-ember" />
        )}
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleFavourite(model.id)
          }}
          className={cn(
            "mt-0.5 grid size-5 shrink-0 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground",
            favourite && "text-ember hover:text-ember",
          )}
          aria-label={favourite ? "Remove favourite" : "Add favourite"}
          title={favourite ? "Remove favourite" : "Add favourite"}
        >
          <FavouriteIcon className="size-3.5" />
        </button>
      </CommandItem>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-8 max-w-[15rem] items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 text-xs font-medium transition-colors hover:bg-accent data-[state=open]:bg-accent">
        <IconSparkles className="size-3.5 shrink-0 text-ember" />
        <span className="truncate">{selected?.label ?? "Select model"}</span>
        {selectedIsFavourite && (
          <IconStarFilled className="size-3.5 shrink-0 text-ember" />
        )}
        <IconSelector className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            {favouriteModels.length > 0 && (
              <CommandGroup heading="Favourites">
                {favouriteModels.map(renderModelItem)}
              </CommandGroup>
            )}
            {visibleRecommendedModels.length > 0 && (
              <CommandGroup heading="Recommended">
                {visibleRecommendedModels.map(renderModelItem)}
              </CommandGroup>
            )}
            {otherModels.length > 0 && (
              <CommandGroup
                heading={
                  favouriteModels.length > 0 ||
                  visibleRecommendedModels.length > 0
                    ? "All models"
                    : undefined
                }
              >
                {otherModels.map(renderModelItem)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
