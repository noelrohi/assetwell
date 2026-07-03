import type {
  HiggsfieldAccountStatus,
  HiggsfieldCommandResult,
  HiggsfieldGeneratedArtifact,
  HiggsfieldMediaKind,
  HiggsfieldUploadedAsset,
  HiggsfieldUploadListResult,
  HiggsfieldUploadMediaKind,
  HiggsfieldModel,
  HiggsfieldModelDetails,
  HiggsfieldModelParam,
  HiggsfieldWorkspaceContext,
  HiggsfieldWorkspaceSummary,
} from "@assetwell/desktop-bridge"

interface RawModel {
  display_name?: unknown
  job_set_type?: unknown
  job_type?: unknown
  type?: unknown
  badges?: unknown
  labels?: unknown
  is_new?: unknown
  isNew?: unknown
  new?: unknown
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

interface RawUpload {
  id?: unknown
  upload_id?: unknown
  uploadId?: unknown
  name?: unknown
  file_name?: unknown
  fileName?: unknown
  filename?: unknown
  original_name?: unknown
  originalName?: unknown
  original_filename?: unknown
  originalFilename?: unknown
  type?: unknown
  media_kind?: unknown
  mediaKind?: unknown
  url?: unknown
  created_at?: unknown
  createdAt?: unknown
  size?: unknown
  size_bytes?: unknown
  sizeBytes?: unknown
}

interface RawUploadList {
  items?: unknown
  uploads?: unknown
  data?: unknown
  cursor?: unknown
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
      const id = rawModelId(model)
      if (!id) return []
      const mediaKind = normalizeMediaKind(model.type, fallbackMediaKind)
      const label = stringOrNull(model.display_name) ?? titleFromId(id)
      const badges = rawModelBadges(model)

      return [
        {
          id,
          label,
          mediaKind,
          hint: null,
          ...(badges.length ? { badges } : {}),
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

  const id = rawModelId(json) ?? fallbackModel
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

export function parseUploadList(
  stdout: string,
  fallbackMediaKind: HiggsfieldUploadMediaKind = "image",
  checkedAt = new Date().toISOString(),
): HiggsfieldUploadListResult {
  const json = parseJson<unknown>(stdout)
  if (!json) {
    throw new Error("Could not read Higgsfield uploads.")
  }

  const items = rawUploadListItems(json).flatMap((item) =>
    normalizeUpload(item, fallbackMediaKind),
  )
  const cursor =
    json && !Array.isArray(json) && typeof json === "object"
      ? stringOrNull((json as RawUploadList).cursor)
      : null

  return {
    items,
    cursor,
    checkedAt,
  }
}

export function parseUpload(
  stdout: string,
  fallbackMediaKind: HiggsfieldUploadMediaKind = "image",
): HiggsfieldUploadedAsset {
  const json = parseJson<unknown>(stdout)
  const item = json ? rawUploadItem(json) : null
  const asset = item ? normalizeUpload(item, fallbackMediaKind)[0] : null

  if (!asset) {
    throw new Error("Could not read the uploaded Higgsfield asset.")
  }

  return asset
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

export function isoOrNull(value: unknown) {
  if (typeof value === "string") {
    const text = value.trim()
    if (!text) return null
    if (isIsoLikeString(text)) return text
    const timestamp = Number(text)
    return timestampToIso(timestamp)
  }

  if (typeof value === "number") return timestampToIso(value)
  return null
}

function timestampToIso(value: number) {
  if (!Number.isFinite(value)) return null

  const milliseconds = Math.abs(value) > 1e12 ? value : value * 1000
  const date = new Date(milliseconds)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function isIsoLikeString(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
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
          hint: null,
        },
      ]
    })
}

function rawModelId(model: RawModel) {
  return stringOrNull(model.job_set_type) ?? stringOrNull(model.job_type)
}

function rawModelBadges(model: RawModel) {
  const badges = [
    ...(isTruthyFlag(model.is_new) ||
    isTruthyFlag(model.isNew) ||
    isTruthyFlag(model.new)
      ? ["new"]
      : []),
    ...stringList(model.badges),
    ...stringList(model.labels),
  ]

  return badges
    .map((badge) => badge.trim())
    .filter(Boolean)
    .filter(
      (badge, index, array) =>
        array.findIndex(
          (candidate) => candidate.toLowerCase() === badge.toLowerCase(),
        ) === index,
    )
}

function stringList(value: unknown) {
  if (typeof value === "string") return [value]
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = stringOrNull(item)
    return text ? [text] : []
  })
}

function isTruthyFlag(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true"
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

function rawUploadListItems(json: unknown): unknown[] {
  if (Array.isArray(json)) return json
  if (!json || typeof json !== "object") return []

  const record = json as RawUploadList
  if (Array.isArray(record.items)) return record.items
  if (Array.isArray(record.uploads)) return record.uploads
  if (Array.isArray(record.data)) return record.data
  return []
}

function rawUploadItem(json: unknown): unknown | null {
  const listed = rawUploadListItems(json)[0]
  if (listed) return listed
  if (!json || typeof json !== "object") return null

  const record = json as {
    item?: unknown
    upload?: unknown
    asset?: unknown
    data?: unknown
  }
  for (const value of [record.item, record.upload, record.asset, record.data]) {
    if (looksLikeUpload(value)) return value
  }

  return looksLikeUpload(json) ? json : null
}

function looksLikeUpload(value: unknown) {
  if (!value || typeof value !== "object") return false
  const upload = value as RawUpload
  return Boolean(
    stringOrNull(upload.id) ??
    stringOrNull(upload.upload_id) ??
    stringOrNull(upload.uploadId),
  )
}

function normalizeUpload(
  value: unknown,
  fallbackMediaKind: HiggsfieldUploadMediaKind,
): HiggsfieldUploadedAsset[] {
  if (!value || typeof value !== "object") return []

  const upload = value as RawUpload
  const uploadId =
    stringOrNull(upload.id) ??
    stringOrNull(upload.upload_id) ??
    stringOrNull(upload.uploadId)
  const url = stringOrNull(upload.url)
  if (!uploadId || !url) return []

  const createdAt = isoOrNull(upload.created_at) ?? isoOrNull(upload.createdAt)
  const sizeBytes =
    numberOrNull(upload.size_bytes) ??
    numberOrNull(upload.sizeBytes) ??
    numberOrNull(upload.size)

  return [
    {
      id: uploadId,
      uploadId,
      name: uploadName(upload, uploadId, url),
      url,
      mediaKind: normalizeUploadMediaKind(
        upload.type ?? upload.media_kind ?? upload.mediaKind,
        fallbackMediaKind,
      ),
      createdAt,
      sizeBytes,
    },
  ]
}

function uploadName(upload: RawUpload, uploadId: string, url: string) {
  return (
    uploadNameFromJson(upload) ??
    uploadNameFromUrl(url, uploadId) ??
    uploadDisplayName(uploadId)
  )
}

function uploadNameFromJson(upload: RawUpload) {
  for (const value of [
    upload.name,
    upload.file_name,
    upload.fileName,
    upload.filename,
    upload.original_name,
    upload.originalName,
    upload.original_filename,
    upload.originalFilename,
  ]) {
    const name = uploadNameValue(value)
    if (name) return name
  }

  return null
}

function uploadNameFromUrl(url: string, uploadId: string) {
  try {
    const pathname = new URL(url).pathname
    const rawName = pathname.split("/").filter(Boolean).pop()
    const name = uploadNameValue(
      rawName ? safeDecodeURIComponent(rawName) : null,
    )

    if (
      !name ||
      !(IMAGE_EXTENSIONS.test(name) || VIDEO_EXTENSIONS.test(name))
    ) {
      return null
    }

    const nameWithoutExtension = name.replace(
      /\.(png|jpe?g|webp|gif|mp4|mov|webm|m4v)$/i,
      "",
    )
    if (nameWithoutExtension.toLowerCase() === uploadId.toLowerCase()) {
      return null
    }

    return name
  } catch {
    return null
  }
}

function uploadNameValue(value: unknown) {
  return (
    stringOrNull(value)
      ?.replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .pop()
      ?.trim() ?? null
  )
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function uploadDisplayName(uploadId: string) {
  return `Upload ${uploadId.slice(0, 8)}`
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

function normalizeUploadMediaKind(
  value: unknown,
  fallback: HiggsfieldUploadMediaKind,
): HiggsfieldUploadMediaKind {
  const mediaKind = normalizeMediaKind(value, fallback)
  return mediaKind === "text" ? fallback : mediaKind
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
