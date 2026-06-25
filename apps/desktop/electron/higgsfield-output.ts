import type {
  HiggsfieldAccountStatus,
  HiggsfieldCommandResult,
  HiggsfieldGeneratedArtifact,
  HiggsfieldMediaKind,
  HiggsfieldModel,
  HiggsfieldModelDetails,
  HiggsfieldModelParam,
  HiggsfieldWorkspaceContext,
  HiggsfieldWorkspaceSummary,
} from "@assetwell/desktop-bridge"

interface RawModel {
  display_name?: unknown
  job_set_type?: unknown
  type?: unknown
}

interface RawModelParam {
  name?: unknown
  type?: unknown
  default?: unknown
  required?: unknown
  enum?: unknown
}

interface RawModelDetails extends RawModel {
  params?: unknown
}

interface RawAccount {
  email?: unknown
  credits?: unknown
  subscription_plan_type?: unknown
}

interface RawWorkspace {
  id?: unknown
  name?: unknown
  plan_type?: unknown
  credits?: unknown
  is_selected?: unknown
  user_role?: unknown
}

const URL_PATTERN = /https?:\/\/[^\s"'<>\\)]+/g
const LOCAL_PATH_PATTERN =
  /(?:^|\s)((?:\/|[A-Za-z]:\\)[^\n\r"'<>]+\.(?:png|jpe?g|webp|gif|mp4|mov|webm|m4v))/gi
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i
const VIDEO_EXTENSIONS = /\.(mp4|mov|webm|m4v)$/i

export function parseAccountStatus(
  stdout: string,
  checkedAt = new Date().toISOString(),
): HiggsfieldAccountStatus {
  const json = parseJson<RawAccount>(stdout)

  if (json && !Array.isArray(json)) {
    return {
      email: stringOrNull(json.email),
      credits: numberOrNull(json.credits),
      plan: stringOrNull(json.subscription_plan_type),
      checkedAt,
    }
  }

  const line = firstLine(stdout)
  const creditsMatch = line.match(/([-+]?\d+(?:\.\d+)?)\s+credits?\b/i)
  const planMatch = line.match(/—\s*([^,]+?)(?:\s+plan)?\s*,/i)

  return {
    email: line.match(/[^\s@]+@[^\s@]+/)?.[0] ?? null,
    credits: creditsMatch ? Number(creditsMatch[1]) : null,
    plan: planMatch?.[1]?.trim() ?? null,
    checkedAt,
  }
}

export function parseModelList(
  stdout: string,
  fallbackMediaKind: HiggsfieldMediaKind,
): HiggsfieldModel[] {
  const json = parseJson<RawModel[]>(stdout)

  if (Array.isArray(json)) {
    return json.flatMap((model) => {
      const id = stringOrNull(model.job_set_type)
      if (!id) return []
      const mediaKind = normalizeMediaKind(model.type, fallbackMediaKind)
      const label = stringOrNull(model.display_name) ?? titleFromId(id)

      return [
        {
          id,
          label,
          mediaKind,
          hint: `${mediaKind} model`,
        },
      ]
    })
  }

  return parseModelTable(stdout, fallbackMediaKind)
}

export function parseModelDetails(
  stdout: string,
  fallbackModel: string,
  fallbackMediaKind: HiggsfieldMediaKind,
): HiggsfieldModelDetails {
  const json = parseJson<RawModelDetails>(stdout)
  if (!json || Array.isArray(json)) {
    throw new Error("Could not read Higgsfield model details.")
  }

  const id = stringOrNull(json.job_set_type) ?? fallbackModel
  const mediaKind = normalizeMediaKind(json.type, fallbackMediaKind)
  const params = Array.isArray(json.params)
    ? json.params.flatMap(normalizeModelParam)
    : []
  const aspectRatios =
    params.find((param) => param.name === "aspect_ratio")?.enumValues ?? []

  return {
    id,
    label: stringOrNull(json.display_name) ?? titleFromId(id),
    mediaKind,
    params,
    aspectRatios: aspectRatios.filter((ratio) => ratio !== "auto"),
  }
}

export function parseWorkspaceContext(
  stdout: string,
  checkedAt = new Date().toISOString(),
): HiggsfieldWorkspaceContext {
  const json = parseJson<RawWorkspace[]>(stdout)
  const workspaces = Array.isArray(json)
    ? json.flatMap(normalizeWorkspace)
    : parseWorkspaceStatusText(stdout)

  return {
    selected: workspaces.find((workspace) => workspace.isSelected) ?? null,
    workspaces,
    checkedAt,
  }
}

export function parseGenerationResult(
  stdout: string,
  defaultMediaKind: HiggsfieldMediaKind,
): HiggsfieldCommandResult | null {
  const artifacts = dedupeArtifacts([
    ...artifactsFromJson(stdout, defaultMediaKind),
    ...artifactsFromText(stdout, defaultMediaKind),
  ])

  return artifacts.length > 0 ? { artifacts } : null
}

export function bestArtifactExtension(
  artifact: HiggsfieldGeneratedArtifact,
  fallbackMediaKind: HiggsfieldMediaKind,
) {
  const source = artifact.filePath ?? artifact.url ?? ""
  const extension = source.match(
    /\.(png|jpe?g|webp|gif|mp4|mov|webm|m4v)(?:[?#].*)?$/i,
  )
    ? `.${source.match(/\.(png|jpe?g|webp|gif|mp4|mov|webm|m4v)(?:[?#].*)?$/i)![1].toLowerCase()}`
    : null

  if (extension) {
    return extension === ".jpeg" ? ".jpg" : extension
  }

  return (artifact.mediaKind ?? fallbackMediaKind) === "video" ? ".mp4" : ".png"
}

function parseModelTable(
  stdout: string,
  fallbackMediaKind: HiggsfieldMediaKind,
): HiggsfieldModel[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !/^JOB SET TYPE\s+/i.test(line))
    .flatMap((line) => {
      const match = line.match(/^(\S+)\s{2,}(.+?)\s{2,}(\S+)$/)
      if (!match) return []
      const mediaKind = normalizeMediaKind(match[3], fallbackMediaKind)

      return [
        {
          id: match[1],
          label: match[2].trim(),
          mediaKind,
          hint: `${mediaKind} model`,
        },
      ]
    })
}

function normalizeModelParam(param: unknown): HiggsfieldModelParam[] {
  if (!param || typeof param !== "object") return []

  const raw = param as RawModelParam
  const name = stringOrNull(raw.name)
  if (!name) return []

  return [
    {
      name,
      type: stringOrNull(raw.type),
      required: raw.required === true,
      defaultValue: scalarOrNull(raw.default),
      enumValues: Array.isArray(raw.enum)
        ? raw.enum.flatMap((value) => {
            const text = stringOrNull(value)
            return text ? [text] : []
          })
        : [],
    },
  ]
}

function parseWorkspaceStatusText(
  stdout: string,
): HiggsfieldWorkspaceSummary[] {
  if (/no workspace selected/i.test(stdout)) return []
  return []
}

function normalizeWorkspace(
  workspace: RawWorkspace,
): HiggsfieldWorkspaceSummary[] {
  const id = stringOrNull(workspace.id)
  if (!id) return []

  return [
    {
      id,
      name: stringOrNull(workspace.name),
      plan: stringOrNull(workspace.plan_type),
      credits: numberOrNull(workspace.credits),
      isSelected: Boolean(workspace.is_selected),
      userRole: stringOrNull(workspace.user_role),
    },
  ]
}

function artifactsFromJson(
  stdout: string,
  defaultMediaKind: HiggsfieldMediaKind,
): HiggsfieldGeneratedArtifact[] {
  const json = parseJson<unknown>(stdout)
  if (!json) return []

  const artifacts: HiggsfieldGeneratedArtifact[] = []

  visitJson(json, (value, key) => {
    if (typeof value !== "string") return
    const mediaKind = inferMediaKind(value, defaultMediaKind)

    if (isUrl(value)) {
      artifacts.push({
        url: value,
        filePath: null,
        id: stringOrNull((key ?? "").match(/\bid\b/i) ? value : null),
        mediaKind,
      })
      return
    }

    if (isLocalArtifactPath(value)) {
      artifacts.push({
        url: null,
        filePath: value,
        id: null,
        mediaKind,
      })
    }
  })

  return artifacts
}

function artifactsFromText(
  stdout: string,
  defaultMediaKind: HiggsfieldMediaKind,
): HiggsfieldGeneratedArtifact[] {
  const artifacts: HiggsfieldGeneratedArtifact[] = []

  for (const match of stdout.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;:]+$/, "")
    artifacts.push({
      url,
      filePath: null,
      id: null,
      mediaKind: inferMediaKind(url, defaultMediaKind),
    })
  }

  for (const match of stdout.matchAll(LOCAL_PATH_PATTERN)) {
    const filePath = match[1].trim()
    artifacts.push({
      url: null,
      filePath,
      id: null,
      mediaKind: inferMediaKind(filePath, defaultMediaKind),
    })
  }

  return artifacts
}

function dedupeArtifacts(
  artifacts: HiggsfieldGeneratedArtifact[],
): HiggsfieldGeneratedArtifact[] {
  const seen = new Set<string>()
  const deduped: HiggsfieldGeneratedArtifact[] = []

  for (const artifact of artifacts) {
    const key = artifact.filePath ?? artifact.url ?? artifact.id
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(artifact)
  }

  return deduped
}

function visitJson(
  value: unknown,
  visit: (value: unknown, key?: string) => void,
  key?: string,
) {
  visit(value, key)

  if (Array.isArray(value)) {
    value.forEach((item) => visitJson(item, visit))
    return
  }

  if (!value || typeof value !== "object") return

  Object.entries(value).forEach(([childKey, childValue]) => {
    visitJson(childValue, visit, childKey)
  })
}

function normalizeMediaKind(
  value: unknown,
  fallback: HiggsfieldMediaKind,
): HiggsfieldMediaKind {
  if (
    value === "image" ||
    value === "video" ||
    value === "audio" ||
    value === "text"
  ) {
    return value
  }

  return fallback
}

function inferMediaKind(
  value: string,
  fallback: HiggsfieldMediaKind,
): HiggsfieldMediaKind {
  if (VIDEO_EXTENSIONS.test(value)) return "video"
  if (IMAGE_EXTENSIONS.test(value)) return "image"
  return fallback
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function firstLine(value: string) {
  return (
    value
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find(Boolean) ?? ""
  )
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scalarOrNull(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "boolean") return value
  return null
}

function titleFromId(id: string) {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function isLocalArtifactPath(value: string) {
  return (
    (/^\//.test(value) || /^[A-Za-z]:\\/.test(value)) &&
    (IMAGE_EXTENSIONS.test(value) || VIDEO_EXTENSIONS.test(value))
  )
}
