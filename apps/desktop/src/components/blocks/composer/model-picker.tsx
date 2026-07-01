import * as React from "react"
import {
  IconCheck,
  IconSelector,
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

export type ModelOption = {
  id: string
  label: string
  hint: string | null
  badges?: string[]
}

export type ModelRecommendation = {
  key: string
  match: string | string[]
  exclude?: string | string[]
}

const MODEL_FAVOURITES_STORAGE_KEY = "assetwell.model-favourites.v1"

function normalizeModelSearchValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function includesAny(modelValue: string, terms: string | string[]) {
  const values = Array.isArray(terms) ? terms : [terms]
  return values.some((value) =>
    modelValue.includes(normalizeModelSearchValue(value)),
  )
}

function matchesRecommendation(
  model: ModelOption,
  match: string | string[],
  exclude?: string | string[],
) {
  const modelValue = normalizeModelSearchValue(`${model.id} ${model.label}`)
  if (!includesAny(modelValue, match)) return false
  return exclude ? !includesAny(modelValue, exclude) : true
}

export function pickDefaultModelId(
  models: ModelOption[],
  preferred: string | string[],
  exclude?: string | string[],
): string {
  const match = models.find((model) =>
    matchesRecommendation(model, preferred, exclude),
  )
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

function ModelBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-ember/25 bg-ember/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-ember">
      {children}
    </span>
  )
}

function hasNewBadge(model: ModelOption) {
  return model.badges?.some((badge) => badge.toLowerCase() === "new") ?? false
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
  const newModels = React.useMemo(() => models.filter(hasNewBadge), [models])
  const newSet = React.useMemo(
    () => new Set(newModels.map((model) => model.id)),
    [newModels],
  )
  const favouriteModels = models.filter(
    (model) => favouriteSet.has(model.id) && !newSet.has(model.id),
  )
  const recommendedModels = recommendations.flatMap((recommendation) => {
    const model = models.find((item) =>
      matchesRecommendation(item, recommendation.match, recommendation.exclude),
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
      !newSet.has(model.id) &&
      array.findIndex((item) => item.id === model.id) === index,
  )
  const otherModels = models.filter(
    (model) =>
      !newSet.has(model.id) &&
      !favouriteSet.has(model.id) &&
      !recommendedSet.has(model.id),
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
        value={`${model.label} ${model.hint ?? ""} ${model.badges?.join(" ") ?? ""}`}
        onSelect={() => {
          onChange(model.id)
          setOpen(false)
        }}
        className="items-start gap-2.5 py-2 pr-2"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-foreground">{model.label}</span>
            {model.badges?.map((badge) => (
              <ModelBadge key={badge}>{badge}</ModelBadge>
            ))}
          </span>
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
      <PopoverTrigger className="flex h-8 max-w-[15rem] items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors hover:bg-accent data-[state=open]:bg-accent">
        <span className="truncate">{selected?.label ?? "Select model"}</span>
        {selected?.badges?.slice(0, 2).map((badge) => (
          <ModelBadge key={badge}>{badge}</ModelBadge>
        ))}
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
            {newModels.length > 0 && (
              <CommandGroup heading="New">
                {newModels.map(renderModelItem)}
              </CommandGroup>
            )}
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
                  newModels.length > 0 ||
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
