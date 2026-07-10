import type {
  HiggsfieldMediaKind,
  HiggsfieldModel,
} from "@assetwell/desktop-bridge"

import type { ModelOption } from "./types"

const hardcodedNewModelIds: Record<HiggsfieldMediaKind, Set<string>> = {
  image: new Set(["seedream_v5_pro"]),
  video: new Set(),
  audio: new Set(),
  text: new Set(),
}

export function toModelOptions(
  models: HiggsfieldModel[],
  mediaKind: HiggsfieldMediaKind,
): ModelOption[] {
  const filtered = models.filter((model) => model.mediaKind === mediaKind)
  const normalized = filtered.length > 0 ? filtered : models

  return normalized
    .map((model) => {
      const badges = modelBadges(model)

      return {
        id: model.id,
        label: model.label,
        hint: model.hint,
        ...(badges.length ? { badges } : {}),
      }
    })
    .sort(
      (left, right) => Number(hasNewBadge(right)) - Number(hasNewBadge(left)),
    )
}

function modelBadges(model: HiggsfieldModel) {
  const badges = [...(model.badges ?? [])]
  if (hardcodedNewModelIds[model.mediaKind]?.has(model.id)) {
    badges.push("new")
  }

  return badges.filter(
    (badge, index, array) =>
      array.findIndex(
        (candidate) => candidate.toLowerCase() === badge.toLowerCase(),
      ) === index,
  )
}

function hasNewBadge(model: ModelOption) {
  return model.badges?.some((badge) => badge.toLowerCase() === "new") ?? false
}
