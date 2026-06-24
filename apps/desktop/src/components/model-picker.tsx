import * as React from "react"
import { IconCheck, IconSelector, IconSparkles } from "@tabler/icons-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"

export type ModelOption = { id: string; label: string; hint: string | null }

export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelOption[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selected = models.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex h-8 max-w-[15rem] items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 text-xs font-medium transition-colors hover:bg-accent data-[state=open]:bg-accent">
        <IconSparkles className="size-3.5 shrink-0 text-ember" />
        <span className="truncate">{selected?.label ?? "Select model"}</span>
        <IconSelector className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            <CommandGroup>
              {models.map((m) => {
                const active = m.id === value
                return (
                  <CommandItem
                    key={m.id}
                    value={`${m.label} ${m.hint ?? ""}`}
                    onSelect={() => {
                      onChange(m.id)
                      setOpen(false)
                    }}
                    className="items-start gap-2.5 py-2"
                  >
                    <IconSparkles
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        active ? "!text-ember" : "text-muted-foreground",
                      )}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-foreground">
                        {m.label}
                      </span>
                      {m.hint && (
                        <span className="truncate text-xs text-muted-foreground">
                          {m.hint}
                        </span>
                      )}
                    </span>
                    {active && (
                      <IconCheck className="mt-0.5 ml-auto size-3.5 shrink-0 !text-ember" />
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
