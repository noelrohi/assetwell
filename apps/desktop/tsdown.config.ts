import { defineConfig } from "tsdown"

const base = {
  outDir: "dist-electron",
  format: "cjs" as const,
  platform: "node" as const,
  target: "node20",
  deps: {
    alwaysBundle: ["@kreeyts/desktop-bridge"],
    neverBundle: ["electron"],
  },
  sourcemap: true,
  dts: false,
}

export default defineConfig([
  {
    ...base,
    name: "electron-main",
    entry: { main: "electron/main.ts" },
    clean: true,
  },
  {
    ...base,
    name: "electron-preload",
    entry: { preload: "electron/preload.ts" },
    clean: false,
  },
])
