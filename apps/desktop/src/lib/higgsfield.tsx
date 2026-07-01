import * as React from "react"
import { toast } from "sonner"
import type {
  HiggsfieldAccountStatus,
  HiggsfieldCliStatus,
  HiggsfieldCommandOutputEvent,
  HiggsfieldWorkspaceContext,
  AssetwellLibrarySnapshot,
  AssetwellPromptKind,
  AssetwellSettings,
} from "@assetwell/desktop-bridge"

import {
  imageModels as fallbackImageModels,
  videoModels as fallbackVideoModels,
} from "@/lib/mock-data"

import {
  shippedImagePrompts,
  shippedVideoPrompts,
} from "./higgsfield/constants"
import {
  applyGenerationResultToCreatives,
  applyGenerationResultToVideos,
  markRunFailedInCreatives,
  markRunFailedInVideos,
} from "./higgsfield/generation-state"
import { useHiggsfieldGenerationActions } from "./higgsfield/generation-actions"
import {
  artifactUrl,
  createSnapshot,
  fileUrl,
  normalizeCreativeUrls,
  normalizeVideoUrls,
} from "./higgsfield/local-state"
import { useModelAspectRatios } from "./higgsfield/model-aspect-ratios"
import { isHiggsfieldSessionReady } from "./higgsfield/session-readiness"
import { isInUploadWorkspace, useUploadsLibrary } from "./uploads-library"
import { toModelOptions } from "./higgsfield/model-options"
import { friendlyError, friendlyExit, titleFromPrompt } from "./higgsfield/text"
import type {
  Creative,
  HiggsfieldAppValue,
  ModelOption,
  PendingRun,
  PromptPreset,
  ReferenceAsset,
  VideoResult,
  VideoSource,
} from "./higgsfield/types"

export { imagePromptLibrary, videoPromptLibrary } from "@/lib/mock-data"
export type {
  Creative,
  JobStatus,
  PlacementResult,
  PromptPreset,
  ReferenceAsset,
  Take,
  VideoResult,
  VideoSource,
} from "./higgsfield/types"

const HiggsfieldAppContext = React.createContext<HiggsfieldAppValue | null>(
  null,
)

export function HiggsfieldProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const desktopBridge = getDesktopBridge()
  const bridge = desktopBridge?.higgsfield
  const libraryBridge = desktopBridge?.library
  const pendingRuns = React.useRef(new Map<string, PendingRun>())
  const completedRuns = React.useRef(new Set<string>())
  const signInRun = React.useRef<string | null>(null)
  const signOutRun = React.useRef<string | null>(null)
  const booted = React.useRef(false)

  const [account, setAccount] = React.useState<HiggsfieldAccountStatus | null>(
    null,
  )
  const [cliStatus, setCliStatus] = React.useState<HiggsfieldCliStatus | null>(
    null,
  )
  const [workspace, setWorkspace] =
    React.useState<HiggsfieldWorkspaceContext | null>(null)
  const [imageModels, setImageModels] = React.useState<ModelOption[]>(() =>
    bridge ? [] : fallbackImageModels,
  )
  const [videoModels, setVideoModels] = React.useState<ModelOption[]>(() =>
    bridge ? [] : fallbackVideoModels,
  )
  const [creatives, setCreatives] = React.useState<Creative[]>([])
  const [videos, setVideos] = React.useState<VideoResult[]>([])
  const [customPrompts, setCustomPrompts] = React.useState<PromptPreset[]>([])
  const [settings, setSettings] = React.useState<AssetwellSettings | null>(null)
  const [localStateReady, setLocalStateReady] = React.useState(!libraryBridge)
  const [runningJobs, setRunningJobs] = React.useState(0)
  const [videoDraftSource, setVideoDraftSource] =
    React.useState<VideoSource | null>(null)
  const { uploads, applyUploadsSnapshot, restorePersistedReferences } =
    useUploadsLibrary(libraryBridge)
  const referenceLibrary = uploads.references
  const activeUploadWorkspaceId = uploads.activeWorkspaceId
  const visibleCreatives = React.useMemo(
    () =>
      creatives.filter((creative) =>
        isInUploadWorkspace(creative, activeUploadWorkspaceId),
      ),
    [activeUploadWorkspaceId, creatives],
  )
  const visibleVideos = React.useMemo(
    () =>
      videos.filter((video) =>
        isInUploadWorkspace(video, activeUploadWorkspaceId),
      ),
    [activeUploadWorkspaceId, videos],
  )
  const refreshUploads = uploads.refresh

  const syncRunningJobs = React.useCallback(() => {
    setRunningJobs(pendingRuns.current.size)
  }, [])

  const getModelAspectRatios = useModelAspectRatios(bridge)

  const markSignedOut = React.useCallback(() => {
    setAccount(null)
    setWorkspace(null)
    setCliStatus((current) =>
      current
        ? {
            ...current,
            authStatus: "unauthenticated",
            workspaceStatus: "unknown",
            detail: "Sign in to connect your Higgsfield account.",
            checkedAt: new Date().toISOString(),
          }
        : current,
    )
  }, [])

  const refreshAccount = React.useCallback(async () => {
    if (!bridge || !isHiggsfieldSessionReady(cliStatus)) return
    try {
      setAccount(await bridge.checkCredits())
    } catch (error) {
      toast("Could not refresh Higgsfield credits", {
        description: friendlyError(error),
      })
    }
  }, [bridge, cliStatus])

  const refreshSession = React.useCallback(async () => {
    if (!bridge) return

    const status = await bridge.getStatus()
    setCliStatus(status)

    if (!isHiggsfieldSessionReady(status)) {
      setAccount(null)
      setWorkspace(null)
      return
    }

    const [credits, workspaceContext, imageModelRows, videoModelRows] =
      await Promise.allSettled([
        bridge.checkCredits(),
        bridge.checkWorkspace(),
        bridge.listModels({ mediaKind: "image" }),
        bridge.listModels({ mediaKind: "video" }),
      ])

    if (credits.status === "fulfilled") setAccount(credits.value)
    if (workspaceContext.status === "fulfilled") {
      setWorkspace(workspaceContext.value)
    }
    if (imageModelRows.status === "fulfilled") {
      setImageModels(toModelOptions(imageModelRows.value, "image"))
    }
    if (videoModelRows.status === "fulfilled") {
      setVideoModels(toModelOptions(videoModelRows.value, "video"))
    }
  }, [bridge])

  const restoreSnapshot = React.useCallback(
    (snapshot: AssetwellLibrarySnapshot) => {
      setCreatives(
        (snapshot.creatives as Creative[]).map(normalizeCreativeUrls),
      )
      setVideos((snapshot.videos as VideoResult[]).map(normalizeVideoUrls))
      restorePersistedReferences(snapshot.referenceLibrary as ReferenceAsset[])
      setCustomPrompts(snapshot.customPrompts)
    },
    [restorePersistedReferences],
  )

  const applyGenerationResult = React.useCallback(
    (pending: PendingRun, event: HiggsfieldCommandOutputEvent) => {
      const artifact = event.result?.artifacts[0]
      const url = artifactUrl(artifact)
      if (!url) return

      const result = { url, filePath: artifact?.filePath ?? undefined }
      setCreatives((current) =>
        applyGenerationResultToCreatives(current, pending, result),
      )
      setVideos((current) =>
        applyGenerationResultToVideos(current, pending, result),
      )
    },
    [],
  )

  const markRunFailed = React.useCallback(
    (pending: PendingRun, error: string) => {
      setCreatives((current) =>
        markRunFailedInCreatives(current, pending, error),
      )
      setVideos((current) => markRunFailedInVideos(current, pending, error))
    },
    [],
  )

  const signIn = React.useCallback(async () => {
    if (!bridge) return
    try {
      const run = await bridge.signIn()
      signInRun.current = run.runId
      toast("Higgsfield sign-in opened")
    } catch (error) {
      toast("Could not start Higgsfield sign-in", {
        description: friendlyError(error),
      })
    }
  }, [bridge])

  const signOut = React.useCallback(async () => {
    if (!bridge) return
    try {
      const run = await bridge.signOut()
      signOutRun.current = run.runId
      markSignedOut()
      toast("Signed out of Higgsfield")
    } catch (error) {
      toast("Could not sign out of Higgsfield", {
        description: friendlyError(error),
      })
    }
  }, [bridge, markSignedOut])

  const chooseVideoSource = React.useCallback(async () => {
    if (!bridge) {
      toast("Open the desktop app to choose a local source image")
      return null
    }

    const asset = await bridge.chooseAsset("image")
    if (!asset) return null

    const source = {
      url: fileUrl(asset.filePath),
      filePath: asset.filePath,
      label: asset.fileName,
    }
    setVideoDraftSource(source)
    return source
  }, [bridge])

  const chooseOutputRoot = React.useCallback(async () => {
    if (!libraryBridge) return
    const result = await libraryBridge.chooseOutputRoot()
    if (!result) return
    setSettings({ outputRoot: result.outputRoot })
    await refreshUploads()
    toast("Assetwell library folder updated", {
      description: result.outputRoot,
    })
  }, [libraryBridge, refreshUploads])

  const revealOutputRoot = React.useCallback(async () => {
    if (!libraryBridge) return
    const opened = await libraryBridge.revealOutputRoot()
    if (!opened) toast("Could not open the Assetwell library folder")
  }, [libraryBridge])

  const savePromptPreset = React.useCallback(
    (kind: AssetwellPromptKind, body: string, title?: string) => {
      const trimmed = body.trim()
      if (trimmed.length < 3) return
      const trimmedTitle = title?.trim()
      const preset: PromptPreset = {
        id: `prompt-${kind}-${Date.now()}`,
        kind,
        title: trimmedTitle
          ? titleFromPrompt(trimmedTitle)
          : titleFromPrompt(trimmed),
        body: trimmed,
        createdAt: new Date().toISOString(),
      }
      setCustomPrompts((current) => [preset, ...current])
      toast("Saved prompt template")
    },
    [],
  )

  const deletePromptPreset = React.useCallback((id: string) => {
    setCustomPrompts((current) => current.filter((prompt) => prompt.id !== id))
  }, [])

  const deleteCreative = React.useCallback((creativeId: string) => {
    setCreatives((current) =>
      current.filter((creative) => creative.id !== creativeId),
    )
    toast("Creative deleted")
  }, [])

  const {
    makeCreative,
    selectTake,
    generateAllPlacements,
    regeneratePlacement,
    openOutput,
    exportCreativeZip,
    exportVideo,
    makeVideos,
  } = useHiggsfieldGenerationActions({
    bridge,
    libraryBridge,
    account,
    cliStatus,
    creatives,
    videos,
    referenceLibrary,
    activeUploadWorkspaceId,
    setCreatives,
    setVideos,
    pendingRuns,
    syncRunningJobs,
    getModelAspectRatios,
    markRunFailed,
    signIn,
  })

  React.useEffect(() => {
    if ((!bridge && !libraryBridge) || booted.current) return
    booted.current = true
    const higgsfield = bridge
    const library = libraryBridge

    async function load() {
      if (library) {
        const [snapshot, storedSettings, uploadsSnapshot] =
          await Promise.allSettled([
            library.loadSnapshot(),
            library.getSettings(),
            library.loadUploadsSnapshot(),
          ])

        if (snapshot.status === "fulfilled" && snapshot.value) {
          restoreSnapshot(snapshot.value)
        }
        if (storedSettings.status === "fulfilled") {
          setSettings(storedSettings.value)
        }
        if (uploadsSnapshot.status === "fulfilled") {
          applyUploadsSnapshot(uploadsSnapshot.value)
        }
        setLocalStateReady(true)
      }

      if (!higgsfield) return

      const status = await higgsfield.getStatus()
      setCliStatus(status)

      if (!isHiggsfieldSessionReady(status)) {
        setAccount(null)
        setWorkspace(null)
        return
      }

      const [credits, workspaceContext, imageModelRows, videoModelRows] =
        await Promise.allSettled([
          higgsfield.checkCredits(),
          higgsfield.checkWorkspace(),
          higgsfield.listModels({ mediaKind: "image" }),
          higgsfield.listModels({ mediaKind: "video" }),
        ])

      if (credits.status === "fulfilled") setAccount(credits.value)
      if (workspaceContext.status === "fulfilled") {
        setWorkspace(workspaceContext.value)
      }
      if (imageModelRows.status === "fulfilled") {
        setImageModels(toModelOptions(imageModelRows.value, "image"))
      }
      if (videoModelRows.status === "fulfilled") {
        setVideoModels(toModelOptions(videoModelRows.value, "video"))
      }
    }

    void load()
  }, [applyUploadsSnapshot, bridge, libraryBridge, restoreSnapshot])

  React.useEffect(() => {
    if (!bridge) return

    return bridge.onCommandOutput((event) => {
      if (event.runId === signInRun.current && event.kind === "exit") {
        signInRun.current = null
        if (event.exitCode === 0) {
          void refreshSession()
        }
      }

      if (event.runId === signOutRun.current && event.kind === "exit") {
        signOutRun.current = null
        if (event.exitCode === 0) {
          markSignedOut()
        }
        void refreshSession()
      }

      const pending = pendingRuns.current.get(event.runId)
      if (!pending) return

      if (event.kind === "result") {
        completedRuns.current.add(event.runId)
        applyGenerationResult(pending, event)
      }

      if (event.kind === "exit") {
        const succeeded =
          event.exitCode === 0 && completedRuns.current.has(event.runId)
        if (!succeeded) markRunFailed(pending, friendlyExit(event))
        pendingRuns.current.delete(event.runId)
        completedRuns.current.delete(event.runId)
        syncRunningJobs()
        void refreshAccount()
      }
    })
  }, [
    applyGenerationResult,
    bridge,
    markRunFailed,
    markSignedOut,
    refreshAccount,
    refreshSession,
    syncRunningJobs,
  ])

  React.useEffect(() => {
    if (!libraryBridge || !localStateReady) return

    const snapshot = createSnapshot(
      creatives,
      videos,
      referenceLibrary,
      customPrompts,
    )
    const timeout = window.setTimeout(() => {
      void libraryBridge.saveSnapshot(snapshot)
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [
    libraryBridge,
    localStateReady,
    creatives,
    videos,
    referenceLibrary,
    customPrompts,
  ])

  const value = React.useMemo<HiggsfieldAppValue>(
    () => ({
      account,
      cliStatus,
      workspace,
      imageModels,
      videoModels,
      creatives: visibleCreatives,
      videos: visibleVideos,
      uploads,
      imagePrompts: [
        ...customPrompts.filter((prompt) => prompt.kind === "image"),
        ...shippedImagePrompts,
      ],
      videoPrompts: [
        ...customPrompts.filter((prompt) => prompt.kind === "video"),
        ...shippedVideoPrompts,
      ],
      settings,
      runningJobs,
      videoDraftSource,
      refreshAccount,
      refreshSession,
      signIn,
      signOut,
      chooseVideoSource,
      chooseOutputRoot,
      revealOutputRoot,
      savePromptPreset,
      deletePromptPreset,
      getModelAspectRatios,
      setVideoDraftSource,
      makeCreative,
      deleteCreative,
      selectTake,
      generateAllPlacements,
      regeneratePlacement,
      openOutput,
      exportCreativeZip,
      exportVideo,
      makeVideos,
      creativeById: (id) =>
        visibleCreatives.find((creative) => creative.id === id),
    }),
    [
      account,
      cliStatus,
      workspace,
      imageModels,
      videoModels,
      visibleCreatives,
      visibleVideos,
      uploads,
      customPrompts,
      settings,
      runningJobs,
      videoDraftSource,
      refreshAccount,
      refreshSession,
      signIn,
      signOut,
      chooseVideoSource,
      chooseOutputRoot,
      revealOutputRoot,
      savePromptPreset,
      deletePromptPreset,
      getModelAspectRatios,
      makeCreative,
      deleteCreative,
      selectTake,
      generateAllPlacements,
      regeneratePlacement,
      openOutput,
      exportCreativeZip,
      exportVideo,
      makeVideos,
    ],
  )

  return (
    <HiggsfieldAppContext.Provider value={value}>
      {children}
    </HiggsfieldAppContext.Provider>
  )
}

export function useHiggsfieldApp() {
  const value = React.useContext(HiggsfieldAppContext)
  if (!value) {
    throw new Error("useHiggsfieldApp must be used inside HiggsfieldProvider.")
  }

  return value
}

function getDesktopBridge() {
  return typeof window === "undefined" ? undefined : window.assetwell
}
