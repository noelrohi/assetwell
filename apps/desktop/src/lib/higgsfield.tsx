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
  AssetwellUploadsSnapshot,
  AssetwellUploadWorkspace,
} from "@assetwell/desktop-bridge"

import {
  imageModels as fallbackImageModels,
  videoModels as fallbackVideoModels,
} from "@/lib/mock-data"

import {
  seededReferences,
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
  normalizeReferenceUrl,
  normalizeVideoUrls,
} from "./higgsfield/local-state"
import { useModelAspectRatios } from "./higgsfield/model-aspect-ratios"
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

const defaultUploadWorkspace: AssetwellUploadWorkspace = {
  id: "Default",
  name: "Default",
  isDefault: true,
}

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
  const [referenceLibrary, setReferenceLibrary] = React.useState<
    ReferenceAsset[]
  >(libraryBridge ? [] : seededReferences)
  const [uploadWorkspaces, setUploadWorkspaces] = React.useState<
    AssetwellUploadWorkspace[]
  >([defaultUploadWorkspace])
  const [activeUploadWorkspaceId, setActiveUploadWorkspaceIdState] =
    React.useState(defaultUploadWorkspace.id)
  const [customPrompts, setCustomPrompts] = React.useState<PromptPreset[]>([])
  const [settings, setSettings] = React.useState<AssetwellSettings | null>(null)
  const [localStateReady, setLocalStateReady] = React.useState(!libraryBridge)
  const [runningJobs, setRunningJobs] = React.useState(0)
  const [videoDraftSource, setVideoDraftSource] =
    React.useState<VideoSource | null>(null)

  const syncRunningJobs = React.useCallback(() => {
    setRunningJobs(pendingRuns.current.size)
  }, [])

  const getModelAspectRatios = useModelAspectRatios(bridge)

  const refreshAccount = React.useCallback(async () => {
    if (!bridge) return
    try {
      setAccount(await bridge.checkCredits())
    } catch (error) {
      toast("Could not refresh Higgsfield credits", {
        description: friendlyError(error),
      })
    }
  }, [bridge])

  const refreshSession = React.useCallback(async () => {
    if (!bridge) return

    const [status, credits, workspaceContext] = await Promise.allSettled([
      bridge.getStatus(),
      bridge.checkCredits(),
      bridge.checkWorkspace(),
    ])

    if (status.status === "fulfilled") setCliStatus(status.value)
    if (credits.status === "fulfilled") setAccount(credits.value)
    if (workspaceContext.status === "fulfilled") {
      setWorkspace(workspaceContext.value)
    }
  }, [bridge])

  const applyUploadsSnapshot = React.useCallback(
    (snapshot: AssetwellUploadsSnapshot) => {
      const workspaces = snapshot.workspaceState.workspaces.length
        ? snapshot.workspaceState.workspaces
        : [defaultUploadWorkspace]
      setUploadWorkspaces(workspaces)
      setActiveUploadWorkspaceIdState(
        snapshot.workspaceState.activeWorkspaceId || defaultUploadWorkspace.id,
      )
      setReferenceLibrary(snapshot.references as ReferenceAsset[])
    },
    [],
  )

  const refreshReferenceLibrary = React.useCallback(async () => {
    if (!libraryBridge) return

    try {
      applyUploadsSnapshot(await libraryBridge.loadUploadsSnapshot())
    } catch (error) {
      toast("Could not refresh Uploads", {
        description: friendlyError(error),
      })
    }
  }, [applyUploadsSnapshot, libraryBridge])

  const restoreSnapshot = React.useCallback(
    (snapshot: AssetwellLibrarySnapshot) => {
      setCreatives(
        (snapshot.creatives as Creative[]).map(normalizeCreativeUrls),
      )
      setVideos((snapshot.videos as VideoResult[]).map(normalizeVideoUrls))
      setReferenceLibrary(
        snapshot.referenceLibrary.length
          ? (snapshot.referenceLibrary as ReferenceAsset[]).map(
              normalizeReferenceUrl,
            )
          : libraryBridge
            ? []
            : seededReferences,
      )
      setCustomPrompts(snapshot.customPrompts)
    },
    [libraryBridge],
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

  const chooseReferenceAsset = React.useCallback(async () => {
    if (!libraryBridge) {
      toast("Open the desktop app to add Uploads files")
      return
    }

    try {
      const before = referenceLibrary.length
      const snapshot = await libraryBridge.importReferenceAssets()
      applyUploadsSnapshot(snapshot)
      const added = Math.max(0, snapshot.references.length - before)
      if (added > 0) {
        toast(`Added ${added} Uploads file${added === 1 ? "" : "s"}`)
      }
    } catch (error) {
      toast("Could not add files to Uploads", {
        description: friendlyError(error),
      })
    }
  }, [applyUploadsSnapshot, libraryBridge, referenceLibrary.length])

  const revealReferenceLibrary = React.useCallback(async () => {
    if (!libraryBridge) return
    const opened = await libraryBridge.revealReferenceAssets()
    if (!opened) toast("Could not open Uploads folder")
  }, [libraryBridge])

  const deleteReferenceAsset = React.useCallback(
    async (id: string) => {
      if (!libraryBridge) return

      try {
        applyUploadsSnapshot(await libraryBridge.deleteReferenceAsset({ id }))
        toast("Removed Uploads file")
      } catch (error) {
        toast("Could not remove Uploads file", {
          description: friendlyError(error),
        })
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const setActiveUploadWorkspace = React.useCallback(
    async (id: string) => {
      if (!libraryBridge) return false

      try {
        applyUploadsSnapshot(
          await libraryBridge.setActiveUploadWorkspace({
            id,
          }),
        )
        return true
      } catch (error) {
        toast("Could not switch Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const createUploadWorkspace = React.useCallback(
    async (name: string) => {
      if (!libraryBridge) {
        toast("Open the desktop app to create Uploads workspaces")
        return false
      }

      try {
        const snapshot = await libraryBridge.createUploadWorkspace({
          name,
        })
        applyUploadsSnapshot(snapshot)
        const activeWorkspace = snapshot.workspaceState.workspaces.find(
          (workspace) =>
            workspace.id === snapshot.workspaceState.activeWorkspaceId,
        )
        toast(`Switched to ${activeWorkspace?.name ?? name}`)
        return true
      } catch (error) {
        toast("Could not create Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const updateUploadWorkspace = React.useCallback(
    async (id: string, name: string) => {
      if (!libraryBridge) {
        toast("Open the desktop app to rename Uploads workspaces")
        return false
      }

      try {
        const snapshot = await libraryBridge.updateUploadWorkspace({ id, name })
        applyUploadsSnapshot(snapshot)
        toast("Workspace renamed")
        return true
      } catch (error) {
        toast("Could not rename Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge],
  )

  const deleteUploadWorkspace = React.useCallback(
    async (id: string) => {
      if (!libraryBridge) {
        toast("Open the desktop app to delete Uploads workspaces")
        return false
      }

      const workspaceName =
        uploadWorkspaces.find((workspace) => workspace.id === id)?.name ??
        "workspace"

      try {
        applyUploadsSnapshot(await libraryBridge.deleteUploadWorkspace({ id }))
        toast(`Deleted ${workspaceName}`)
        return true
      } catch (error) {
        toast("Could not delete Uploads workspace", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [applyUploadsSnapshot, libraryBridge, uploadWorkspaces],
  )

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
    await refreshReferenceLibrary()
    toast("Assetwell library folder updated", {
      description: result.outputRoot,
    })
  }, [libraryBridge, refreshReferenceLibrary])

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

      const [
        status,
        credits,
        workspaceContext,
        imageModelRows,
        videoModelRows,
      ] = await Promise.allSettled([
        higgsfield.getStatus(),
        higgsfield.checkCredits(),
        higgsfield.checkWorkspace(),
        higgsfield.listModels({ mediaKind: "image" }),
        higgsfield.listModels({ mediaKind: "video" }),
      ])

      if (status.status === "fulfilled") setCliStatus(status.value)
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

  const activeUploadWorkspace = React.useMemo(
    () =>
      uploadWorkspaces.find(
        (workspace) => workspace.id === activeUploadWorkspaceId,
      ) ??
      uploadWorkspaces[0] ??
      defaultUploadWorkspace,
    [activeUploadWorkspaceId, uploadWorkspaces],
  )

  const uploads = React.useMemo(
    () => ({
      workspaces: uploadWorkspaces,
      activeWorkspace: activeUploadWorkspace,
      activeWorkspaceId: activeUploadWorkspaceId,
      references: referenceLibrary,
      refresh: refreshReferenceLibrary,
      reveal: revealReferenceLibrary,
      importFiles: chooseReferenceAsset,
      deleteReference: deleteReferenceAsset,
      switchWorkspace: setActiveUploadWorkspace,
      createWorkspace: createUploadWorkspace,
      updateWorkspace: updateUploadWorkspace,
      deleteWorkspace: deleteUploadWorkspace,
    }),
    [
      activeUploadWorkspace,
      activeUploadWorkspaceId,
      chooseReferenceAsset,
      createUploadWorkspace,
      deleteReferenceAsset,
      deleteUploadWorkspace,
      referenceLibrary,
      refreshReferenceLibrary,
      revealReferenceLibrary,
      setActiveUploadWorkspace,
      updateUploadWorkspace,
      uploadWorkspaces,
    ],
  )

  const value = React.useMemo<HiggsfieldAppValue>(
    () => ({
      account,
      cliStatus,
      workspace,
      imageModels,
      videoModels,
      creatives,
      videos,
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
      signIn,
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
      creativeById: (id) => creatives.find((creative) => creative.id === id),
    }),
    [
      account,
      cliStatus,
      workspace,
      imageModels,
      videoModels,
      creatives,
      videos,
      uploads,
      customPrompts,
      settings,
      runningJobs,
      videoDraftSource,
      refreshAccount,
      signIn,
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
