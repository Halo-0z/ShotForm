import test from 'node:test'
import assert from 'node:assert/strict'
import { createComparisonSessionController } from './comparison-session.js'
import { STAGE_TIMEOUT_MS, TOTAL_TIMEOUT_MS } from './comparison-progress.js'

const samplePlayer = (id) => ({
  id,
  name: id === 23 ? 'Curry' : 'Thompson',
  team: 'Warriors',
  description: 'template',
  poseData: { keypoints: [], width: 0, height: 0 },
  angles: []
})

const sampleSummary = (id) => ({
  player: samplePlayer(id),
  similarity: id === 23 ? 0.95 : 0.88,
  topDifferences: [],
  matchReason: `Player ${id} match`,
  shotTypeAlignment: null
})

const sampleDetail = (id) => ({
  result: {
    player: samplePlayer(id),
    similarity: id === 23 ? 0.95 : 0.88,
    angleDifferences: []
  },
  learningBridge: {
    intro: `Learn from ${id}`,
    gaps: [
      { title: 'Gap 1', detail: 'Detail 1' }
    ]
  }
})

const sampleIdentity = (analysisKey, overrides = {}) => ({
  source: 'video-frame',
  sessionId: overrides.sessionId ?? 'session-1',
  videoPath: overrides.videoPath ?? 'videos/shot.mp4',
  frameIndex: overrides.frameIndex ?? 3,
  historyId: overrides.historyId ?? null,
  analysisKey,
  ...overrides
})

const sampleSnapshot = (analysisKey, overrides = {}) => {
  const firstPlayerId = overrides.firstPlayerId ?? 23
  const secondPlayerId = overrides.secondPlayerId ?? 34
  const selectedPlayerId = overrides.selectedPlayerId ?? firstPlayerId
  const detailsByPlayerId = overrides.detailsByPlayerId ?? {
    [firstPlayerId]: sampleDetail(firstPlayerId),
    [secondPlayerId]: sampleDetail(secondPlayerId)
  }

  return {
    analysisKey,
    summaries: overrides.summaries ?? [
      sampleSummary(firstPlayerId),
      sampleSummary(secondPlayerId)
    ],
    detailsByPlayerId,
    selectedPlayerId,
    selectedDetail:
      overrides.selectedDetail === undefined
        ? detailsByPlayerId[selectedPlayerId]
        : overrides.selectedDetail,
    ...overrides
  }
}

test('late success from a superseded request is ignored', () => {
  const controller = createComparisonSessionController()
  const first = controller.startRequest(sampleIdentity('analysis-1'))
  const second = controller.startRequest(sampleIdentity('analysis-2'))

  controller.completeRequest(first.requestId, sampleSnapshot('analysis-1'))
  controller.completeRequest(second.requestId, sampleSnapshot('analysis-2'))

  const state = controller.getState()
  assert.equal(state.status, 'ready')
  assert.equal(state.analysisKey, 'analysis-2')
  assert.equal(state.selectedDetail.result.player.id, 23)
})

test('cached ready state restores only when the full identity matches', () => {
  const controller = createComparisonSessionController()
  const matchingIdentity = sampleIdentity('analysis-1', {
    sessionId: 'session-a',
    frameIndex: 7
  })
  const mismatchedIdentity = sampleIdentity('analysis-1', {
    sessionId: 'session-a',
    frameIndex: 8
  })

  controller.cacheReady(sampleSnapshot('analysis-1'), matchingIdentity)

  const restored = controller.startRequest(matchingIdentity)
  assert.equal(restored.restoredFromCache, true)
  assert.equal(controller.getState().status, 'ready')

  const next = controller.startRequest(mismatchedIdentity)
  assert.equal(next.restoredFromCache, false)
  assert.equal(controller.getState().status, 'preparing')
})

test('startRequest can bypass cached ready state for manual refresh', () => {
  const controller = createComparisonSessionController()
  const identity = sampleIdentity('analysis-refresh', {
    sessionId: 'session-refresh',
    frameIndex: 7
  })

  controller.cacheReady(sampleSnapshot('analysis-refresh'), identity)

  const refreshed = controller.startRequest(identity, { bypassCache: true })

  assert.equal(refreshed.restoredFromCache, false)
  assert.equal(controller.getState().status, 'preparing')
  assert.equal(controller.getState().analysisKey, 'analysis-refresh')
})

test('completeRequest transitions to empty when no detail payload is available', () => {
  const controller = createComparisonSessionController()
  const pending = controller.startRequest(sampleIdentity('analysis-empty'))

  controller.completeRequest(pending.requestId, sampleSnapshot('analysis-empty', {
    summaries: [],
    detailsByPlayerId: {},
    selectedPlayerId: null,
    selectedDetail: null
  }))

  const state = controller.getState()
  assert.equal(state.status, 'empty')
  assert.equal(state.progress.stage, 'empty')
  assert.equal(state.progress.percent, 100)
  assert.equal(state.rankedSummaries.length, 0)
})

test('failRequest transitions to a retryable error state', () => {
  const controller = createComparisonSessionController()
  const pending = controller.startRequest(sampleIdentity('analysis-error'))

  controller.failRequest(pending.requestId, {
    analysisKey: 'analysis-error',
    message: 'Template load failed',
    stage: 'failed',
    percent: 25
  })

  const state = controller.getState()
  assert.equal(state.status, 'error')
  assert.equal(state.canRetry, true)
  assert.equal(state.errorMessage, 'Template load failed')
  assert.equal(state.progress.stage, 'failed')
  assert.equal(state.progress.percent, 25)
})

test('terminal ready progress does not mark data ready before snapshot completion', () => {
  const controller = createComparisonSessionController()
  const pending = controller.startRequest(sampleIdentity('analysis-progress-ready'))

  controller.acceptProgress({
    requestId: pending.requestId,
    analysisKey: 'analysis-progress-ready',
    stage: 'ready',
    percent: 100,
    message: 'Ready event arrived before invoke result'
  })

  const state = controller.getState()
  assert.equal(state.status, 'preparing')
  assert.equal(state.progress.stage, 'ready')
  assert.equal(state.selectedDetail, null)
})

test('tick converts stage and total timeout overruns into error state', () => {
  const controller = createComparisonSessionController({
    now: () => 1_000
  })

  const first = controller.startRequest(sampleIdentity('analysis-stage-timeout'))
  controller.tick(first.startedAt + STAGE_TIMEOUT_MS)
  assert.equal(controller.getState().status, 'error')
  assert.equal(controller.getState().canRetry, true)

  const second = controller.startRequest(sampleIdentity('analysis-total-timeout'))
  controller.acceptProgress({
    requestId: second.requestId,
    analysisKey: 'analysis-total-timeout',
    stage: 'loading_templates',
    percent: 25,
    message: 'Loading'
  })
  controller.tick(second.startedAt + TOTAL_TIMEOUT_MS)

  assert.equal(controller.getState().status, 'error')
  assert.equal(controller.getState().analysisKey, 'analysis-total-timeout')
})

test('late success from a timed out request is ignored', () => {
  const controller = createComparisonSessionController({
    now: () => 1_000
  })
  const pending = controller.startRequest(sampleIdentity('analysis-timeout'))

  controller.tick(pending.startedAt + STAGE_TIMEOUT_MS)
  const accepted = controller.completeRequest(pending.requestId, sampleSnapshot('analysis-timeout'))

  const state = controller.getState()
  assert.equal(accepted, false)
  assert.equal(state.status, 'error')
  assert.equal(state.selectedDetail, null)
})

test('selectPlayer commits selection and detail atomically from precomputed details', () => {
  const controller = createComparisonSessionController()
  controller.hydrateReady(
    sampleSnapshot('analysis-ready', {
      selectedPlayerId: 23,
      selectedDetail: sampleDetail(23)
    }),
    sampleIdentity('analysis-ready')
  )

  controller.selectPlayer(34)

  const state = controller.getState()
  assert.equal(state.selectedPlayerId, 34)
  assert.equal(state.selectedDetail.result.player.id, 34)
  assert.equal(state.status, 'ready')
})
