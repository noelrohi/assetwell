import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const requireFromHere = createRequire(import.meta.url)
const packageRoot = resolvePackageRoot()
const vendorBinary = path.join(
  packageRoot,
  "vendor",
  process.platform === "win32" ? "hf.exe" : "hf",
)
const installScript = path.join(packageRoot, "install.js")

if (!existsSync(installScript)) {
  throw new Error(
    "@higgsfield/cli is missing. Run `bun install` before building Assetwell.",
  )
}

if (!existsSync(vendorBinary)) {
  await run(process.execPath, [installScript], packageRoot)
}

function resolvePackageRoot() {
  try {
    return path.dirname(requireFromHere.resolve("@higgsfield/cli/package.json"))
  } catch {
    throw new Error(
      "@higgsfield/cli is missing. Run `bun install` before building Assetwell.",
    )
  }
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Failed to install Higgsfield CLI binary (${code}).`))
    })
  })
}
