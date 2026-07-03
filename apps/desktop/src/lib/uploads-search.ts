import type { Brand, ReferenceAsset, UploadFolder } from "./higgsfield/types"

export interface UploadSearchIndexItem {
  asset: ReferenceAsset
  searchText: string
}

export function buildUploadSearchIndex(
  references: ReferenceAsset[],
  brands: Brand[],
  folders: UploadFolder[],
): UploadSearchIndexItem[] {
  const brandNames = new Map(brands.map((brand) => [brand.id, brand.name]))
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]))

  return references.map((asset) => ({
    asset,
    searchText: normalizeSearchText([
      asset.name,
      asset.uploadId,
      asset.createdAt,
      asset.modifiedAt,
      brandSearchLabel(asset.brandId, brandNames),
      folderSearchLabel(asset.folderId, folderNames),
    ]),
  }))
}

export function filterUploadSearchIndex(
  index: UploadSearchIndexItem[],
  rawQuery: string,
): ReferenceAsset[] {
  const query = normalizeSearchQuery(rawQuery)
  if (!query) return index.map((item) => item.asset)

  return index
    .filter((item) => item.searchText.includes(query))
    .map((item) => item.asset)
}

function brandSearchLabel(
  brandId: string | null | undefined,
  brandNames: ReadonlyMap<string, string>,
) {
  if (!brandId) return "Unsorted"
  return brandNames.get(brandId) ?? null
}

function folderSearchLabel(
  folderId: string | null | undefined,
  folderNames: ReadonlyMap<string, string>,
) {
  if (!folderId) return null
  return folderNames.get(folderId) ?? null
}

function normalizeSearchQuery(value: string) {
  return value.trim().toLowerCase()
}

function normalizeSearchText(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").toLowerCase()
}
