import * as React from "react"

import { AssetwellAppIcon } from "@/components/blocks/branding/assetwell-app-icon"
import { Button } from "@/components/ui/button"
import { useHiggsfieldApp } from "@/lib/higgsfield"
import {
  isHiggsfieldLaunchResolved,
  shouldShowHiggsfieldSignIn,
} from "@/lib/higgsfield/session-readiness"

const MIN_AUTH_SPLASH_MS = 550
const SLOW_AUTH_MESSAGE_MS = 8_000

export function AppAuthGate({ children }: { children: React.ReactNode }) {
  const { cliStatus, refreshSession, signIn } = useHiggsfieldApp()
  const hasDesktopHiggsfield = hasDesktopHiggsfieldBridge()
  const [minimumElapsed, setMinimumElapsed] =
    React.useState(!hasDesktopHiggsfield)
  const [showSlowMessage, setShowSlowMessage] = React.useState(false)

  React.useEffect(() => {
    if (!hasDesktopHiggsfield) {
      setMinimumElapsed(true)
      setShowSlowMessage(false)
      return
    }

    const minimumTimer = window.setTimeout(
      () => setMinimumElapsed(true),
      MIN_AUTH_SPLASH_MS,
    )
    const slowTimer = window.setTimeout(
      () => setShowSlowMessage(true),
      SLOW_AUTH_MESSAGE_MS,
    )

    return () => {
      window.clearTimeout(minimumTimer)
      window.clearTimeout(slowTimer)
    }
  }, [hasDesktopHiggsfield])

  const authReady =
    !hasDesktopHiggsfield || isHiggsfieldLaunchResolved(cliStatus)

  React.useEffect(() => {
    if (
      !hasDesktopHiggsfield ||
      !cliStatus ||
      isHiggsfieldLaunchResolved(cliStatus)
    ) {
      return
    }

    const retryTimer = window.setTimeout(() => {
      void refreshSession()
    }, 3_000)

    return () => window.clearTimeout(retryTimer)
  }, [cliStatus, hasDesktopHiggsfield, refreshSession])

  if (!authReady || !minimumElapsed) {
    return <AppBlockingSplash showSlowMessage={showSlowMessage} />
  }

  if (shouldShowHiggsfieldSignIn(cliStatus)) {
    return (
      <HiggsfieldSignInScreen
        unavailable={cliStatus?.installed === false}
        onSignIn={() => void signIn()}
      />
    )
  }

  return children
}

function AppBlockingSplash({ showSlowMessage }: { showSlowMessage: boolean }) {
  return (
    <AuthFrame>
      <div className="flex min-w-64 flex-col items-center gap-4 px-6 text-center">
        <div className="assetwell-auth-orb grid size-16 place-items-center rounded-[1.35rem] bg-card/25 ring-1 ring-white/10 backdrop-blur-sm">
          <AssetwellAppIcon className="size-14 shadow-2xl shadow-black/45" />
        </div>
        {showSlowMessage ? (
          <p className="text-xs text-muted-foreground">
            Still connecting to Higgsfield…
          </p>
        ) : null}
      </div>
    </AuthFrame>
  )
}

function HiggsfieldSignInScreen({
  unavailable,
  onSignIn,
}: {
  unavailable: boolean
  onSignIn: () => void
}) {
  return (
    <AuthFrame>
      <div className="w-full max-w-md px-6 text-center">
        <div className="rounded-[2rem] border border-border/80 bg-card/70 p-8 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <AssetwellAppIcon className="mx-auto size-14 shadow-2xl shadow-black/45" />
          <p className="mt-6 font-display text-3xl text-balance">
            Connect Higgsfield
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Sign in once, then Assetwell will open directly to Create and use
            your Higgsfield account, models, and credits behind the scenes.
          </p>
          {unavailable ? (
            <p className="mt-4 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Higgsfield is not available in this build. Reinstall Assetwell or
              contact support.
            </p>
          ) : null}
          <Button
            type="button"
            onClick={onSignIn}
            disabled={unavailable}
            className="mt-6 h-10 rounded-full bg-ember px-5 text-sm font-medium text-ember-foreground ember-glow transition-[filter,transform,box-shadow] duration-150 ease-out hover:bg-ember hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            Sign in to Higgsfield
          </Button>
        </div>
      </div>
    </AuthFrame>
  )
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid h-dvh place-items-center overflow-hidden bg-background text-foreground">
      <div className="drag fixed inset-x-0 top-0 z-20 h-11" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_oklab,var(--ember)_16%,transparent),transparent_44%),radial-gradient(ellipse_at_50%_110%,oklch(0.1_0.006_60_/_0.9),transparent_54%)]"
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function hasDesktopHiggsfieldBridge() {
  return typeof window !== "undefined" && Boolean(window.assetwell?.higgsfield)
}
