import type { HiggsfieldCliStatus } from "@assetwell/desktop-bridge"

export function isHiggsfieldSessionReady(
  cliStatus: HiggsfieldCliStatus | null | undefined,
) {
  return (
    cliStatus?.installed === true &&
    cliStatus.authStatus === "authenticated" &&
    cliStatus.workspaceStatus === "verified"
  )
}

export function shouldShowHiggsfieldSignIn(
  cliStatus: HiggsfieldCliStatus | null | undefined,
) {
  return (
    cliStatus?.installed === false ||
    cliStatus?.authStatus === "unauthenticated"
  )
}

export function isHiggsfieldLaunchResolved(
  cliStatus: HiggsfieldCliStatus | null | undefined,
) {
  return (
    shouldShowHiggsfieldSignIn(cliStatus) || isHiggsfieldSessionReady(cliStatus)
  )
}
