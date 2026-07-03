import * as React from "react"
import type { HiggsfieldCliStatus } from "@assetwell/desktop-bridge"

import { isHiggsfieldSessionReady } from "./session-readiness"

const SIGN_IN_REFRESH_DELAY_MS = 1_000
const SIGN_IN_REFRESH_INTERVAL_MS = 3_000
const SIGN_IN_POLL_TIMEOUT_MS = 120_000

export function useHiggsfieldSignInAttempt({
  cliStatus,
  refreshSession,
}: {
  cliStatus: HiggsfieldCliStatus | null
  refreshSession: () => Promise<void>
}) {
  const [startedAt, setStartedAt] = React.useState<number | null>(null)

  const start = React.useCallback(() => {
    setStartedAt(Date.now())
  }, [])

  const clear = React.useCallback(() => {
    setStartedAt(null)
  }, [])

  React.useEffect(() => {
    if (startedAt === null) return

    const refresh = () => {
      void refreshSession().catch(() => undefined)
    }

    const firstRefresh = window.setTimeout(refresh, SIGN_IN_REFRESH_DELAY_MS)
    const refreshInterval = window.setInterval(
      refresh,
      SIGN_IN_REFRESH_INTERVAL_MS,
    )
    const expiry = window.setTimeout(clear, SIGN_IN_POLL_TIMEOUT_MS)

    return () => {
      window.clearTimeout(firstRefresh)
      window.clearInterval(refreshInterval)
      window.clearTimeout(expiry)
    }
  }, [clear, refreshSession, startedAt])

  React.useEffect(() => {
    if (isHiggsfieldSessionReady(cliStatus)) {
      clear()
    }
  }, [clear, cliStatus])

  return {
    startSignInAttempt: start,
    clearSignInAttempt: clear,
  }
}
