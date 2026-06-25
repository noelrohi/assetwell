import type { JobStatus } from "@/lib/higgsfield"
import { cn } from "@/lib/utils"

export function StatusPill({ status }: { status: JobStatus }) {
  const map = {
    ready: { c: "text-success", t: "Ready" },
    pending: { c: "text-ember", t: "Generating" },
    failed: { c: "text-destructive", t: "Failed" },
  } as const
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", map[status].c)}>
      <span className="size-1.5 rounded-full bg-current" />
      {map[status].t}
    </span>
  )
}
