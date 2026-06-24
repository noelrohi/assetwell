import type { DesktopBridge } from "@kreeyts/desktop-bridge"

declare global {
  interface Window {
    kreeyts?: DesktopBridge
  }
}

export {}
