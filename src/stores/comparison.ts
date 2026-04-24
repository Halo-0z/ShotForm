import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useAnalysisStore } from '@/stores/analysis'
import {
  comparisonService,
  type ComparisonIdentity,
  type ComparisonService
} from '@/lib/comparison-service'
import {
  createComparisonSessionController,
  type ComparisonSessionState
} from '@/lib/comparison-session.js'
import type { ComparisonWorkbenchSnapshot, PlayerTemplateProfile, ShotAnalysis } from '@/types'

export interface AnalysisComparisonBridge {
  currentHistoryId: number | null
  currentVideoPath?: string
  currentVideoFrameIndex?: number
}

export interface EnsureWorkbenchInput {
  surfaceId: string
  identity: ComparisonIdentity
  analysis: ShotAnalysis
  analysisProfile?: PlayerTemplateProfile | null
  forceRefresh?: boolean
}

export const shouldPersistComparisonSnapshot = ({
  identity,
  snapshot,
  analysisBridge
}: {
  identity: ComparisonIdentity | null | undefined
  snapshot: ComparisonWorkbenchSnapshot | null | undefined
  analysisBridge: AnalysisComparisonBridge
}) => {
  if (!identity || !snapshot?.selectedDetail) {
    return false
  }

  const historyId = identity.historyId ?? null
  if (historyId == null || analysisBridge.currentHistoryId !== historyId) {
    return false
  }

  if (snapshot.analysisKey !== identity.analysisKey) {
    return false
  }

  if (identity.source === 'video-frame') {
    if ((identity.videoPath ?? '') !== (analysisBridge.currentVideoPath ?? '')) {
      return false
    }

    if ((identity.frameIndex ?? null) !== (analysisBridge.currentVideoFrameIndex ?? null)) {
      return false
    }
  }

  return true
}

let comparisonServiceFactory = (): ComparisonService => comparisonService

export const configureComparisonStoreService = (
  factory: (() => ComparisonService) | null
) => {
  comparisonServiceFactory = factory ?? (() => comparisonService)
}

const errorMessageFromUnknown = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error || '球星对比加载失败，请重试。')
}

const WORKING_STATUSES = new Set([
  'preparing',
  'loading_templates',
  'validating_templates',
  'ranking_players',
  'building_default_detail'
])

export const useComparisonStore = defineStore('comparison', () => {
  const analysisStore = useAnalysisStore()
  const service = comparisonServiceFactory()
  const controller = createComparisonSessionController()
  const sessionState = ref<ComparisonSessionState>(controller.getState())
  const activeSurfaceId = ref<string | null>(null)
  const lastInput = ref<EnsureWorkbenchInput | null>(null)

  let progressUnlisten: (() => void) | null = null
  let progressListenerPromise: Promise<void> | null = null
  let timeoutTicker: ReturnType<typeof setInterval> | null = null

  const stopTimeoutTicker = () => {
    if (!timeoutTicker) {
      return
    }

    clearInterval(timeoutTicker)
    timeoutTicker = null
  }

  const startTimeoutTicker = () => {
    if (timeoutTicker) {
      return
    }

    timeoutTicker = setInterval(() => {
      const changed = controller.tick()
      if (changed) {
        syncState()
      }
    }, 1_000)
  }

  const syncState = () => {
    const nextState = controller.getState()
    sessionState.value = nextState

    if (WORKING_STATUSES.has(nextState.status)) {
      startTimeoutTicker()
    } else {
      stopTimeoutTicker()
    }
  }

  const ensureProgressListener = async () => {
    if (progressListenerPromise) {
      return progressListenerPromise
    }

    progressListenerPromise = service.listenToProgress(event => {
      controller.acceptProgress(event)
      syncState()
    }).then(unlisten => {
      progressUnlisten = unlisten
    })

    return progressListenerPromise
  }

  const stopProgressListener = async () => {
    if (progressUnlisten) {
      await progressUnlisten()
    }

    progressUnlisten = null
    progressListenerPromise = null
    stopTimeoutTicker()
  }

  const persistSnapshotIfCurrent = async (
    identity: ComparisonIdentity | null | undefined,
    snapshot: ComparisonWorkbenchSnapshot | null | undefined
  ) => {
    if (!shouldPersistComparisonSnapshot({
      identity,
      snapshot,
      analysisBridge: {
        currentHistoryId: analysisStore.currentHistoryId,
        currentVideoPath: analysisStore.currentVideoPath,
        currentVideoFrameIndex: analysisStore.currentVideoFrameIndex
      }
    })) {
      return
    }

    const historyId = identity?.historyId
    if (historyId == null || !snapshot) {
      return
    }

    await analysisStore.updateHistoryComparison(historyId, snapshot)
  }

  const claimSurface = (surfaceId: string) => {
    activeSurfaceId.value = surfaceId
  }

  const releaseSurface = (surfaceId: string) => {
    if (activeSurfaceId.value !== surfaceId) {
      return
    }

    activeSurfaceId.value = null
    stopTimeoutTicker()
    void stopProgressListener()
  }

  const ensureWorkbench = async (input: EnsureWorkbenchInput) => {
    claimSurface(input.surfaceId)
    lastInput.value = input
    await ensureProgressListener()

    const request = controller.startRequest(input.identity, {
      bypassCache: Boolean(input.forceRefresh)
    })
    syncState()

    if (request.restoredFromCache) {
      return sessionState.value
    }

    try {
      const snapshot = await service.buildWorkbench({
        requestId: request.requestId,
        identity: input.identity,
        analysis: input.analysis,
        analysisProfile: input.analysisProfile ?? null
      })

      if (activeSurfaceId.value !== input.surfaceId) {
        return sessionState.value
      }

      controller.completeRequest(request.requestId, snapshot)
      syncState()
      await persistSnapshotIfCurrent(input.identity, sessionState.value.snapshot)
      return sessionState.value
    } catch (error) {
      controller.failRequest(request.requestId, {
        analysisKey: input.identity.analysisKey,
        message: errorMessageFromUnknown(error)
      })
      syncState()
      return sessionState.value
    }
  }

  const retry = async () => {
    if (!lastInput.value) {
      return sessionState.value
    }

    return ensureWorkbench(lastInput.value)
  }

  const refreshWorkbench = async () => {
    if (!lastInput.value) {
      return sessionState.value
    }

    return ensureWorkbench({
      ...lastInput.value,
      forceRefresh: true
    })
  }

  const selectPlayer = async (playerId: number) => {
    const selected = controller.selectPlayer(playerId)
    syncState()

    if (selected) {
      await persistSnapshotIfCurrent(sessionState.value.identity, sessionState.value.snapshot)
    }

    return selected
  }

  const tick = (currentTime?: number) => {
    const changed = controller.tick(currentTime)
    if (changed) {
      syncState()
    }

    return changed
  }

  return {
    activeSurfaceId,
    sessionState,
    status: computed(() => sessionState.value.status),
    progress: computed(() => sessionState.value.progress),
    rankedSummaries: computed(() => sessionState.value.rankedSummaries),
    selectedPlayerId: computed(() => sessionState.value.selectedPlayerId),
    selectedDetail: computed(() => sessionState.value.selectedDetail),
    errorMessage: computed(() => sessionState.value.errorMessage),
    canRetry: computed(() => sessionState.value.canRetry),
    claimSurface,
    releaseSurface,
    ensureWorkbench,
    retry,
    refreshWorkbench,
    selectPlayer,
    tick
  }
})
