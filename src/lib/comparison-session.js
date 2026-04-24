import {
  acceptProgressEvent,
  createProgressState,
  shouldStageTimeout,
  shouldTotalTimeout
} from './comparison-progress.js'

const clone = (value) => {
  if (value === null || value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

const normalizeNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

const normalizeIdentity = (identity = {}) => ({
  source: identity.source ?? 'image',
  sessionId: identity.sessionId ?? '',
  videoPath: identity.videoPath ?? '',
  frameIndex: normalizeNullableNumber(identity.frameIndex),
  historyId: normalizeNullableNumber(identity.historyId),
  analysisKey: identity.analysisKey ?? '',
  profileKey: identity.profileKey ?? ''
})

const identityKey = (identity) => {
  const normalized = normalizeIdentity(identity)
  return JSON.stringify([
    normalized.source,
    normalized.sessionId,
    normalized.videoPath,
    normalized.frameIndex,
    normalized.historyId,
    normalized.analysisKey,
    normalized.profileKey
  ])
}

const detailForPlayer = (detailsByPlayerId, playerId) => {
  if (playerId === null || playerId === undefined) {
    return null
  }

  return detailsByPlayerId?.[playerId] ?? detailsByPlayerId?.[String(playerId)] ?? null
}

const createIdleState = () => ({
  status: 'idle',
  requestId: null,
  startedAt: 0,
  identity: null,
  analysisKey: '',
  progress: createProgressState(),
  rankedSummaries: [],
  detailsByPlayerId: {},
  selectedPlayerId: null,
  selectedDetail: null,
  snapshot: null,
  errorMessage: '',
  canRetry: false
})

const resolveSelectedPlayerId = (snapshot) => {
  return (
    snapshot.selectedPlayerId ??
    snapshot.selectedDetail?.result?.player?.id ??
    snapshot.summaries?.[0]?.player?.id ??
    null
  )
}

const buildReadyState = ({
  baseState,
  snapshot,
  identity,
  requestId,
  startedAt,
  updatedAt
}) => {
  const detailsByPlayerId = snapshot.detailsByPlayerId ?? {}
  const selectedPlayerId = resolveSelectedPlayerId(snapshot)
  const selectedDetail =
    snapshot.selectedDetail ?? detailForPlayer(detailsByPlayerId, selectedPlayerId)
  const hasDetail = Boolean(selectedDetail)
  const status = hasDetail ? 'ready' : 'empty'
  const terminalStage = hasDetail ? 'ready' : 'empty'

  return {
    ...baseState,
    status,
    requestId,
    startedAt,
    identity: clone(identity),
    analysisKey: snapshot.analysisKey ?? identity?.analysisKey ?? '',
    progress: createProgressState({
      requestId,
      analysisKey: snapshot.analysisKey ?? identity?.analysisKey ?? '',
      stage: terminalStage,
      percent: 100,
      message: hasDetail ? '球星对比工作台已准备完成。' : '当前没有可用模板。',
      updatedAt
    }),
    rankedSummaries: clone(snapshot.summaries ?? []),
    detailsByPlayerId: clone(detailsByPlayerId),
    selectedPlayerId: hasDetail ? selectedPlayerId : null,
    selectedDetail: hasDetail ? clone(selectedDetail) : null,
    snapshot: clone(snapshot),
    errorMessage: '',
    canRetry: false
  }
}

const isTerminalStatus = (status) => {
  return status === 'ready' || status === 'empty' || status === 'error'
}

export const createComparisonSessionController = (options = {}) => {
  const now = options.now ?? (() => Date.now())
  const readyCache = new Map()
  let sequence = 0
  let state = createIdleState()

  const isActiveRequest = (requestId, analysisKey = null) => {
    if (isTerminalStatus(state.status)) {
      return false
    }

    if (!requestId || requestId !== state.requestId) {
      return false
    }

    if (analysisKey && state.analysisKey && analysisKey !== state.analysisKey) {
      return false
    }

    return true
  }

  const cacheSnapshot = (snapshot, identity) => {
    const selectedPlayerId = resolveSelectedPlayerId(snapshot)
    const selectedDetail =
      snapshot.selectedDetail ?? detailForPlayer(snapshot.detailsByPlayerId, selectedPlayerId)

    if (!selectedDetail) {
      return
    }

    readyCache.set(identityKey(identity), {
      snapshot: clone(snapshot),
      identity: clone(normalizeIdentity(identity))
    })
  }

  const hydrateSnapshot = (snapshot, identity, requestId = state.requestId) => {
    const normalizedIdentity = normalizeIdentity({
      ...(identity ?? state.identity ?? {}),
      analysisKey: snapshot.analysisKey ?? identity?.analysisKey ?? state.analysisKey
    })
    const nextState = buildReadyState({
      baseState: state,
      snapshot,
      identity: normalizedIdentity,
      requestId,
      startedAt: state.startedAt,
      updatedAt: now()
    })

    state = nextState
    if (state.status === 'ready') {
      cacheSnapshot(snapshot, normalizedIdentity)
    }

    return state.status === 'ready'
  }

  return {
    startRequest(identity, options = {}) {
      const normalizedIdentity = normalizeIdentity(identity)
      const requestId = `compare-${++sequence}`
      const startedAt = now()
      const cached = options.bypassCache
        ? null
        : readyCache.get(identityKey(normalizedIdentity))

      if (cached) {
        state = buildReadyState({
          baseState: createIdleState(),
          snapshot: cached.snapshot,
          identity: normalizedIdentity,
          requestId,
          startedAt,
          updatedAt: startedAt
        })

        return { requestId, startedAt, restoredFromCache: true }
      }

      state = {
        ...createIdleState(),
        status: 'preparing',
        requestId,
        startedAt,
        identity: clone(normalizedIdentity),
        analysisKey: normalizedIdentity.analysisKey,
        progress: createProgressState({
          requestId,
          analysisKey: normalizedIdentity.analysisKey,
          stage: 'preparing',
          percent: 5,
          message: '正在准备球星对比工作台...',
          updatedAt: startedAt
        })
      }

      return { requestId, startedAt, restoredFromCache: false }
    },

    acceptProgress(event) {
      if (isTerminalStatus(state.status)) {
        return false
      }

      const eventWithTime = {
        ...event,
        updatedAt: event.updatedAt ?? now()
      }
      const progress = acceptProgressEvent(state.progress, eventWithTime, {
        requestId: state.requestId,
        analysisKey: state.analysisKey
      })

      if (progress === state.progress) {
        return false
      }

      const isErrorProgress = progress.stage === 'failed' || progress.stage === 'error'
      const isDataTerminalProgress = progress.stage === 'ready' || progress.stage === 'empty'

      state = {
        ...state,
        status: isErrorProgress
          ? 'error'
          : isDataTerminalProgress
            ? state.status
            : progress.stage,
        progress,
        errorMessage: isErrorProgress
          ? progress.message
          : state.errorMessage,
        canRetry: isErrorProgress
          ? true
          : state.canRetry
      }

      return true
    },

    completeRequest(requestId, snapshot) {
      if (!isActiveRequest(requestId, snapshot?.analysisKey)) {
        return false
      }

      return hydrateSnapshot(snapshot, state.identity, requestId)
    },

    failRequest(requestId, error = {}) {
      if (!isActiveRequest(requestId, error.analysisKey)) {
        return false
      }

      const message = error.message ?? '球星对比加载失败，请重试。'
      const progress = acceptProgressEvent(
        state.progress,
        {
          requestId,
          analysisKey: error.analysisKey ?? state.analysisKey,
          stage: error.stage ?? 'failed',
          percent: error.percent ?? state.progress.percent,
          message,
          updatedAt: error.updatedAt ?? now()
        },
        {
          requestId: state.requestId,
          analysisKey: state.analysisKey
        }
      )

      state = {
        ...state,
        status: 'error',
        progress,
        errorMessage: message,
        canRetry: true
      }

      return true
    },

    tick(currentTime = now()) {
      if (
        state.status === 'idle' ||
        state.status === 'ready' ||
        state.status === 'empty' ||
        state.status === 'error'
      ) {
        return false
      }

      if (
        shouldStageTimeout(state.progress, currentTime) ||
        shouldTotalTimeout(state.startedAt, currentTime)
      ) {
        state = {
          ...state,
          status: 'error',
          progress: createProgressState({
            ...state.progress,
            stage: 'failed',
            message: '球星对比加载超时，请重试。',
            updatedAt: currentTime
          }),
          errorMessage: '球星对比加载超时，请重试。',
          canRetry: true
        }
        return true
      }

      return false
    },

    selectPlayer(playerId) {
      if (state.status !== 'ready') {
        return false
      }

      const nextDetail = detailForPlayer(state.detailsByPlayerId, playerId)
      if (!nextDetail) {
        return false
      }

      const nextSnapshot = {
        ...(state.snapshot ?? {}),
        selectedPlayerId: playerId,
        selectedDetail: clone(nextDetail)
      }

      state = {
        ...state,
        selectedPlayerId: playerId,
        selectedDetail: clone(nextDetail),
        snapshot: nextSnapshot
      }

      if (state.identity) {
        cacheSnapshot(nextSnapshot, state.identity)
      }

      return true
    },

    hydrateReady(snapshot, identity = null) {
      return hydrateSnapshot(snapshot, identity)
    },

    cacheReady(snapshot, identity) {
      cacheSnapshot(snapshot, normalizeIdentity(identity))
    },

    getState() {
      return clone(state)
    }
  }
}
