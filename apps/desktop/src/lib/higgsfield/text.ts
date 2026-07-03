import type { HiggsfieldCommandOutputEvent } from "@assetwell/desktop-bridge"

const FALLBACK_ERROR =
  "Higgsfield could not finish that request. Try again in a moment."

export function friendlyError(error: unknown) {
  if (error instanceof Error) {
    return cleanErrorMessage(error.message) ?? FALLBACK_ERROR
  }

  return FALLBACK_ERROR
}

function cleanErrorMessage(message: string) {
  let cleaned = message.trim()
  if (!cleaned) return null

  cleaned = cleaned.replace(
    /^Error invoking remote method ['"][^'"]+['"]:\s*/i,
    "",
  )

  while (/^Error:\s*/i.test(cleaned)) {
    cleaned = cleaned.replace(/^Error:\s*/i, "").trim()
  }

  return cleaned || null
}

export function friendlyExit(event: HiggsfieldCommandOutputEvent) {
  if (event.signal) return "Generation was stopped."
  if (event.exitCode === 0) {
    return "Higgsfield finished without returning an output."
  }
  return "Higgsfield could not generate this output."
}

export function titleFromPrompt(prompt: string) {
  const trimmed = prompt.trim().replace(/\s+/g, " ")
  if (trimmed.length <= 42) return trimmed
  return `${trimmed.slice(0, 42).trim()}...`
}

export function slug(value: string) {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

  return safe || "creative"
}
