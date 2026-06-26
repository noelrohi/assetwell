# Plan 001: Show an in-app "What's New" dialog the first time a user runs a new version

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 6c477c0..HEAD -- apps/desktop/electron/shared/channels.ts apps/desktop/electron/ipc/app-info.ts apps/desktop/electron/preload.ts packages/desktop-bridge/src/types.ts packages/desktop-bridge/src/index.ts apps/desktop/src/main.tsx apps/desktop/electron/preload.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (feature)
- **Planned at**: commit `6c477c0`, 2026-06-26

## Why this matters

Assetwell ships automatic updates, but a user who relaunches into a new version
gets no signal about what changed — the only update affordance is a title-bar
"install" button that disappears once the update is applied. This plan adds a
small "What's New" dialog that appears **once per version**, the first time the
user runs a build they haven't seen notes for. The friendly copy comes straight
from the matching GitHub Release body, so the maintainer keeps writing release
notes in one place (the GitHub Release) and they automatically surface in-app.
This is the surface the maintainer chose for community-facing update news.

## Current state

The update pipeline already exists; this plan adds a sibling read-only path for
"notes about the version I'm running now." Relevant files:

- `apps/desktop/electron/shared/channels.ts` — central registry of IPC channel
  name strings, grouped by domain (`app`, `higgsfield`, `library`, `updater`).
- `apps/desktop/electron/ipc/app-info.ts` — the `app` IPC domain; currently has a
  single `getInfo` handler. **This is where the new GitHub-fetch handler goes.**
- `apps/desktop/electron/preload.ts` — builds the typed `bridge` object exposed to
  the renderer as `window.assetwell`; each method forwards to `ipcRenderer.invoke`.
- `packages/desktop-bridge/src/types.ts` — the shared `DesktopBridge` interface and
  its payload types (the typed contract between renderer and host).
- `packages/desktop-bridge/src/index.ts` — re-exports the public types.
- `apps/desktop/src/main.tsx` — renderer root; mounts providers and the router.
- `apps/desktop/electron/preload.test.ts` — verifies every bridge method forwards to
  the right IPC channel via an exhaustive `bridgeInvocationCases` map.

### Excerpt — `apps/desktop/electron/shared/channels.ts` (the `app` group, top of file)

```ts
export const IPC_CHANNELS = {
  app: {
    getInfo: "assetwell:app:get-info",
  },
  higgsfield: {
    // ...
```

### Excerpt — `apps/desktop/electron/ipc/app-info.ts` (entire file today)

```ts
import { app, ipcMain } from "electron"
import type { HostAppInfo } from "@assetwell/desktop-bridge"

import { IPC_CHANNELS } from "../shared/channels"

export function registerAppInfoIpc() {
  ipcMain.handle(IPC_CHANNELS.app.getInfo, (): HostAppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
    }
  })
}
```

### Excerpt — `packages/desktop-bridge/src/types.ts` (the contract today)

```ts
export interface HostAppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  isPackaged: boolean
}
// ...
export interface DesktopBridge {
  app: {
    getInfo(): Promise<HostAppInfo>
  }
  higgsfield: {
    /* ... */
  }
  // ...
}
```

### Excerpt — `apps/desktop/electron/preload.ts` (the `app` section + the exposure call)

```ts
const bridge: DesktopBridge = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getInfo),
  },
  // ...
}

contextBridge.exposeInMainWorld("assetwell", bridge)
```

### Excerpt — `apps/desktop/src/main.tsx` (entire file today)

```tsx
import React from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { Toaster } from "@/components/ui/sonner"
import { HiggsfieldProvider } from "@/lib/higgsfield"
import { UpdaterProvider } from "@/lib/updater"
import { router } from "@/router"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HiggsfieldProvider>
      <UpdaterProvider>
        <RouterProvider router={router} />
        <Toaster theme="dark" position="bottom-center" />
      </UpdaterProvider>
    </HiggsfieldProvider>
  </React.StrictMode>,
)
```

### Conventions you MUST match

- **IPC additions move together**: when you add a host capability, you update the
  channel name (`channels.ts`), the host handler (`ipc/*.ts`), the bridge type
  (`desktop-bridge/src/types.ts` + `index.ts`), and the preload wiring
  (`preload.ts`) in the same change. `AGENTS.md` (project instructions) states:
  "update it with preload, IPC handlers, and renderer usage together."
- **Naming**: bridge payload types are prefixed `Assetwell*` (e.g.
  `AssetwellUpdateInfo`, `AssetwellSettings`). Channel strings are
  `"assetwell:<domain>:<kebab-name>"`.
- **Network and native work live in the Electron host, never the renderer.**
  `AGENTS.md`: "Spawn CLI commands ... from the Electron Host"; the renderer is
  sandboxed (`contextIsolation: true`, `nodeIntegration: false`). The GitHub
  fetch therefore runs in the **main process** (`ipc/app-info.ts`), not in React.
- **UI primitives**: a shadcn `Dialog` already exists at
  `apps/desktop/src/components/ui/dialog.tsx` exporting
  `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter`.
  Reuse it — do NOT add a new dialog library. Icons come from `@tabler/icons-react`
  (see `apps/desktop/src/components/blocks/layout/app-shell.tsx`: `IconDownload`).
- **Renderer state that persists across launches uses `localStorage`** (see
  `apps/desktop/src/components/blocks/composer/model-picker.tsx` for an existing
  use). Do NOT invent a host-side storage path — `AGENTS.md` explicitly forbids
  inventing app storage paths.
- **Product language in UI**: `AGENTS.md`: "Do not show CLI install state,
  workspace IDs, raw commands, or raw stderr in user-facing UI." Keep the dialog
  warm and human; never surface fetch errors, HTTP status, or URLs to the user.
- Tests use **`bun:test`** (`import { describe, expect, test } from "bun:test"`).

### Release-tag fact (load-bearing)

Releases are tagged `v<version>` and the tag is kept in sync with
`apps/desktop/package.json`'s `version` (`AGENTS.md` → "keep
`apps/desktop/package.json` and the `vX.Y.Z` tag in sync"). The GitHub publish
target is configured in `apps/desktop/package.json` under `build.publish`:
`provider: github, owner: noelrohi, repo: assetwell`. So the release for the
running version `0.0.5` is at GitHub API:
`https://api.github.com/repos/noelrohi/assetwell/releases/tags/v0.0.5`.

## Commands you will need

| Purpose           | Command                                           | Expected on success |
| ----------------- | ------------------------------------------------- | ------------------- |
| Install           | `bun install`                                     | exit 0              |
| Format check      | `bun run fmt:check`                               | exit 0              |
| Desktop typecheck | `bun --filter @assetwell/desktop typecheck`       | exit 0, no errors   |
| Desktop tests     | `bun --filter @assetwell/desktop test`            | all pass            |
| Single test file  | `bun test apps/desktop/src/lib/whats-new.test.ts` | all pass            |
| Lint (slow; last) | `bun run lint`                                    | exit 0              |
| Full build (last) | `bun run build`                                   | exit 0              |

Run order for verification (from `AGENTS.md`): `fmt:check` → `test` →
`typecheck` → `lint` → `build`. `lint` depends on `build` upstream, so it is not
cheap — run it once near the end.

## Scope

**In scope** (the only files you should modify or create):

- `apps/desktop/electron/shared/channels.ts` (edit: add one channel)
- `packages/desktop-bridge/src/types.ts` (edit: add type + bridge method)
- `packages/desktop-bridge/src/index.ts` (edit: export new type)
- `apps/desktop/electron/ipc/app-info.ts` (edit: add fetch handler)
- `apps/desktop/electron/preload.ts` (edit: wire one method)
- `apps/desktop/electron/preload.test.ts` (edit: add one invocation case)
- `apps/desktop/src/lib/whats-new.tsx` (create: parser + dialog component)
- `apps/desktop/src/lib/whats-new.test.ts` (create: parser unit tests)
- `apps/desktop/src/main.tsx` (edit: mount the dialog)
- `plans/README.md` (edit: update only this plan's status row when done)

**Out of scope** (do NOT touch, even though they look related):

- `apps/desktop/electron/updater.ts` and `apps/desktop/src/lib/updater.tsx` — the
  pending-download update flow is a separate feature. Do not change how the
  title-bar install button or the `updater` IPC domain works.
- `CHANGELOG.md` — the maintainer keeps this as the technical record; this feature
  reads GitHub Release bodies, not this file.
- Electron Builder packaging config in `apps/desktop/package.json` — no bundled
  asset is added by this plan.
- Do not add a markdown-rendering dependency (`react-markdown`, `marked`,
  `dompurify`, etc.). The minimal renderer in Step 5 is intentionally dependency-free.

## Git workflow

- Branch: `advisor/001-in-app-whats-new` (create from current branch; do not work
  on the default branch directly).
- Commit style is Conventional Commits — recent history shows
  `feat(www): add marketing site`, `fix(www): configure Vercel deployment`,
  `chore(release): 0.0.5`. Use `feat(desktop): ...` for this work.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Add the IPC channel name

In `apps/desktop/electron/shared/channels.ts`, add `getCurrentReleaseNotes` to the
`app` group:

```ts
  app: {
    getInfo: "assetwell:app:get-info",
    getCurrentReleaseNotes: "assetwell:app:get-current-release-notes",
  },
```

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0 (no new errors;
the string is referenced in later steps).

### Step 2: Extend the bridge contract

In `packages/desktop-bridge/src/types.ts`, add a payload type near `HostAppInfo`:

```ts
export interface AssetwellReleaseNotes {
  /** The app version these notes describe, e.g. "0.0.5". */
  version: string
  /** Release title from GitHub (may be empty). */
  title: string
  /** Raw markdown body of the GitHub Release. */
  body: string
}
```

Then add the method to the `app` block of the `DesktopBridge` interface:

```ts
  app: {
    getInfo(): Promise<HostAppInfo>
    /**
     * Fetches the GitHub Release notes for the currently running app version
     * (host-owned `app.getVersion()`, tag `v<version>`). Returns null when there
     * is no matching release, when the notes are empty, or when the network/API
     * is unavailable — callers must treat null as "nothing to show", never as an
     * error to surface. The renderer does not supply the version.
     */
    getCurrentReleaseNotes(): Promise<AssetwellReleaseNotes | null>
  }
```

In `packages/desktop-bridge/src/index.ts`, add `AssetwellReleaseNotes` to the
exported `type { ... }` list (keep it alphabetical-ish with the other `Assetwell*`
entries — placing it right after the `AssetwellPromptPreset`/`AssetwellReferenceAsset`
neighborhood is fine; exact position does not matter, only that it is exported).

**Verify**: `bun --filter @assetwell/desktop typecheck` → this will now report an
error in `preload.ts` (the bridge object is missing `getCurrentReleaseNotes`) and
possibly in `preload.test.ts`. That is expected — Steps 3 and 6 resolve it. Confirm
the only new errors are "missing property `getCurrentReleaseNotes`"-style errors in
those two files.

### Step 3: Wire the preload method

In `apps/desktop/electron/preload.ts`, add to the `app` block:

```ts
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getInfo),
    getCurrentReleaseNotes: () =>
      ipcRenderer.invoke(IPC_CHANNELS.app.getCurrentReleaseNotes),
  },
```

**Verify**: `bun --filter @assetwell/desktop typecheck` → the `preload.ts` error
from Step 2 is gone. (A `preload.test.ts` error may remain until Step 6.)

### Step 4: Implement the host fetch handler

In `apps/desktop/electron/ipc/app-info.ts`, import the new type and add a second
handler inside `registerAppInfoIpc`. Requirements the implementation MUST meet:

- The host owns version selection: inside the handler, read `const version = app.getVersion()`.
  Do not accept a renderer-supplied version argument.
- Build the URL as
  `https://api.github.com/repos/noelrohi/assetwell/releases/tags/v${encodeURIComponent(version)}`.
  (Hardcode `noelrohi/assetwell` — it matches `build.publish` in
  `apps/desktop/package.json`. Do not read it from package.json at runtime.)
- Send headers `{ "User-Agent": "Assetwell", "Accept": "application/vnd.github+json" }`.
  **The `User-Agent` is required** — GitHub returns 403 without it.
- Use Node's global `fetch` (Electron's main process has it). Apply a timeout with
  `AbortSignal.timeout(5000)`.
- On any non-2xx response, thrown error, empty body, or timeout: return `null`. Log
  at most a one-line `console.warn` (mirror the style in
  `apps/desktop/electron/updater.ts`'s `logUpdaterError`). Never throw out of the
  handler.
- On success, read JSON, and return
  `{ version, title: data.name ?? "", body: data.body ?? "" }`. If `body` is empty
  or only whitespace after trimming, return `null` (nothing worth showing).

Target shape:

```ts
import { app, ipcMain } from "electron"
import type {
  AssetwellReleaseNotes,
  HostAppInfo,
} from "@assetwell/desktop-bridge"

import { IPC_CHANNELS } from "../shared/channels"

const GITHUB_RELEASES_BASE =
  "https://api.github.com/repos/noelrohi/assetwell/releases/tags"

export function registerAppInfoIpc() {
  ipcMain.handle(IPC_CHANNELS.app.getInfo, (): HostAppInfo => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.app.getCurrentReleaseNotes,
    async (): Promise<AssetwellReleaseNotes | null> => {
      const version = app.getVersion()

      try {
        const response = await fetch(
          `${GITHUB_RELEASES_BASE}/v${encodeURIComponent(version)}`,
          {
            headers: {
              "User-Agent": "Assetwell",
              Accept: "application/vnd.github+json",
            },
            signal: AbortSignal.timeout(5000),
          },
        )
        if (!response.ok) return null

        const data = (await response.json()) as {
          name?: string | null
          body?: string | null
        }
        const body = (data.body ?? "").trim()
        if (!body) return null

        return { version, title: data.name ?? "", body }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[whats-new] ${message}`)
        return null
      }
    },
  )
}
```

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0 except for any
remaining `preload.test.ts` error (resolved in Step 6).

### Step 5: Create the renderer parser + dialog

Create `apps/desktop/src/lib/whats-new.tsx`. It has two parts.

**(a) A pure, exported markdown-lite parser** — kept pure so it is unit-testable
and so we render **text nodes only** (no `dangerouslySetInnerHTML`, no injection
surface). It must handle exactly these cases from a GitHub Release body:

- Lines starting with `# `, `## `, or `### ` → a heading block (strip the `#`s).
- Lines starting with `- ` or `* ` → a bullet item (strip the marker). Consecutive
  bullets group into one list.
- Blank lines → block separators.
- Everything else → paragraph text. Consecutive non-blank, non-heading, non-bullet
  lines should be joined with a single space into one paragraph block until the next
  blank line/list/heading.
- Normalize inline markdown before returning text: reduce `[text](url)` to `text`
  and remove `**` bold markers wherever they appear in the line, so raw markdown
  never shows. Do NOT attempt to make links clickable (out of scope; see
  maintenance notes).

Define and export:

```ts
export type WhatsNewBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }

export function parseReleaseNotes(markdown: string): WhatsNewBlock[]
```

**(b) A `WhatsNewDialog` component** that self-manages, mounted once. Behavior:

1. On mount, read the bridge with `getDesktopBridge()` and then call
   `bridge.app.getInfo()` for the current version. If `window.assetwell` is
   undefined (e.g. running outside Electron), render nothing.
2. Read `localStorage.getItem("assetwell:whatsNew:lastSeenVersion")`. If it equals
   the current version, do nothing (already seen this version's notes).
3. Otherwise call `bridge.app.getCurrentReleaseNotes()`.
   - If it returns `null`, **silently** write the current version to
     `localStorage` (so we don't re-fetch every launch) and render nothing.
   - If it returns notes, open the `Dialog` rendering the parsed blocks.
4. When the dialog closes (user dismisses), write the current version to
   `localStorage["assetwell:whatsNew:lastSeenVersion"]`.
5. Guard all `localStorage` access in `try/catch` (it can throw in locked-down
   environments) — on failure, continue without persistence.
6. Wrap the async effect in `try/catch` and keep an `active` boolean cleanup guard
   (same pattern as `UpdaterProvider`) so bridge failures stay silent and a late
   promise does not call `setState` after unmount/React StrictMode cleanup.

UI requirements:

- Use `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/
  `DialogFooter` from `@/components/ui/dialog` and `Button` from
  `@/components/ui/button`.
- Title: `What's new in Assetwell ${version}` (use the release `title` as a
  subheading/description only if non-empty).
- Render headings as a `font-semibold` line, paragraphs as `text-sm` muted text,
  lists as a `list-disc pl-5` `ul`. Put the notes body in a constrained scrolling
  area (for example `max-h-[60vh] overflow-y-auto pr-1`) so a long release body
  cannot push the footer off-screen. Match the dark theme already in use (the app
  mounts `<Toaster theme="dark" />`); reuse existing utility classes, do not invent
  a new color palette.
- A single dismiss button in the footer labelled "Got it".

Use `React` hooks (`useState`, `useEffect`) following the style in
`apps/desktop/src/lib/updater.tsx` (e.g. the `getDesktopBridge()` helper that
returns `typeof window === "undefined" ? undefined : window.assetwell`). You may
copy that helper into this file.

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0 for this file.

### Step 6: Add the preload test case

In `apps/desktop/electron/preload.test.ts`, the `bridgeInvocationCases` object is
typed to be exhaustive over every bridge method. Add an entry for the new method,
mirroring the existing `"app.getInfo"` case:

```ts
  "app.getCurrentReleaseNotes": {
    call: (bridge) => bridge.app.getCurrentReleaseNotes(),
    expected: [IPC_CHANNELS.app.getCurrentReleaseNotes],
  },
```

If the `BridgeInvokePath` type union near the top of the file enumerates `app`
methods and now flags `getCurrentReleaseNotes` as missing, that is resolved by adding
the case above (the union is derived from `keyof DesktopBridge["app"]`).

**Verify**: `bun --filter @assetwell/desktop test` → all pass, including this case.

### Step 7: Mount the dialog

In `apps/desktop/src/main.tsx`, import and render `WhatsNewDialog` once, inside the
providers (so it has access to nothing special — it uses the global bridge — but
keep it within the existing tree). Place it as a sibling of `RouterProvider`:

```tsx
import { WhatsNewDialog } from "@/lib/whats-new"
// ...
;<UpdaterProvider>
  <RouterProvider router={router} />
  <WhatsNewDialog />
  <Toaster theme="dark" position="bottom-center" />
</UpdaterProvider>
```

**Verify**: `bun --filter @assetwell/desktop typecheck` → exit 0.

## Test plan

Create `apps/desktop/src/lib/whats-new.test.ts` (model its structure on
`apps/desktop/electron/higgsfield-output.test.ts` — same `bun:test` imports and
`describe`/`test`/`expect` style). Test **only the pure `parseReleaseNotes`
function** (the dialog's effects need a DOM/bridge and are out of scope for unit
tests here). Cover:

- Happy path: a body with a `## ` heading, two `- ` bullets, and a paragraph →
  yields `heading`, `list` (2 items), `paragraph` blocks in order.
- Bullets with `* ` marker are treated the same as `- `.
- A `[label](https://x)` link is reduced to `label`.
- `**bold**` emphasis markers are stripped.
- Two adjacent plain-text lines become one paragraph with a single space between
  them.
- Empty string → `[]`.
- A body of only blank lines → `[]`.

Verification: `bun test apps/desktop/src/lib/whats-new.test.ts` → all pass
(at least 7 assertions/cases).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run fmt:check` exits 0
- [ ] `bun --filter @assetwell/desktop test` exits 0; new `whats-new.test.ts` cases
      pass and the new `app.getCurrentReleaseNotes` preload case passes
- [ ] `bun --filter @assetwell/desktop typecheck` exits 0
- [ ] `bun run lint` exits 0
- [ ] `bun run build` exits 0
- [ ] `rg -n "getCurrentReleaseNotes" apps/desktop/electron packages/desktop-bridge` shows
      the channel, the bridge type, the preload wiring, the handler, and the preload
      test case (5+ matches)
- [ ] `! rg -n "dangerouslySetInnerHTML|react-markdown|dompurify" apps/desktop/src/lib/whats-new.tsx`
      succeeds with no matches (renderer stays injection-free and dependency-free)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts don't match the live code (the codebase drifted
  since commit `6c477c0`).
- **The repository `noelrohi/assetwell` releases are private/unauthenticated.**
  Check the tag for the current `apps/desktop/package.json` version (for this
  plan's baseline, `v0.0.5`) by running `gh release view v0.0.5 --repo noelrohi/assetwell`
  or `curl -sS -o /dev/null -w "%{http_code}" -H "User-Agent: Assetwell" https://api.github.com/repos/noelrohi/assetwell/releases/tags/v0.0.5`.
  If that returns 404/401/403 for a version that _does_ have a published release,
  the runtime fetch will never return notes without an auth token — STOP and report,
  because the bundled-`whatsnew.json` approach (see `plans/README.md` rejected list)
  would then be the better design and needs maintainer sign-off.
- `preload.test.ts` fails in a way not resolved by adding the single invocation
  case in Step 6 (e.g. the test harness changed shape).
- Any verification command fails twice after a reasonable fix attempt.
- Implementing any step appears to require editing a file outside the in-scope list.

## Maintenance notes

For whoever owns this after it lands:

- **Source of copy**: the dialog renders the GitHub Release _body_ for tag
  `v<version>`. The release notes the maintainer writes when tagging a version are
  exactly what users see. Keep them warm/non-technical (the `CHANGELOG.md` stays the
  technical record and is deliberately not used here).
- **Reviewer should scrutinize**: that the host handler never throws (every path
  returns `null`), that the `User-Agent` header is present, that no fetch error or
  URL is ever shown in the UI, and that `parseReleaseNotes` renders text nodes only
  (no `dangerouslySetInnerHTML`).
- **Seen-state** lives in `localStorage["assetwell:whatsNew:lastSeenVersion"]`. To
  re-test the dialog, clear that key in devtools. This is per-machine, not synced.
- **Deferred follow-ups** (intentionally out of this plan):
  - Surfacing notes for an update that has _downloaded but not yet installed_ (the
    `updater` domain already carries `releaseNotes` on `AssetwellUpdateInfo` — a
    future plan could render those in the title-bar install flow).
  - Making links in the notes clickable via the host (`shell.openExternal`, as used
    in `apps/desktop/electron/ipc/higgsfield.ts:138`); requires a new bridge method.
  - A manually re-openable "What's New" entry (e.g. a menu item), since the data is
    already fetchable on demand.
- **If GitHub rate-limits unauthenticated requests** in practice (60/hr/IP), it is a
  non-issue here because the fetch runs at most once per new version per machine and
  no-ops on failure — but keep it in mind if the trigger ever broadens.
