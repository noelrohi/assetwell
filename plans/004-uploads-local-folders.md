# Plan 004: Add local folders to the Uploads page (drill-in UI over the Higgsfield upload library)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8bbec1a..HEAD -- apps/desktop/src/lib/higgsfield.tsx apps/desktop/src/pages/uploads.tsx apps/desktop/electron packages/desktop-bridge/src`
> This plan was written against commit `8bbec1a` **plus uncommitted sign-in
> polling changes in `apps/desktop/src/lib/higgsfield.tsx`**, so line numbers
> for that file may be offset by roughly ±60 lines — verify every excerpt by
> content, not line number. If an excerpt's content no longer exists, treat it
> as a STOP condition.

## Status

- **Priority**: P1 (feature requested directly by the maintainer)
- **Effort**: L
- **Risk**: MED (many layers touched, but strictly additive — no existing behavior changes)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8bbec1a`, 2026-07-03

## Why this matters

The Uploads page currently organizes the shared Higgsfield upload library only
by **brand** — a local metadata overlay (`uploadId → brandId`) on top of
uploads that Higgsfield itself stores flat. The maintainer wants a second,
finer-grained grouping: **folders**. Like brands, folders are purely local
Assetwell metadata; Higgsfield remains the storage owner and provides no
folders/tags of its own. After this plan lands, the user can create folders,
move uploads into them, and browse the Uploads page Drive-style (folder tiles
→ drill in → breadcrumb back), while every existing flow — brand filtering,
search, generation reference pickers — behaves exactly as before.

**Two design decisions were made by the advisor (maintainer was asked but
unavailable; these are the recommended defaults — see STOP conditions):**

1. **Folders are global and flat** — one folder list for the whole app,
   independent of brands. An upload can have a brand AND a folder; the page
   intersects the active brand filter with the open folder. No nesting.
2. **Drill-in UI** — folder tiles above the grid at the root; clicking opens
   the folder with a breadcrumb back. Not a second filter-chip row.

## Current state

### The brand overlay is the exemplar — folders mirror it at every layer

| Layer            | Brand implementation (copy this pattern)                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bridge types     | `packages/desktop-bridge/src/types.ts:99-136` — `AssetwellBrand`, `AssetwellBrandAssignment`, `AssetwellBrandState`, request types; re-exported from `packages/desktop-bridge/src/index.ts` |
| Bridge interface | `packages/desktop-bridge/src/types.ts:484-496` — `library.loadBrandState/setActiveBrand/createBrand/updateBrand/assignUploadsToBrand`                                                       |
| Electron store   | `apps/desktop/electron/brand-store.ts` — the whole file; persists `brands.v1.json` via `stateDirectory()` / `readJsonFileSync` / `writeJsonFile` from `./settings-store`                    |
| Re-export        | `apps/desktop/electron/local-store.ts:31-37` — `export { … } from "./brand-store"`                                                                                                          |
| Channels         | `apps/desktop/electron/shared/channels.ts:31-35` — `"assetwell:library:load-brand-state"` etc.                                                                                              |
| IPC handlers     | `apps/desktop/electron/ipc/library.ts:63-93` — thin `ipcMain.handle` wrappers                                                                                                               |
| Preload          | `apps/desktop/electron/preload.ts:73-82` — thin `ipcRenderer.invoke` wrappers                                                                                                               |
| Store tests      | `apps/desktop/electron/local-store.test.ts:251` — `test("stores Assetwell brand metadata and upload assignments locally", …)`                                                               |
| Renderer domain  | `apps/desktop/src/lib/higgsfield/types.ts:112-125` — `BrandsDomain`; exposed as `brands` on `HiggsfieldAppValue` (line 155)                                                                 |
| Renderer merge   | `apps/desktop/src/lib/higgsfield.tsx` — `applyUploadBrandAssignments` + `isReferenceInBrandView` (see excerpt below)                                                                        |
| UI               | `apps/desktop/src/pages/uploads.tsx` — brand chips, selection toolbar with "Move to" dropdown                                                                                               |

### Load-bearing excerpts

**Assignment key.** Brand assignments key on `uploadId ?? id`. Folder
assignments MUST use the same key or remote uploads won't match:

```ts
// apps/desktop/src/lib/higgsfield.tsx (~line 1063, working tree)
function applyUploadBrandAssignments(
  references: ReferenceAsset[],
  assignments: AssetwellBrandState["assignments"],
  brandIds: ReadonlySet<string>,
) {
  const assignmentMap = new Map(
    assignments.map((assignment) => [assignment.uploadId, assignment.brandId]),
  )

  return references.map((reference) => {
    const assignedBrandId = assignmentMap.get(
      reference.uploadId ?? reference.id,
    )
    const brandId =
      assignedBrandId && brandIds.has(assignedBrandId) ? assignedBrandId : null

    return { ...reference, brandId }
  })
}
```

**Where merged references flow.** In `HiggsfieldProvider`
(`apps/desktop/src/lib/higgsfield.tsx`, ~lines 505-560 working tree), remote
and local reference lists are passed through `applyUploadBrandAssignments`,
then filtered by brand view, and the winner becomes
`appUploads.references` → `activeReferenceLibrary`:

```ts
const assignedRemoteUploadReferences = React.useMemo(
  () =>
    applyUploadBrandAssignments(
      remoteUploadReferences,
      brandState.assignments,
      brandIds,
    ),
  [brandIds, brandState.assignments, remoteUploadReferences],
)
// …activeRemoteUploadReferences / assignedLocalReferences /
// activeLocalReferences follow, then:
const activeUploadReferences = hasRemoteUploads
  ? activeRemoteUploadReferences
  : activeLocalReferences
```

`activeReferenceLibrary` feeds the generation actions
(`useHiggsfieldGenerationActions({ …, referenceLibrary: activeReferenceLibrary, … })`).
**Folders must NOT filter this list** — the open folder is page-level
navigation, not app-level scope. Folder assignments are _merged_ in the
provider (so cards can show/search them) but _filtering by open folder happens
only in `pages/uploads.tsx`_.

**Persisted reference shape** (`packages/desktop-bridge/src/types.ts:310-322`)
already carries the brand overlay result; add `folderId` beside it:

```ts
export interface AssetwellPersistedReferenceAsset {
  id: string
  name: string
  url: string
  filePath?: string
  uploadId?: string
  // …
  brandId?: string | null
}
```

**Brand store file format** (`apps/desktop/electron/brand-store.ts:147-162`)
— folders persist the same way, to `upload-folders.v1.json`:

```ts
async function writeBrandStateFile(state: AssetwellBrandState) {
  await writeJsonFile(brandStatePath(), {
    schemaVersion: BRAND_STATE_SCHEMA_VERSION,
    brands: state.brands.map((brand) => ({ id: brand.id, name: brand.name })),
    activeBrandView: state.activeBrandView,
    activeBrandId: state.activeBrandId,
    assignments: state.assignments.map((assignment) => ({
      uploadId: assignment.uploadId,
      brandId: assignment.brandId,
    })),
    updatedAt: new Date().toISOString(),
  })
}
```

Note two deliberate differences from brands:

- **No active-folder persistence.** Brands persist `activeBrandView`/`activeBrandId`
  host-side; the open folder is a URL query param (`nuqs`) in the renderer only.
  The folder state file holds only `folders` + `assignments`.
- **Folders can be deleted** (brands cannot — `deleteWorkspace: async () => false`).
  Deleting a folder drops its assignments; uploads fall back to the root.

**Uploads page** (`apps/desktop/src/pages/uploads.tsx`): brand chips
(`BrandFilters`, line 252), selection toolbar with "Move to" brand dropdown
(lines 152-197), card grid (lines 224-234), search via
`buildUploadSearchIndex(referenceLibrary, brands.brands)` from
`apps/desktop/src/lib/uploads-search.ts`, query state via `nuqs`
(`uploadsSearchParser` in `apps/desktop/src/lib/query-state.ts:10`,
`parseAsString.withDefault("")`).

**Create/rename dialog exemplar**: `BrandFormDialog` in
`apps/desktop/src/components/blocks/layout/workspace-switcher.tsx:173-250`
(shadcn `Dialog` + `Input`, submit calls `brands.createBrand(name)` /
`brands.updateBrand`). Model the folder dialog on it.

### Documented vocabulary this plan must honor

From `CONTEXT.md`:

> **Assetwell Brand**: the visible organization layer for the small team's
> brands. Brand metadata is local Assetwell state that scopes Uploads views
> and creative/video outputs without changing Higgsfield storage.
>
> **Higgsfield Uploads Library**: shared image uploads in the default
> Higgsfield workspace … Higgsfield does not provide folders/tags here;
> Assetwell overlays `uploadId -> brandId` metadata so uploads can appear
> under real brands or `Unsorted`.

Name the new concept **Upload Folder** (`AssetwellUploadFolder`). User-facing
copy says "folder"; never show CLI/workspace/raw-ID language in the UI
(`CLAUDE.md` rule).

## Commands you will need

| Purpose             | Command                                              | Expected on success                    |
| ------------------- | ---------------------------------------------------- | -------------------------------------- |
| Install             | `bun install`                                        | exit 0                                 |
| Format check        | `bun run fmt:check`                                  | exit 0                                 |
| All tests           | `bun run test`                                       | exit 0, all pass                       |
| One test file       | `bun test apps/desktop/electron/local-store.test.ts` | all pass                               |
| Typecheck (desktop) | `bun --filter @assetwell/desktop typecheck`          | exit 0                                 |
| Typecheck (all)     | `bun run typecheck`                                  | exit 0                                 |
| Lint                | `bun run lint`                                       | exit 0 (depends on `build`; not cheap) |
| Build               | `bun run build`                                      | exit 0                                 |

Run the full verification order from `CLAUDE.md` at the end:
`fmt:check` → `test` → `typecheck` → `lint` → `build`.

## Scope

**In scope** (the only files you should modify or create):

- `packages/desktop-bridge/src/types.ts`, `packages/desktop-bridge/src/index.ts`
- `apps/desktop/electron/upload-folder-store.ts` (create)
- `apps/desktop/electron/local-store.ts` (re-export block only)
- `apps/desktop/electron/local-store.test.ts` (add tests)
- `apps/desktop/electron/shared/channels.ts` (+ `channels.test.ts` if it asserts the channel list)
- `apps/desktop/electron/ipc/library.ts`
- `apps/desktop/electron/preload.ts` (+ `preload.test.ts` if it asserts bridge shape)
- `apps/desktop/src/lib/upload-folders.ts` (create), `apps/desktop/src/lib/upload-folders.test.ts` (create)
- `apps/desktop/src/lib/higgsfield/types.ts`
- `apps/desktop/src/lib/higgsfield.tsx` (minimal wiring only — see Step 5)
- `apps/desktop/src/lib/uploads-search.ts` (+ its test file if present)
- `apps/desktop/src/pages/uploads.tsx`
- `CONTEXT.md` (one-line vocabulary addition)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `apps/desktop/src/lib/uploads-library.ts` — the legacy local-files workspace
  layer; folders sit above it, not inside it.
- `apps/desktop/electron/uploads-store.ts`, `brand-store.ts`,
  `library-snapshot-store.ts` — no changes to existing stores or snapshot schema.
- Generation flows (`generation-actions.ts`, `image-composer.tsx`,
  `create.tsx`, `video.tsx`) — folders must not change what
  `activeReferenceLibrary` contains.
- Anything under `apps/desktop/src/lib/higgsfield.tsx` beyond the wiring in
  Step 5 — the file has uncommitted sign-in changes; keep your diff surgical.
- The Higgsfield CLI wrapper (`higgsfield-cli.ts`) — folders never touch the CLI.

## Git workflow

- Branch: `feat/uploads-folders` off `master`. **The working tree has
  uncommitted changes** (sign-in polling in `higgsfield.tsx` and
  `session-readiness.*`); do not commit, revert, or stash them — leave them in
  place and keep your commits scoped to this plan's files.
- Conventional commits, matching `git log` style: `feat(desktop): …`,
  `test(desktop): …`, `docs(desktop): …`. Commit per step.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the folder contract to the desktop bridge

In `packages/desktop-bridge/src/types.ts`, next to the brand types (~line 99):

```ts
export interface AssetwellUploadFolder {
  id: string
  name: string
}

export interface AssetwellUploadFolderAssignment {
  uploadId: string
  folderId: string | null
}

export interface AssetwellUploadFolderState {
  folders: AssetwellUploadFolder[]
  assignments: AssetwellUploadFolderAssignment[]
}

export interface AssetwellCreateUploadFolderRequest {
  name: string
}

export interface AssetwellUpdateUploadFolderRequest {
  id: string
  name: string
}

export interface AssetwellDeleteUploadFolderRequest {
  id: string
}

export interface AssetwellAssignUploadsToFolderRequest {
  uploadIds: string[]
  folderId: string | null
}
```

Add `folderId?: string | null` to `AssetwellPersistedReferenceAsset`
(directly under `brandId`). Add five methods to `DesktopBridge["library"]`
(after `assignUploadsToBrand`):

```ts
loadUploadFolderState(): Promise<AssetwellUploadFolderState>
createUploadFolder(
  request: AssetwellCreateUploadFolderRequest,
): Promise<AssetwellUploadFolderState>
updateUploadFolder(
  request: AssetwellUpdateUploadFolderRequest,
): Promise<AssetwellUploadFolderState>
deleteUploadFolder(
  request: AssetwellDeleteUploadFolderRequest,
): Promise<AssetwellUploadFolderState>
assignUploadsToFolder(
  request: AssetwellAssignUploadsToFolderRequest,
): Promise<AssetwellUploadFolderState>
```

Re-export every new type from `packages/desktop-bridge/src/index.ts`
alphabetically, matching how the `AssetwellBrand*` types are listed.

**Verify**: `bun run typecheck` → fails ONLY in `apps/desktop/electron/preload.ts`
(the preload object no longer satisfies `DesktopBridge`). That confirms the
contract landed; Steps 2–3 fix it. If it fails anywhere else, stop and fix
before proceeding.

### Step 2: Create the Electron folder store

Create `apps/desktop/electron/upload-folder-store.ts` modeled line-for-line on
`apps/desktop/electron/brand-store.ts` (same imports from `./settings-store`,
same normalization discipline). Differences from the brand store:

- File: `upload-folders.v1.json` in `stateDirectory()`; `schemaVersion: 1`.
- Stored shape: `{ schemaVersion, folders: [{ id, name }], assignments: [{ uploadId, folderId }], updatedAt }` — no active-view fields.
- No default folder — an empty folder list is valid.
- IDs: slug `folder-<name-slug>` via the same slugging/dedupe logic as
  `brandIdFromName`/`dedupeBrandId` (`brand-store.ts:332-372`); reuse the same
  `isSafeBrandId`-style validation (copy it as `isSafeFolderId` — the helpers
  are module-private, so duplicate rather than export from `brand-store.ts`).
- Names: reuse the brand rules — trimmed, control chars stripped, ≤80 chars,
  unique case-insensitively (`assertUniqueBrandName` pattern). Error copy:
  `"Folder name is required."`, `"A folder with that name already exists."`,
  `"Unknown folder."`.
- Exported functions: `loadUploadFolderState`, `createUploadFolder`,
  `updateUploadFolder`, `deleteUploadFolder`, `assignUploadsToFolder` — each
  reads the file, normalizes, mutates, writes, and returns the full state
  (mirror `assignUploadsToBrand`, `brand-store.ts:109-136`, including the
  Map-based dedupe of assignments and `uniqueUploadIds`).
- `deleteUploadFolder`: throw `"Unknown folder."` if absent; otherwise remove
  the folder and **every assignment pointing at it**, then write.
- Normalization drops assignments whose `folderId` no longer exists (mirror
  `storedAssignment`, `brand-store.ts:243-258`, but drop the entry instead of
  keeping it with `null` — a null folder assignment means the same as no entry,
  so keeping them would grow the file forever).

Re-export all five functions from `apps/desktop/electron/local-store.ts`,
matching the `brand-store` block at lines 31-37.

Add a test in `apps/desktop/electron/local-store.test.ts` modeled on
`"stores Assetwell brand metadata and upload assignments locally"` (line 251 —
read it first for the temp-dir setup it uses). Cover: create → returned id is
slugged and unique; rename; duplicate-name rejection; assign two uploads →
returned assignments match; reassign one upload to `null` → entry removed;
delete folder → folder gone and its assignments gone; reload from disk
round-trips.

**Verify**: `bun test apps/desktop/electron/local-store.test.ts` → all pass,
including the new folder tests.

### Step 3: Wire channels, IPC handlers, and preload

1. `apps/desktop/electron/shared/channels.ts` — add to `library`:

```ts
loadUploadFolderState: "assetwell:library:load-upload-folder-state",
createUploadFolder: "assetwell:library:create-upload-folder",
updateUploadFolder: "assetwell:library:update-upload-folder",
deleteUploadFolder: "assetwell:library:delete-upload-folder",
assignUploadsToFolder: "assetwell:library:assign-uploads-to-folder",
```

If `channels.test.ts` asserts the channel list or naming pattern, update it to
include the new channels.

2. `apps/desktop/electron/ipc/library.ts` — import the five functions from
   `../local-store` and register five handlers matching the
   `assignUploadsToBrand` wrapper shape (lines 88-93). No `ownerWindow` needed.

3. `apps/desktop/electron/preload.ts` — add the five `ipcRenderer.invoke`
   wrappers to the `library` object, matching lines 73-82. If `preload.test.ts`
   asserts the bridge surface, extend it.

**Verify**: `bun run typecheck` → exit 0 (the Step 1 preload error is gone).
`bun run test` → all pass.

### Step 4: Renderer folder domain — pure helpers plus hook, in a new module

Create `apps/desktop/src/lib/upload-folders.ts`. Keep folder logic OUT of
`higgsfield.tsx` (it is already ~1300 lines).

Pure helpers (exported, unit-tested):

```ts
export function applyUploadFolderAssignments(
  references: ReferenceAsset[],
  assignments: AssetwellUploadFolderAssignment[],
  folderIds: ReadonlySet<string>,
): ReferenceAsset[]
// Same shape as applyUploadBrandAssignments (excerpt in "Current state"):
// key on `reference.uploadId ?? reference.id`, drop unknown folder ids to
// null, return { ...reference, folderId }.

export function referencesInFolder(
  references: ReferenceAsset[],
  folderId: string | null,
): ReferenceAsset[]
// folderId null → references with no folder (root view).

export function countReferencesByFolder(
  references: ReferenceAsset[],
): ReadonlyMap<string, number>
```

Hook `useUploadFolders(libraryBridge?: LibraryBridge)` returning the domain
object below. Follow the structure of `useUploadsLibrary`
(`apps/desktop/src/lib/uploads-library.ts`) — `React.useCallback` per action,
toast on failure via `friendlyError` from `./higgsfield/text`, boolean
returns. Load state once on mount when `libraryBridge` exists (self-contained
`React.useEffect`, ignore failure with a toast); with no bridge, manage the
state in memory so the browser/dev fallback still works (mirror the
`!libraryBridge` branches in `saveUploadBrandAssignments`,
`higgsfield.tsx:308-349`). Toast copy: `"Created <name>"`,
`"Folder renamed"`, `"Deleted <name>"`, moves use
`"Moved N upload(s) to <name>"` / `"Moved N upload(s) out of folders"`,
failures `"Could not create folder"` etc.

Add `UploadFoldersDomain` to `apps/desktop/src/lib/higgsfield/types.ts` next
to `BrandsDomain` (line 112):

```ts
export interface UploadFoldersDomain {
  folders: AssetwellUploadFolder[]
  assignments: AssetwellUploadFolderAssignment[]
  createFolder: (name: string) => Promise<boolean>
  renameFolder: (id: string, name: string) => Promise<boolean>
  deleteFolder: (id: string) => Promise<boolean>
  assignUploads: (
    uploadIds: string[],
    folderId: string | null,
  ) => Promise<boolean>
}
```

Create `apps/desktop/src/lib/upload-folders.test.ts` for the pure helpers
(pattern: `apps/desktop/src/lib/uploads-library.test.ts`). Cases: assignment
keyed by `uploadId` when present, by `id` otherwise; unknown folder id → null;
`referencesInFolder(null)` returns only unfoldered; counts ignore null.

**Verify**: `bun test apps/desktop/src/lib/upload-folders.test.ts` → all pass.
`bun --filter @assetwell/desktop typecheck` → exit 0.

### Step 5: Wire the domain into the provider (surgical)

In `apps/desktop/src/lib/higgsfield.tsx`, exactly four additions:

1. `const uploadFolders = useUploadFolders(libraryBridge)` near
   `useUploadsLibrary` (~line 136).
2. `const folderIds = React.useMemo(() => new Set(uploadFolders.folders.map((folder) => folder.id)), [uploadFolders.folders])`.
3. Merge folder assignments where brand assignments are merged: wrap the two
   existing `applyUploadBrandAssignments(...)` results
   (`assignedRemoteUploadReferences` and `assignedLocalReferences`, excerpt in
   "Current state") with `applyUploadFolderAssignments(…, uploadFolders.assignments, folderIds)`,
   adding the new deps to each `useMemo`. Do NOT add folder filtering here —
   brand-view filtering (`isReferenceInBrandView`) stays the only provider-level
   filter, so `activeReferenceLibrary` and all generation flows see every
   folder's uploads.
4. Expose `folders: uploadFolders` on `HiggsfieldAppValue` (add the field to
   the interface in `src/lib/higgsfield/types.ts` beside `brands`, add it to
   the `value` memo and its dep array).

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.
`bun run test` → all pass (no existing test may break).

### Step 6: Drill-in folder UI on the Uploads page

All in `apps/desktop/src/pages/uploads.tsx`, plus one parser in
`apps/desktop/src/lib/query-state.ts`:

1. **Query state**: add `export const uploadsFolderParser = parseAsString` to
   `query-state.ts`; in the page, `const [folderId, setFolderId] = useQueryState("folder", uploadsFolderParser)`
   (null = root). If the id no longer matches a folder (deleted elsewhere),
   treat as root.
2. **Derive the visible set** from the already-brand-filtered
   `uploads.references`:
   - Searching (`search.trim()` non-empty): search across ALL references in
     the current brand view regardless of folder (current behavior), hide
     folder tiles.
   - Root, no search: tiles for every folder (name + count from
     `countReferencesByFolder` over the brand-filtered list, showing 0 when
     absent) above a grid of `referencesInFolder(references, null)`.
   - Folder open, no search: breadcrumb `Uploads › <folder name>` (use the
     existing `breadcrumb.tsx` primitives; clicking "Uploads" clears the
     param) and a grid of `referencesInFolder(references, folderId)`.
3. **Folder tiles**: button styled consistently with `UploadCard` (rounded-2xl
   border, hover accent — match the page's existing classes; folder icon from
   `@tabler/icons-react`, e.g. `IconFolder`). Wrap each in the existing
   `ContextMenu` with "Rename folder" and "Delete folder". Delete calls
   `folders.deleteFolder(id)`; if the open folder is deleted, reset the query
   param. No confirm dialog needed — deletion only clears grouping metadata,
   and the toast says where the uploads went: `"Deleted <name>"` with
   description `"Its uploads moved out of folders."`.
4. **New folder**: a "New folder" outline button beside the tiles (and, when
   inside a folder or when no folders exist, in the header actions). Opens a
   dialog modeled on `BrandFormDialog`
   (`components/blocks/layout/workspace-switcher.tsx:173-250`), submitting to
   `folders.createFolder(name)`. Reuse one dialog component for create+rename
   (the exemplar already supports both modes).
5. **Move selection**: in the selection toolbar (lines 152-197), add a second
   dropdown "Move to folder" beside the brand "Move to": items = every folder,
   separator, "No folder", separator, "New folder…" (opens the dialog, then
   moves the selection into the created folder — `createFolder` must therefore
   resolve after state is updated; return the new folder's id from the hook if
   that simplifies it, adjusting the domain type accordingly). Calls
   `folders.assignUploads(Array.from(selectedIds), folderId)`; clear selection
   on success, same as `moveSelection`.
6. **Empty states**: empty open folder → reuse the dashed empty container with
   title `No uploads in <folder> yet` and an "Add files" button. Keep the
   existing brand empty states untouched at root.

Uploads added while a folder is open (via "Add files") are NOT auto-assigned
to the open folder in this plan — deferred (see Maintenance notes).

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0. Then run the
app (`bun run dev:desktop`) and manually confirm: create folder → tile appears
with count 0; select 2 uploads → Move to folder → they disappear from root
grid; open folder → they're there with breadcrumb; brand chip + open folder
intersect; search finds uploads inside folders from root; rename and delete
work; delete while inside the folder returns to root; Create page reference
picker still shows uploads that live inside folders.

### Step 7: Include folder names in search

In `apps/desktop/src/lib/uploads-search.ts`, extend
`buildUploadSearchIndex(references, brands)` with a third parameter
`folders: AssetwellUploadFolder[]` and add a `folderSearchLabel` mirroring
`brandSearchLabel` (unassigned → no label, NOT "Unsorted" — that word is taken
by brands). Update the one call site (`pages/uploads.tsx:74`) to pass
`folders.folders`. Update the module's test file if one exists (check for
`uploads-search.test.ts`; if missing, add the case to
`upload-folders.test.ts`? No — create `uploads-search` coverage only if a test
file already exists; otherwise skip).

**Verify**: `bun run test` → all pass. Searching a folder's name in the app
returns its uploads.

### Step 8: Update vocabulary docs and run the full gate

Add one sentence to `CONTEXT.md` under the Higgsfield Uploads Library entry
(matching its existing style): Assetwell also overlays `uploadId -> folderId`
metadata as **Upload Folders** — flat, global, local-only grouping shown as
drill-in folders on the Uploads page.

Run, in order: `bun run fmt:check` → `bun run test` → `bun run typecheck` →
`bun run lint` → `bun run build`. All must exit 0.

Commit and update `plans/README.md` (status → DONE).

## Test plan

- **Electron store** (`local-store.test.ts`): the seven cases in Step 2,
  modeled on the brand-store test at line 251.
- **Renderer helpers** (`upload-folders.test.ts`, new): the four cases in
  Step 4, modeled on `uploads-library.test.ts`.
- **Search** (Step 7): folder-name query matches, only if a search test file
  already exists.
- **Manual** (Step 6 verify list): the nine interactions, run via
  `bun run dev:desktop`.

## Done criteria

ALL must hold:

- [ ] `bun run fmt:check`, `bun run test`, `bun run typecheck`, `bun run lint`, `bun run build` all exit 0
- [ ] `bun test apps/desktop/electron/local-store.test.ts` includes ≥1 passing folder-store test
- [ ] `apps/desktop/src/lib/upload-folders.test.ts` exists and passes
- [ ] `grep -n "folderId" packages/desktop-bridge/src/types.ts` shows the overlay field and request types
- [ ] `grep -rn "useUploadFolders\|applyUploadFolderAssignments" apps/desktop/src/lib/higgsfield.tsx` shows only the Step 5 wiring (hook call + two merge call sites)
- [ ] `git status` shows no modified files outside the in-scope list (the pre-existing uncommitted sign-in changes to `higgsfield.tsx` / `session-readiness.*` are expected and must be preserved, not reverted)
- [ ] Manual drill-in flow from Step 6 verified in the running app
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The maintainer has since answered the two open design questions differently
  (per-brand folders, or filter-chips instead of drill-in) — check with the
  operator before Step 1 if there is any sign of a decision (e.g. a note in
  `plans/README.md` or `CONTEXT.md`).
- `applyUploadBrandAssignments` in `higgsfield.tsx` no longer matches the
  excerpt (the merge layer was restructured — re-derive the folder merge
  placement rather than guessing).
- `preload.test.ts` or `channels.test.ts` fail in a way that suggests the
  bridge surface is generated or validated elsewhere than the three files in
  Step 3.
- Adding the folder merge changes what `activeReferenceLibrary` contains for
  any existing test or generation flow — folders must be invisible outside the
  Uploads page.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Deferred**: auto-assigning newly imported uploads to the open folder
  (mirrors how `importHiggsfieldUploads` auto-assigns the active brand — see
  `higgsfield.tsx:453-459`); drag-and-drop into folders; nesting. All are
  natural follow-ups on top of this data model.
- **Review scrutiny**: (1) the folder merge must key on
  `uploadId ?? id` exactly like the brand merge; (2) no folder filtering may
  leak into `activeReferenceLibrary`; (3) `higgsfield.tsx` diff should be
  ~15 lines — if it grew, logic belongs in `upload-folders.ts`.
- **Interacts with**: any future "canonical App Data Root" persistence work
  (CLAUDE.md forbids inventing new storage paths — this plan deliberately
  reuses `stateDirectory()` like `brands.v1.json`); a future brand-delete
  feature should copy `deleteUploadFolder`'s assignment-cleanup semantics.
