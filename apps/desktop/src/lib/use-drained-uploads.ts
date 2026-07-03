import * as React from "react"

import type { UploadsDomain } from "./higgsfield/types"

export const MAX_UPLOAD_DRAIN_ITERATIONS = 200

export type UploadDrainDecision =
  | { action: "drain" }
  | { action: "wait" }
  | {
      action: "stop"
      reason: "complete" | "stopped" | "no-progress" | "max-iterations"
    }

export interface UploadDrainDecisionInput {
  hasMore: boolean
  loadingMore: boolean
  requestInFlight: boolean
  currentLength: number
  previousLength: number | null
  stoppedAtLength: number | null
  iterationCount: number
  maxIterations?: number
}

export function getUploadDrainDecision({
  hasMore,
  loadingMore,
  requestInFlight,
  currentLength,
  previousLength,
  stoppedAtLength,
  iterationCount,
  maxIterations = MAX_UPLOAD_DRAIN_ITERATIONS,
}: UploadDrainDecisionInput): UploadDrainDecision {
  if (!hasMore) return { action: "stop", reason: "complete" }
  if (loadingMore || requestInFlight) return { action: "wait" }

  if (stoppedAtLength !== null && currentLength === stoppedAtLength) {
    return { action: "stop", reason: "stopped" }
  }

  if (previousLength !== null && currentLength <= previousLength) {
    return { action: "stop", reason: "no-progress" }
  }

  if (iterationCount >= maxIterations) {
    return { action: "stop", reason: "max-iterations" }
  }

  return { action: "drain" }
}

export interface UseDrainedUploadsResult {
  isDraining: boolean
  resetDrain: () => void
}

export function useDrainedUploads(
  uploads: Pick<
    UploadsDomain,
    "references" | "hasMore" | "loadingMore" | "loadMore" | "isRemote"
  >,
  maxIterations = MAX_UPLOAD_DRAIN_ITERATIONS,
): UseDrainedUploadsResult {
  const currentLength = uploads.references.length
  const [stoppedAtLength, setStoppedAtLength] = React.useState<number | null>(
    null,
  )
  const [, rerenderAfterRequest] = React.useReducer(
    (value: number) => value + 1,
    0,
  )
  const previousLengthRef = React.useRef<number | null>(null)
  const iterationCountRef = React.useRef(0)
  const requestInFlightRef = React.useRef(false)
  const mountedRef = React.useRef(false)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const resetDrain = React.useCallback(() => {
    previousLengthRef.current = null
    iterationCountRef.current = 0
    requestInFlightRef.current = false
    setStoppedAtLength(null)
    rerenderAfterRequest()
  }, [])

  React.useEffect(() => {
    if (!uploads.isRemote) {
      previousLengthRef.current = null
      iterationCountRef.current = 0
      requestInFlightRef.current = false
      if (stoppedAtLength !== null) setStoppedAtLength(null)
      return
    }

    if (stoppedAtLength !== null && currentLength !== stoppedAtLength) {
      previousLengthRef.current = null
      iterationCountRef.current = 0
      setStoppedAtLength(null)
      return
    }

    const decision = getUploadDrainDecision({
      hasMore: uploads.hasMore,
      loadingMore: uploads.loadingMore,
      requestInFlight: requestInFlightRef.current,
      currentLength,
      previousLength: previousLengthRef.current,
      stoppedAtLength,
      iterationCount: iterationCountRef.current,
      maxIterations,
    })

    if (decision.action === "wait") return

    if (decision.action === "stop") {
      previousLengthRef.current = null

      if (decision.reason === "complete") {
        iterationCountRef.current = 0
        if (stoppedAtLength !== null) setStoppedAtLength(null)
      } else if (stoppedAtLength !== currentLength) {
        setStoppedAtLength(currentLength)
      }

      return
    }

    iterationCountRef.current += 1
    previousLengthRef.current = currentLength
    requestInFlightRef.current = true

    // This drain belongs in the Higgsfield provider once the pending sign-in
    // WIP lands. It lives at the page edge for now so we do not touch
    // apps/desktop/src/lib/higgsfield.tsx while that work is in flight.
    void uploads
      .loadMore()
      .catch(() => undefined)
      .finally(() => {
        requestInFlightRef.current = false
        if (mountedRef.current) rerenderAfterRequest()
      })
  }, [
    currentLength,
    maxIterations,
    stoppedAtLength,
    uploads.hasMore,
    uploads.isRemote,
    uploads.loadMore,
    uploads.loadingMore,
  ])

  const isStoppedAtCurrentLength =
    stoppedAtLength !== null && stoppedAtLength === currentLength

  return {
    isDraining:
      uploads.isRemote &&
      (uploads.loadingMore ||
        requestInFlightRef.current ||
        (uploads.hasMore && !isStoppedAtCurrentLength)),
    resetDrain,
  }
}
