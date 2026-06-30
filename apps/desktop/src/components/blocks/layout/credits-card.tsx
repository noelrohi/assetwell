import { IconDiamondFilled } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { useHiggsfieldApp } from "@/lib/higgsfield"

const UPGRADE_URL = "https://higgsfield.ai/pricing"

export function CreditsCard() {
  const { account, openOutput } = useHiggsfieldApp()

  const credits =
    account?.credits == null ? "…" : Number(account.credits.toFixed(1))
  const plan = account?.plan?.trim()

  return (
    <div className="no-drag rounded-xl border border-border/60 bg-card/40 p-3.5">
      <p className="flex items-baseline gap-1.5 tracking-tight">
        <span className="font-display text-2xl font-semibold tabular-nums leading-none">
          {credits}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          credits left
        </span>
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {plan ? (
          <span className="capitalize">{plan} plan</span>
        ) : (
          "Powered by your Higgsfield credits"
        )}
      </p>
      <Button
        className="mt-3 w-full"
        onClick={() => void openOutput(UPGRADE_URL)}
      >
        <IconDiamondFilled className="size-4" />
        Upgrade
      </Button>
    </div>
  )
}
