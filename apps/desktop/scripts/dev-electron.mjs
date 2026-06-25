// Dev launcher for the Electron shell. Responsibilities:
//   1. Start Vite (renderer) and wait until the port is ready.
//   2. Run tsdown --watch to bundle main/preload into dist-electron/.
//   3. Spawn electron and point it at VITE_DEV_SERVER_URL.
//   4. Restart electron whenever main.cjs or preload.cjs change (no HMR for
//      the main process — Electron has to be killed and re-spawned).
//
// Ctrl-C kills all three children.

import { spawn, spawnSync } from "node:child_process"
import { once } from "node:events"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  watch,
  writeFileSync,
} from "node:fs"
import { setTimeout as delay } from "node:timers/promises"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"
import electronPath from "electron"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")
const DIST_ELECTRON = path.join(APP_ROOT, "dist-electron")
const DEFAULT_VITE_PORT = 1420
const APP_NAME = "Assetwell"
const DEV_APP_ID = "com.rohi.assetwell.dev"
const DEV_APP_BUNDLE = path.join(APP_ROOT, "release", "dev", `${APP_NAME}.app`)
const DEV_APP_ICON = path.join(APP_ROOT, "build", "icon.icns")
const DEV_APP_MARKER = path.join(
  DEV_APP_BUNDLE,
  "Contents",
  "Resources",
  ".kreeyts-dev-app.json",
)

const children = new Set()
let electronProc = null
let restartTimer = null
let viteUrl = ""
let electronBinary = electronPath

function log(scope, line) {
  for (const chunk of String(line).split(/[\r\n]+/)) {
    const text = chunk.trimEnd()
    if (!text.trim()) continue
    const alreadyPrefixed = text.startsWith(`[${scope}]`)
    process.stdout.write(alreadyPrefixed ? `${text}\n` : `[${scope}] ${text}\n`)
  }
}

function resolveElectronAppBundle() {
  if (process.platform !== "darwin") return null

  const marker = ".app/Contents/MacOS/"
  const markerIndex = electronPath.indexOf(marker)
  if (markerIndex === -1) return null

  return electronPath.slice(0, markerIndex + ".app".length)
}

function devElectronBinaryPath() {
  const sourceAppBundle = resolveElectronAppBundle()
  if (!sourceAppBundle) return electronPath

  return path.join(DEV_APP_BUNDLE, "Contents", "MacOS", APP_NAME)
}

function prepareDevElectronBinary() {
  const sourceAppBundle = resolveElectronAppBundle()
  if (!sourceAppBundle) return electronPath

  const targetBinary = devElectronBinaryPath()
  const fingerprint = devAppFingerprint(sourceAppBundle)
  if (isDevAppCurrent(targetBinary, fingerprint)) return targetBinary

  mkdirSync(path.dirname(DEV_APP_BUNDLE), { recursive: true })
  rmSync(DEV_APP_BUNDLE, { recursive: true, force: true })
  runRequired("ditto", [sourceAppBundle, DEV_APP_BUNDLE])

  const plistPath = path.join(DEV_APP_BUNDLE, "Contents", "Info.plist")
  plistSet(plistPath, "CFBundleName", APP_NAME)
  plistSet(plistPath, "CFBundleDisplayName", APP_NAME)
  plistSet(plistPath, "CFBundleExecutable", APP_NAME)
  plistSet(plistPath, "CFBundleIdentifier", DEV_APP_ID)
  plistSet(plistPath, "CFBundleIconFile", "icon.icns")

  const originalBinary = path.join(
    DEV_APP_BUNDLE,
    "Contents",
    "MacOS",
    path.basename(electronPath),
  )
  copyFileSync(originalBinary, targetBinary)
  chmodSync(targetBinary, 0o755)
  copyFileSync(
    DEV_APP_ICON,
    path.join(DEV_APP_BUNDLE, "Contents", "Resources", "icon.icns"),
  )

  writeFileSync(DEV_APP_MARKER, JSON.stringify(fingerprint, null, 2))
  runOptional("codesign", ["--force", "--deep", "--sign", "-", DEV_APP_BUNDLE])
  log("dev", `prepared ${APP_NAME}.app for macOS Dock title`)

  return targetBinary
}

function devAppFingerprint(sourceAppBundle) {
  const iconStat = statSync(DEV_APP_ICON)
  const packageJsonPath = path.join(
    path.dirname(path.dirname(sourceAppBundle)),
    "package.json",
  )
  const electronVersion = readJson(packageJsonPath)?.version ?? null

  return {
    appName: APP_NAME,
    appId: DEV_APP_ID,
    electronPath,
    electronVersion,
    iconSize: iconStat.size,
    iconMtimeMs: iconStat.mtimeMs,
  }
}

function isDevAppCurrent(targetBinary, fingerprint) {
  if (!existsSync(targetBinary) || !existsSync(DEV_APP_MARKER)) return false

  try {
    const current = JSON.parse(readFileSync(DEV_APP_MARKER, "utf8"))
    return JSON.stringify(current) === JSON.stringify(fingerprint)
  } catch {
    return false
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch {
    return null
  }
}

function plistSet(plistPath, key, value) {
  const setResult = spawnSync("/usr/libexec/PlistBuddy", [
    "-c",
    `Set :${key} ${value}`,
    plistPath,
  ])
  if (setResult.status === 0) return

  runRequired("/usr/libexec/PlistBuddy", [
    "-c",
    `Add :${key} string ${value}`,
    plistPath,
  ])
}

function runRequired(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" })
  if (result.status === 0) return

  const stderr = result.stderr?.trim()
  throw new Error(
    `${command} ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`,
  )
}

function runOptional(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" })
  if (result.status !== 0) {
    log("dev", `${command} failed; continuing with unsigned dev app`)
  }
}

function track(child, scope) {
  children.add(child)
  child.stdout?.on("data", (buf) => log(scope, buf))
  child.stderr?.on("data", (buf) => log(scope, buf))
  child.on("error", (err) => log(scope, `failed to spawn: ${err.message}`))
  child.on("exit", () => children.delete(child))
  return child
}

async function isHostPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host })
    socket.once("connect", () => {
      socket.end()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })
}

async function isPortOpen(port) {
  for (const host of ["127.0.0.1", "::1", "localhost"]) {
    if (await isHostPortOpen(port, host)) return true
  }
  return false
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 100; port++) {
    if (!(await isPortOpen(port))) return port
  }
  throw new Error(`No open Vite port found in ${startPort}-${startPort + 99}`)
}

async function waitForPort(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await isPortOpen(port)
    if (ok) return
    await delay(200)
  }
  throw new Error(`Vite did not open port ${port} within ${timeoutMs}ms`)
}

function spawnElectron() {
  if (electronProc) {
    electronProc.removeAllListeners("exit")
    electronProc.kill()
  }
  const electronArgs = [path.join(DIST_ELECTRON, "main.cjs")]
  const remoteDebuggingPort = process.env.ELECTRON_REMOTE_DEBUGGING_PORT
  if (remoteDebuggingPort) {
    electronArgs.push(`--remote-debugging-port=${remoteDebuggingPort}`)
  }

  electronProc = track(
    spawn(electronBinary, electronArgs, {
      cwd: APP_ROOT,
      env: { ...process.env, VITE_DEV_SERVER_URL: viteUrl },
      stdio: ["ignore", "pipe", "pipe"],
    }),
    "electron",
  )
  electronProc.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGKILL") return
    if (code && code !== 0) {
      log("electron", `exited with code ${code}`)
      shutdown(code)
      return
    }
    if (code === 0 || code == null) {
      shutdown(0)
    }
  })
}

function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = setTimeout(() => {
    log("watch", "dist-electron changed — restarting electron")
    spawnElectron()
  }, 150)
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  electronBinary = dryRun ? devElectronBinaryPath() : prepareDevElectronBinary()

  const requestedPort = Number(process.env.VITE_PORT || DEFAULT_VITE_PORT)
  const preferredPort = Number.isFinite(requestedPort)
    ? requestedPort
    : DEFAULT_VITE_PORT
  const vitePort = await findOpenPort(preferredPort)
  viteUrl = `http://localhost:${vitePort}`

  const childEnv = {
    ...process.env,
    VITE_PORT: String(vitePort),
    VITE_DEV_SERVER_URL: viteUrl,
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          appRoot: APP_ROOT,
          distElectron: DIST_ELECTRON,
          viteUrl,
          commands: {
            vite: "bun run dev:renderer",
            electronBundle: "bunx tsdown --watch",
            electron: `${devElectronBinaryPath()} ${path.join(DIST_ELECTRON, "main.cjs")}`,
          },
          env: {
            VITE_PORT: childEnv.VITE_PORT,
            VITE_DEV_SERVER_URL: childEnv.VITE_DEV_SERVER_URL,
          },
        },
        null,
        2,
      ),
    )
    return
  }

  if (vitePort !== preferredPort) {
    log("dev", `port ${preferredPort} is busy; using ${vitePort}`)
  }

  // 1. Vite dev server.
  const vite = track(
    spawn("bun", ["run", "dev:renderer"], {
      cwd: APP_ROOT,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    }),
    "vite",
  )

  // 2. tsdown --watch builds main/preload continuously.
  const bundler = track(
    spawn("bunx", ["tsdown", "--watch"], {
      cwd: APP_ROOT,
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
    }),
    "tsdown",
  )

  // Wait for Vite AND the first tsdown build before spawning electron.
  // tsdown prints "Build complete" on each pass; we just poll for main.cjs.
  await waitForPort(vitePort)
  await waitForFile(path.join(DIST_ELECTRON, "main.cjs"))
  await waitForFile(path.join(DIST_ELECTRON, "preload.cjs"))

  spawnElectron()

  // 3. Watch the bundler output for changes.
  watch(DIST_ELECTRON, { persistent: true }, (_event, filename) => {
    if (!filename) return
    if (filename === "main.cjs" || filename === "preload.cjs") scheduleRestart()
  })

  await Promise.race([once(vite, "exit"), once(bundler, "exit")])
  shutdown(1)
}

async function waitForFile(filePath, timeoutMs = 30_000) {
  const fs = await import("node:fs/promises")
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fs.access(filePath)
      return
    } catch {
      await delay(100)
    }
  }
  throw new Error(`tsdown did not produce ${filePath} within ${timeoutMs}ms`)
}

function shutdown(code) {
  for (const child of children) {
    try {
      child.kill()
    } catch {}
  }
  process.exit(code)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

main().catch((err) => {
  console.error(err)
  shutdown(1)
})
