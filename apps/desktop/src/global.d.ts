import type { DesktopBridge } from "@assetwell/desktop-bridge"

declare global {
  interface Window {
    assetwell?: DesktopBridge
  }
}

export {}
