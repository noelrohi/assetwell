import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, "..")
const packageRoot = path.join(appRoot, "node_modules", "@higgsfield", "cli")
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
