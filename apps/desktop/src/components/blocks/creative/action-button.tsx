import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function ActionButton({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all",
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
