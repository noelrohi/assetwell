import * as React from "react"
import { toast } from "sonner"
import type {
  AssetwellBrand,
  AssetwellBrandState,
  AssetwellBrandView,
  AssetwellLibrarySnapshot,
  AssetwellPromptKind,
  AssetwellSettings,
  HiggsfieldAccountStatus,
  HiggsfieldCliStatus,
  HiggsfieldCommandOutputEvent,
  HiggsfieldUploadedAsset,
  HiggsfieldWorkspaceContext,
} from "@assetwell/desktop-bridge"

import {
  imageModels as fallbackImageModels,
  videoModels as fallbackVideoModels,
} from "@/lib/mock-data"

import {
  HIGGSFIELD_UPLOADS_PAGE_SIZE,
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
import {
  UNSORTED_BRAND_SCOPE_ID,
  isInBrandView,
  useUploadsLibrary,
} from "./uploads-library"
import {
  applyUploadFolderAssignments,
  useUploadFolders,
} from "./upload-folders"
import { toModelOptions } from "./higgsfield/model-options"
import { useHiggsfieldSignInAttempt } from "./higgsfield/sign-in-attempt"
import { friendlyError, friendlyExit, titleFromPrompt } from "./higgsfield/text"
import type {
  BrandsDomain,
  Creative,
  HiggsfieldAppValue,
  ModelOption,
  PendingRun,
  PromptPreset,
  ReferenceAsset,
  UploadsDomain,
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

const DEFAULT_BRAND_ID = "brand-default"
const DEFAULT_BRAND_NAME = "Default brand"

const fallbackBrandState: AssetwellBrandState = {
  brands: [{ id: DEFAULT_BRAND_ID, name: DEFAULT_BRAND_NAME, isDefault: true }],
  activeBrandId: null,
  activeBrandView: "all",
  assignments: [],
}

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
  const [brandState, setBrandState] =
    React.useState<AssetwellBrandState>(fallbackBrandState)
  const [localStateReady, setLocalStateReady] = React.useState(!libraryBridge)
  const [runningJobs, setRunningJobs] = React.useState(0)
  const [videoDraftSource, setVideoDraftSource] =
    React.useState<VideoSource | null>(null)
  const {
    uploads: localUploads,
    applyUploadsSnapshot,
    restorePersistedReferences,
  } = useUploadsLibrary(libraryBridge)
  const uploadFolders = useUploadFolders(libraryBridge)
  const localReferenceLibrary = localUploads.references
  const [remoteUploadReferences, setRemoteUploadReferences] = React.useState<
    ReferenceAsset[]
  >([])
  const [remoteUploadsCursor, setRemoteUploadsCursor] = React.useState<
    string | null
  >(null)
  const [remoteUploadsLoadingMore, setRemoteUploadsLoadingMore] =
    React.useState(false)

  const brandIds = React.useMemo(
    () => new Set(brandState.brands.map((brand) => brand.id)),
    [brandState.brands],
  )
  const folderIds = React.useMemo(
    () => new Set(uploadFolders.folders.map((folder) => folder.id)),
    [uploadFolders.folders],
  )
  const activeBrand = React.useMemo(
    () =>
      brandState.activeBrandId
        ? (brandState.brands.find(
            (brand) => brand.id === brandState.activeBrandId,
          ) ?? null)
        : null,
    [brandState.activeBrandId, brandState.brands],
  )
  const activeBrandLabel = brandViewLabel(
    brandState.activeBrandView,
    activeBrand,
  )
  const activeBrandScopeId = activeBrand?.id ?? UNSORTED_BRAND_SCOPE_ID
  const hasRemoteUploads = Boolean(bridge && workspace)

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

    try {
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
    } catch {
      setAccount(null)
      setWorkspace(null)
    }
  }, [bridge])

  const { clearSignInAttempt, startSignInAttempt } = useHiggsfieldSignInAttempt(
    {
      cliStatus,
      refreshSession,
    },
  )

  const setActiveBrandView = React.useCallback(
    async (view: AssetwellBrandView, id: string | null = null) => {
      if (!libraryBridge) {
        setBrandState((current) => setLocalActiveBrand(current, view, id))
        return true
      }

      try {
        setBrandState(await libraryBridge.setActiveBrand({ view, id }))
        return true
      } catch (error) {
        toast("Could not switch brand", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [libraryBridge],
  )

  const createBrand = React.useCallback(
    async (name: string) => {
      if (!libraryBridge) {
        setBrandState((current) => createLocalBrand(current, name))
        toast(`Switched to ${name}`)
        return true
      }

      try {
        const state = await libraryBridge.createBrand({ name })
        setBrandState(state)
        const created = state.activeBrandId
          ? state.brands.find((brand) => brand.id === state.activeBrandId)
          : null
        toast(`Switched to ${created?.name ?? name}`)
        return true
      } catch (error) {
        toast("Could not create brand", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [libraryBridge],
  )

  const updateBrand = React.useCallback(
    async (id: string, name: string) => {
      if (!libraryBridge) {
        setBrandState((current) => updateLocalBrand(current, id, name))
        toast("Brand renamed")
        return true
      }

      try {
        setBrandState(await libraryBridge.updateBrand({ id, name }))
        toast("Brand renamed")
        return true
      } catch (error) {
        toast("Could not rename brand", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [libraryBridge],
  )

  const saveUploadBrandAssignments = React.useCallback(
    async (uploadIds: string[], brandId: string | null, announce = true) => {
      const uniqueUploadIds = uniqueStrings(uploadIds)
      if (uniqueUploadIds.length === 0) return true

      if (!libraryBridge) {
        setBrandState((current) =>
          assignLocalUploadsToBrand(current, uniqueUploadIds, brandId),
        )
        if (announce) {
          toast(
            uploadMoveMessage(
              uniqueUploadIds.length,
              brandState.brands,
              brandId,
            ),
          )
        }
        return true
      }

      try {
        const state = await libraryBridge.assignUploadsToBrand({
          uploadIds: uniqueUploadIds,
          brandId,
        })
        setBrandState(state)
        if (announce) {
          toast(
            uploadMoveMessage(uniqueUploadIds.length, state.brands, brandId),
          )
        }
        return true
      } catch (error) {
        toast("Could not move uploads", {
          description: friendlyError(error),
        })
        return false
      }
    },
    [brandState.brands, libraryBridge],
  )

  const brands = React.useMemo<BrandsDomain>(
    () => ({
      brands: brandState.brands,
      activeBrand,
      activeBrandId: activeBrand?.id ?? null,
      view: brandState.activeBrandView,
      activeLabel: activeBrandLabel,
      setActiveBrand: setActiveBrandView,
      createBrand,
      updateBrand,
      assignUploads: (uploadIds, brandId) =>
        saveUploadBrandAssignments(uploadIds, brandId, true),
    }),
    [
      activeBrand,
      activeBrandLabel,
      brandState.activeBrandView,
      brandState.brands,
      createBrand,
      saveUploadBrandAssignments,
      setActiveBrandView,
      updateBrand,
    ],
  )

  const refreshHiggsfieldUploads = React.useCallback(async () => {
    if (!hasRemoteUploads || !bridge) {
      setRemoteUploadsCursor(null)
      setRemoteUploadsLoadingMore(false)
      await localUploads.refresh()
      return
    }

    try {
      const result = await bridge.listUploads({
        mediaKind: "image",
        size: HIGGSFIELD_UPLOADS_PAGE_SIZE,
      })
      setRemoteUploadReferences(result.items.map(uploadToReferenceAsset))
      setRemoteUploadsCursor(result.cursor)
    } catch (error) {
      toast("Could not refresh Higgsfield uploads", {
        description: friendlyError(error),
      })
    }
  }, [bridge, hasRemoteUploads, localUploads.refresh])

  const loadMoreHiggsfieldUploads = React.useCallback(async () => {
    if (
      !bridge ||
      !hasRemoteUploads ||
      !remoteUploadsCursor ||
      remoteUploadsLoadingMore
    ) {
      return
    }

    setRemoteUploadsLoadingMore(true)
    try {
      const result = await bridge.listUploads({
        mediaKind: "image",
        size: HIGGSFIELD_UPLOADS_PAGE_SIZE,
        cursor: remoteUploadsCursor,
      })
      setRemoteUploadReferences((current) =>
        appendUploadReferences(
          current,
          result.items.map(uploadToReferenceAsset),
        ),
      )
      setRemoteUploadsCursor(result.cursor)
    } catch (error) {
      toast("Could not load more Higgsfield uploads", {
        description: friendlyError(error),
      })
    } finally {
      setRemoteUploadsLoadingMore(false)
    }
  }, [bridge, hasRemoteUploads, remoteUploadsCursor, remoteUploadsLoadingMore])

  const importHiggsfieldUploads = React.useCallback(async () => {
    if (!bridge || !hasRemoteUploads) {
      await localUploads.importFiles()
      return
    }

    try {
      const selections = await bridge.chooseAssets("image")
      if (selections.length === 0) return

      const results = await Promise.allSettled(
        selections.map((asset) =>
          bridge.createUpload({
            filePath: asset.filePath,
          }),
        ),
      )
      const uploaded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      )
      const failed = results.find((result) => result.status === "rejected")

      if (uploaded.length > 0 && activeBrand) {
        await saveUploadBrandAssignments(
          uploaded.map((upload) => upload.uploadId),
          activeBrand.id,
          false,
        )
      }

      if (uploaded.length > 0) {
        const message = `Added ${uploaded.length} shared upload${
          uploaded.length === 1 ? "" : "s"
        }`
        if (activeBrand) {
          toast(message, { description: `Assigned to ${activeBrand.name}.` })
        } else {
          toast(message)
        }
      }
      if (failed) {
        toast(
          uploaded.length > 0
            ? "Some files could not be uploaded"
            : "Could not add files to Uploads",
          {
            description: friendlyError(failed.reason),
          },
        )
      }

      if (uploaded.length > 0) {
        await refreshHiggsfieldUploads()
      }
    } catch (error) {
      toast("Could not add files to Uploads", {
        description: friendlyError(error),
      })
    }
  }, [
    activeBrand,
    bridge,
    hasRemoteUploads,
    localUploads,
    refreshHiggsfieldUploads,
    saveUploadBrandAssignments,
  ])

  const revealHiggsfieldUploads = React.useCallback(async () => {
    toast("Shared Higgsfield uploads do not have a local folder", {
      description: "Assetwell organizes them locally by brand metadata.",
    })
  }, [])

  const assignedRemoteUploadReferences = React.useMemo(
    () =>
      applyUploadFolderAssignments(
        applyUploadBrandAssignments(
          remoteUploadReferences,
          brandState.assignments,
          brandIds,
        ),
        uploadFolders.assignments,
        folderIds,
      ),
    [
      brandIds,
      brandState.assignments,
      folderIds,
      remoteUploadReferences,
      uploadFolders.assignments,
    ],
  )
  const activeRemoteUploadReferences = React.useMemo(
    () =>
      assignedRemoteUploadReferences.filter((reference) =>
        isReferenceInBrandView(
          reference,
          brandState.activeBrandView,
          brandState.activeBrandId,
          brandIds,
        ),
      ),
    [
      assignedRemoteUploadReferences,
      brandIds,
      brandState.activeBrandId,
      brandState.activeBrandView,
    ],
  )
  const assignedLocalReferences = React.useMemo(
    () =>
      applyUploadFolderAssignments(
        applyUploadBrandAssignments(
          localUploads.references,
          brandState.assignments,
          brandIds,
        ),
        uploadFolders.assignments,
        folderIds,
      ),
    [
      brandIds,
      brandState.assignments,
      folderIds,
      localUploads.references,
      uploadFolders.assignments,
    ],
  )
  const activeLocalReferences = React.useMemo(
    () =>
      assignedLocalReferences.filter((reference) =>
        isReferenceInBrandView(
          reference,
          brandState.activeBrandView,
          brandState.activeBrandId,
          brandIds,
        ),
      ),
    [
      assignedLocalReferences,
      brandIds,
      brandState.activeBrandId,
      brandState.activeBrandView,
    ],
  )
  const activeUploadReferences = hasRemoteUploads
    ? activeRemoteUploadReferences
    : activeLocalReferences
  const brandWorkspaces = React.useMemo(
    () => brandState.brands.map(brandToUploadWorkspace),
    [brandState.brands],
  )
  const activeBrandWorkspace = React.useMemo(
    () => ({
      id: activeBrandScopeId,
      name: activeBrandLabel,
      isDefault: !activeBrand,
    }),
    [activeBrand, activeBrandLabel, activeBrandScopeId],
  )

  const appUploads = React.useMemo<UploadsDomain>(
    () => ({
      ...localUploads,
      workspaces: brandWorkspaces,
      activeWorkspace: activeBrandWorkspace,
      activeWorkspaceId: activeBrandScopeId,
      references: activeUploadReferences,
      refresh: hasRemoteUploads
        ? refreshHiggsfieldUploads
        : localUploads.refresh,
      loadMore: hasRemoteUploads
        ? loadMoreHiggsfieldUploads
        : localUploads.loadMore,
      reveal: hasRemoteUploads ? revealHiggsfieldUploads : localUploads.reveal,
      importFiles: hasRemoteUploads
        ? importHiggsfieldUploads
        : localUploads.importFiles,
      hasMore: hasRemoteUploads && remoteUploadsCursor !== null,
      loadingMore: hasRemoteUploads && remoteUploadsLoadingMore,
      canRevealReferences:
        !hasRemoteUploads && localUploads.canRevealReferences,
      isRemote: hasRemoteUploads,
      switchWorkspace: (id) => setActiveBrandView("brand", id),
      createWorkspace: createBrand,
      updateWorkspace: updateBrand,
      deleteWorkspace: async () => false,
    }),
    [
      activeBrandScopeId,
      activeBrandWorkspace,
      activeUploadReferences,
      brandWorkspaces,
      createBrand,
      hasRemoteUploads,
      importHiggsfieldUploads,
      loadMoreHiggsfieldUploads,
      localUploads,
      refreshHiggsfieldUploads,
      remoteUploadsCursor,
      remoteUploadsLoadingMore,
      revealHiggsfieldUploads,
      setActiveBrandView,
      updateBrand,
    ],
  )
  const activeReferenceLibrary = appUploads.references
  const activeUploadWorkspaceId = activeBrandScopeId
  const visibleCreatives = React.useMemo(
    () =>
      creatives.filter((creative) =>
        isInBrandView(
          creative,
          brandState.activeBrandView,
          brandState.activeBrandId,
          brandIds,
        ),
      ),
    [brandIds, brandState.activeBrandId, brandState.activeBrandView, creatives],
  )
  const visibleVideos = React.useMemo(
    () =>
      videos.filter((video) =>
        isInBrandView(
          video,
          brandState.activeBrandView,
          brandState.activeBrandId,
          brandIds,
        ),
      ),
    [brandIds, brandState.activeBrandId, brandState.activeBrandView, videos],
  )
  const refreshUploads = appUploads.refresh

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
    startSignInAttempt()
    try {
      const run = await bridge.signIn()
      signInRun.current = run.runId
      toast("Higgsfield sign-in opened")
    } catch (error) {
      clearSignInAttempt()
      toast("Could not start Higgsfield sign-in", {
        description: friendlyError(error),
      })
    }
  }, [bridge, clearSignInAttempt, startSignInAttempt])

  const signOut = React.useCallback(async () => {
    if (!bridge) return
    try {
      clearSignInAttempt()
      const run = await bridge.signOut()
      signOutRun.current = run.runId
      markSignedOut()
      toast("Signed out of Higgsfield")
    } catch (error) {
      toast("Could not sign out of Higgsfield", {
        description: friendlyError(error),
      })
    }
  }, [bridge, clearSignInAttempt, markSignedOut])

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
      width: asset.width,
      height: asset.height,
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
    referenceLibrary: activeReferenceLibrary,
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
    const library = libraryBridge

    async function load() {
      if (library) {
        const [snapshot, storedSettings, uploadsSnapshot, storedBrandState] =
          await Promise.allSettled([
            library.loadSnapshot(),
            library.getSettings(),
            library.loadUploadsSnapshot(),
            library.loadBrandState(),
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
        if (storedBrandState.status === "fulfilled") {
          setBrandState(storedBrandState.value)
        }
        setLocalStateReady(true)
      }

      await refreshSession()
    }

    void load()
  }, [
    applyUploadsSnapshot,
    bridge,
    libraryBridge,
    refreshSession,
    restoreSnapshot,
  ])

  React.useEffect(() => {
    if (!hasRemoteUploads) {
      setRemoteUploadReferences([])
      setRemoteUploadsCursor(null)
      setRemoteUploadsLoadingMore(false)
      return
    }

    setRemoteUploadReferences([])
    setRemoteUploadsCursor(null)
    setRemoteUploadsLoadingMore(false)
    void refreshHiggsfieldUploads()
  }, [hasRemoteUploads, refreshHiggsfieldUploads])

  React.useEffect(() => {
    if (!bridge) return

    return bridge.onCommandOutput((event) => {
      if (event.runId === signInRun.current && event.kind === "exit") {
        signInRun.current = null
        void refreshSession()
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
      localReferenceLibrary,
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
    localReferenceLibrary,
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
      uploads: appUploads,
      brands,
      folders: uploadFolders,
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
      appUploads,
      brands,
      uploadFolders,
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

function brandViewLabel(
  view: AssetwellBrandView,
  activeBrand: AssetwellBrand | null,
) {
  if (view === "brand") return activeBrand?.name ?? "Brand"
  if (view === "unsorted") return "Unsorted"
  return "All brands"
}

function brandToUploadWorkspace(brand: AssetwellBrand) {
  return {
    id: brand.id,
    name: brand.name,
    isDefault: Boolean(brand.isDefault),
  }
}

function isReferenceInBrandView(
  reference: ReferenceAsset,
  view: AssetwellBrandView,
  activeBrandId: string | null,
  brandIds: ReadonlySet<string>,
) {
  if (view === "all") return true

  const brandId =
    reference.brandId && brandIds.has(reference.brandId)
      ? reference.brandId
      : null
  if (view === "unsorted") return brandId === null

  return Boolean(activeBrandId && brandId === activeBrandId)
}

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

function setLocalActiveBrand(
  current: AssetwellBrandState,
  view: AssetwellBrandView,
  id: string | null,
): AssetwellBrandState {
  if (view !== "brand") {
    return { ...current, activeBrandView: view, activeBrandId: null }
  }

  const brand = id ? current.brands.find((item) => item.id === id) : null
  return brand
    ? { ...current, activeBrandView: "brand", activeBrandId: brand.id }
    : current
}

function createLocalBrand(
  current: AssetwellBrandState,
  rawName: string,
): AssetwellBrandState {
  const name = normalizeLocalBrandName(rawName) ?? "New brand"
  const brand = {
    id: dedupeLocalBrandId(localBrandIdFromName(name), current.brands),
    name,
    isDefault: false,
  }

  return {
    ...current,
    brands: [...current.brands, brand],
    activeBrandView: "brand",
    activeBrandId: brand.id,
  }
}

function updateLocalBrand(
  current: AssetwellBrandState,
  id: string,
  rawName: string,
): AssetwellBrandState {
  const name = normalizeLocalBrandName(rawName)
  if (!name) return current

  return {
    ...current,
    brands: current.brands.map((brand) =>
      brand.id === id ? { ...brand, name } : brand,
    ),
  }
}

function assignLocalUploadsToBrand(
  current: AssetwellBrandState,
  uploadIds: string[],
  brandId: string | null,
): AssetwellBrandState {
  const assignments = new Map(
    current.assignments.map((assignment) => [
      assignment.uploadId,
      assignment.brandId,
    ]),
  )
  for (const uploadId of uploadIds) assignments.set(uploadId, brandId)

  return {
    ...current,
    assignments: Array.from(assignments, ([uploadId, assignedBrandId]) => ({
      uploadId,
      brandId: assignedBrandId,
    })),
  }
}

function uploadMoveMessage(
  count: number,
  brands: AssetwellBrand[],
  brandId: string | null,
) {
  const target = brandId
    ? (brands.find((brand) => brand.id === brandId)?.name ?? "brand")
    : "Unsorted"
  return `Moved ${count} upload${count === 1 ? "" : "s"} to ${target}`
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  )
}

function normalizeLocalBrandName(value: string) {
  const name = value.trim().replace(/\s+/g, " ").slice(0, 80).trim()
  return name || null
}

function localBrandIdFromName(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!slug) return `brand-${Date.now()}`
  return slug.startsWith("brand-") ? slug : `brand-${slug}`
}

function dedupeLocalBrandId(id: string, brands: AssetwellBrand[]) {
  let index = 1
  let candidate = id
  while (brands.some((brand) => brand.id === candidate)) {
    index += 1
    candidate = `${id}-${index}`
  }
  return candidate
}

function uploadToReferenceAsset(
  upload: HiggsfieldUploadedAsset,
): ReferenceAsset {
  return {
    id: upload.id,
    name: upload.name,
    url: upload.url,
    uploadId: upload.uploadId,
    mediaKind: upload.mediaKind,
    createdAt: upload.createdAt,
    modifiedAt: upload.createdAt,
    sizeBytes: upload.sizeBytes ?? null,
    source: "higgsfield",
  }
}

function appendUploadReferences(
  current: ReferenceAsset[],
  additions: ReferenceAsset[],
) {
  const seen = new Set<string>()
  for (const asset of current) {
    for (const key of uploadReferenceKeys(asset)) seen.add(key)
  }

  const merged = [...current]
  for (const asset of additions) {
    const keys = uploadReferenceKeys(asset)
    if (keys.some((key) => seen.has(key))) continue

    merged.push(asset)
    for (const key of keys) seen.add(key)
  }

  return merged
}

function uploadReferenceKeys(asset: ReferenceAsset) {
  return asset.uploadId && asset.uploadId !== asset.id
    ? [asset.id, asset.uploadId]
    : [asset.id]
}

function getDesktopBridge() {
  return typeof window === "undefined" ? undefined : window.assetwell
}
