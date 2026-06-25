import type {
  HiggsfieldMediaKind,
  HiggsfieldModel,
} from "@assetwell/desktop-bridge"

import type { ModelOption } from "./types"

export function toModelOptions(
  models: HiggsfieldModel[],
  mediaKind: HiggsfieldMediaKind,
): ModelOption[] {
  const filtered = models.filter((model) => model.mediaKind === mediaKind)
  const normalized = filtered.length > 0 ? filtered : models

  return normalized.map((model) => ({
    id: model.id,
    label: model.label,
    hint: model.hint,
  }))
}
