import * as React from "react"
import { IconMovie, IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react"
import type { AssetwellPromptKind } from "@assetwell/desktop-bridge"
import { useQueryState } from "nuqs"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { type PromptPreset, useHiggsfieldApp } from "@/lib/higgsfield"
import { promptFilterParser, promptFilterValues } from "@/lib/query-state"
import { cn } from "@/lib/utils"

export function PromptTemplatesPage() {
  const { imagePrompts, videoPrompts, savePromptPreset, deletePromptPreset } =
    useHiggsfieldApp()
  const [filter, setFilter] = useQueryState("filter", promptFilterParser)
  const [kind, setKind] = React.useState<AssetwellPromptKind>("image")
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")

  const templates = React.useMemo(() => {
    return [...imagePrompts, ...videoPrompts]
      .filter((prompt) => filter === "all" || prompt.kind === filter)
      .sort((a, b) => {
        const aCustom = a.createdAt !== "shipped"
        const bCustom = b.createdAt !== "shipped"
        if (aCustom !== bCustom) return aCustom ? -1 : 1
        return promptDate(b) - promptDate(a) || a.title.localeCompare(b.title)
      })
  }, [filter, imagePrompts, videoPrompts])

  const canSave = body.trim().length >= 3

  function saveTemplate() {
    if (!canSave) return
    savePromptPreset(kind, body, title)
    setTitle("")
    setBody("")
  }

  return (
    <div className="mx-auto max-w-6xl px-6 pt-12 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div className="max-w-xl">
          <h1 className="font-display text-2xl tracking-tight text-balance">
            Prompt templates
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground text-pretty">
            Reusable prompt starters that show up in the Templates picker inside
            each composer.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border/70 p-1">
          {promptFilterValues.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => void setFilter(item)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium capitalize transition-colors",
                filter === item
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-8 border-t border-border/60 pt-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <form
          className="h-fit space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            saveTemplate()
          }}
        >
          <div className="flex gap-2">
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as AssetwellPromptKind)}
            >
              <SelectTrigger className="w-32 bg-card/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title (optional)"
              className="bg-card/50"
            />
          </div>

          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Describe the reusable prompt…"
            className="min-h-44 resize-y bg-card/50 text-sm leading-6"
          />

          <Button type="submit" disabled={!canSave} className="w-full">
            <IconPlus />
            Save template
          </Button>
        </form>

        <div>
          <p className="text-sm text-muted-foreground">
            {templates.length} template{templates.length === 1 ? "" : "s"}
          </p>

          {templates.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
              No templates yet. Save your first reusable prompt on the left.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onDelete={() => {
                    if (window.confirm(`Delete "${template.title}"?`)) {
                      deletePromptPreset(template.id)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  onDelete,
}: {
  template: PromptPreset
  onDelete: () => void
}) {
  const custom = template.createdAt !== "shipped"
  const Icon = template.kind === "image" ? IconPhoto : IconMovie

  return (
    <article className="group rounded-2xl border border-border/60 bg-card/40 p-4 transition-colors hover:bg-card/70">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {template.title}
        </h3>
        {custom ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            aria-label={`Delete ${template.title}`}
          >
            <IconTrash className="size-4" />
          </button>
        ) : (
          <span className="text-[0.65rem] font-medium text-muted-foreground">
            shipped
          </span>
        )}
      </div>
      <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">
        {template.body}
      </p>
    </article>
  )
}

function promptDate(prompt: PromptPreset) {
  if (prompt.createdAt === "shipped") return 0
  const timestamp = Date.parse(prompt.createdAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}
