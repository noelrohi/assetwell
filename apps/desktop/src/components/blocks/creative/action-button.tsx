import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function ActionButton({
  children,
  onClick,
  primary,
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all",
        disabled
          ? "cursor-not-allowed bg-muted text-muted-foreground"
          : primary
            ? "bg-ember text-ember-foreground ember-glow hover:brightness-105"
            : "border border-border/70 bg-background/50 hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}
