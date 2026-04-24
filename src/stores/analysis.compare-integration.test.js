import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'

const COMPARISON_STORE_PATH = fileURLToPath(new URL('./comparison.ts', import.meta.url))
const PINIA_MODULE_URL = import.meta.resolve('pinia')
const VUE_MODULE_URL = import.meta.resolve('vue')
const SESSION_MODULE_URL = pathToFileURL(
  fileURLToPath(new URL('../lib/comparison-session.js', import.meta.url))
).href

const toDataUrl = (code) => {
  return `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`
}

const ANALYSIS_STORE_MODULE_URL = toDataUrl(`
export const useAnalysisStore = () => globalThis.__comparisonStoreTestMocks.analysisStore
`)

const COMPARISON_SERVICE_MODULE_URL = toDataUrl(`
export const comparisonService = {
  buildWorkbench: (...args) => globalThis.__comparisonStoreTestMocks.service.buildWorkbench(...args),
  listenToProgress: (...args) => globalThis.__comparisonStoreTestMocks.service.listenToProgress(...args)
}
`)

const replaceImport = (source, request, replacement) => {
  const escaped = request.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.replace(new RegExp(`(['"])${escaped}\\1`, 'g'), `'${replacement}'`)
}

const sampleAnalysis = () => ({
  poseData: { keypoints: [], width: 0, height: 0 },
  angles: [],
  shotType: 'one_motion',
  shotTypeConfidence: 0.8,
  shotTypeReasons: [],
  aiReview: null,
  timestamp: 1
})

const samplePlayer = (id) => ({
  id,
  name: id === 23 ? 'Curry' : 'Thompson',
  team: 'Warriors',
  description: 'template',
  poseData: { keypoints: [], width: 0, height: 0 },
  angles: []
})

const sampleDetail = (id) => ({
  result: {
    player: samplePlayer(id),
    similarity: id === 23 ? 0.95 : 0.87,
    angleDifferences: []
  },
  learningBridge: {
    intro: `Learn from ${id}`,
    gaps: []
  }
})

const sampleSnapshot = (analysisKey = 'analysis-1', overrides = {}) => {
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
      {
        player: samplePlayer(firstPlayerId),
        similarity: 0.95,
        topDifferences: [],
        matchReason: 'Closest',
        shotTypeAlignment: null
      },
      {
        player: samplePlayer(secondPlayerId),
        similarity: 0.87,
        topDifferences: [],
        matchReason: 'Second',
        shotTypeAlignment: null
      }
    ],
    detailsByPlayerId,
    selectedPlayerId,
    selectedDetail:
      overrides.selectedDetail === undefined
        ? detailsByPlayerId[selectedPlayerId]
        : overrides.selectedDetail
  }
}

const sampleIdentity = (overrides = {}) => ({
  source: 'video-frame',
  sessionId: 'session-1',
  videoPath: 'video.mp4',
  frameIndex: 3,
  historyId: 9,
  analysisKey: 'analysis-1',
  ...overrides
})

const loadComparisonStoreModule = async () => {
  const source = await readFile(COMPARISON_STORE_PATH, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: COMPARISON_STORE_PATH
  }).outputText

  const rewritten = [
    ['pinia', PINIA_MODULE_URL],
    ['vue', VUE_MODULE_URL],
    ['@/stores/analysis', ANALYSIS_STORE_MODULE_URL],
    ['@/lib/comparison-service', COMPARISON_SERVICE_MODULE_URL],
    ['@/lib/comparison-session.js', SESSION_MODULE_URL]
  ].reduce((current, [request, replacement]) => replaceImport(current, request, replacement), transpiled)

  return import(toDataUrl(`${rewritten}\n//# sourceURL=comparison.store.test.${Date.now()}.${Math.random()}.mjs`))
}

const createHarness = async (options = {}) => {
  const persistCalls = []
  const progressHandlers = []
  const analysisStore = {
    currentHistoryId: options.currentHistoryId ?? 9,
    currentVideoPath: options.currentVideoPath ?? 'video.mp4',
    currentVideoFrameIndex: options.currentVideoFrameIndex ?? 3,
    updateHistoryComparison: async (historyId, snapshot) => {
      persistCalls.push({ historyId, snapshot })
    }
  }
  const service = {
    buildWorkbench: options.buildWorkbench ?? (async ({ identity }) => {
      options.beforeResolve?.(analysisStore)
      return options.snapshot ?? sampleSnapshot(identity.analysisKey)
    }),
    listenToProgress: async (handler) => {
      progressHandlers.push(handler)
      return async () => {}
    }
  }

  globalThis.__comparisonStoreTestMocks = { analysisStore, service }
  setActivePinia(createPinia())
  const module = await loadComparisonStoreModule()

  return {
    ...module,
    analysisStore,
    persistCalls,
    progressHandlers,
    store: module.useComparisonStore()
  }
}

test('shouldPersistComparisonSnapshot requires history, analysis key, and video frame identity to match', async () => {
  const { shouldPersistComparisonSnapshot } = await createHarness()
  const identity = sampleIdentity()
  const snapshot = sampleSnapshot(identity.analysisKey)

  assert.equal(shouldPersistComparisonSnapshot({
    identity,
    snapshot,
    analysisBridge: {
      currentHistoryId: 9,
      currentVideoPath: 'video.mp4',
      currentVideoFrameIndex: 3
    }
  }), true)

  assert.equal(shouldPersistComparisonSnapshot({
    identity,
    snapshot,
    analysisBridge: {
      currentHistoryId: 9,
      currentVideoPath: 'video.mp4',
      currentVideoFrameIndex: 4
    }
  }), false)
})

test('ensureWorkbench persists ready snapshot only while the active analysis bridge still matches', async () => {
  const { store, persistCalls } = await createHarness()

  await store.ensureWorkbench({
    surfaceId: 'analysis-tab',
    identity: sampleIdentity(),
    analysis: sampleAnalysis()
  })

  assert.equal(store.status, 'ready')
  assert.equal(persistCalls.length, 1)
  assert.equal(persistCalls[0].historyId, 9)
  assert.equal(persistCalls[0].snapshot.selectedDetail.result.player.id, 23)
})

test('ensureWorkbench skips persistence when the frame changes before the backend resolves', async () => {
  const { store, persistCalls } = await createHarness({
    beforeResolve: (analysisStore) => {
      analysisStore.currentVideoFrameIndex = 4
    }
  })

  await store.ensureWorkbench({
    surfaceId: 'analysis-tab',
    identity: sampleIdentity(),
    analysis: sampleAnalysis()
  })

  assert.equal(store.status, 'ready')
  assert.equal(persistCalls.length, 0)
})

test('selectPlayer persists the atomically switched selected detail when identity still matches', async () => {
  const { store, persistCalls } = await createHarness()

  await store.ensureWorkbench({
    surfaceId: 'analysis-tab',
    identity: sampleIdentity(),
    analysis: sampleAnalysis()
  })
  await store.selectPlayer(34)

  assert.equal(store.selectedPlayerId, 34)
  assert.equal(store.selectedDetail.result.player.id, 34)
  assert.equal(persistCalls.length, 2)
  assert.equal(persistCalls[1].snapshot.selectedPlayerId, 34)
  assert.equal(persistCalls[1].snapshot.selectedDetail.result.player.id, 34)
})

test('refreshWorkbench bypasses cached comparison data and rebuilds from the latest templates', async () => {
  let callCount = 0
  const { store } = await createHarness({
    buildWorkbench: async ({ identity }) => {
      callCount += 1
      return sampleSnapshot(identity.analysisKey, {
        firstPlayerId: callCount === 1 ? 23 : 56,
        secondPlayerId: callCount === 1 ? 34 : 23
      })
    }
  })

  await store.ensureWorkbench({
    surfaceId: 'analysis-tab',
    identity: sampleIdentity(),
    analysis: sampleAnalysis()
  })
  await store.ensureWorkbench({
    surfaceId: 'analysis-tab',
    identity: sampleIdentity(),
    analysis: sampleAnalysis()
  })

  assert.equal(callCount, 1)
  assert.equal(store.selectedPlayerId, 23)

  await store.refreshWorkbench()

  assert.equal(callCount, 2)
  assert.equal(store.selectedPlayerId, 56)
})

test('ensureWorkbench starts and clears the timeout ticker for pending work', async () => {
  const originalSetInterval = globalThis.setInterval
  const originalClearInterval = globalThis.clearInterval
  const originalSetTimeout = globalThis.setTimeout
  const intervals = []
  const cleared = []

  globalThis.setInterval = (handler, delay) => {
    intervals.push({ handler, delay })
    return 42
  }
  globalThis.clearInterval = (id) => {
    cleared.push(id)
  }

  try {
    const { store } = await createHarness({
      buildWorkbench: () => new Promise(() => {})
    })

    void store.ensureWorkbench({
      surfaceId: 'analysis-tab',
      identity: sampleIdentity(),
      analysis: sampleAnalysis()
    })
    await Promise.resolve()
    await Promise.resolve()
    await new Promise(resolve => originalSetTimeout(resolve, 0))

    assert.equal(intervals.length, 1)
    assert.equal(intervals[0].delay, 1_000)

    store.releaseSurface('analysis-tab')
    assert.deepEqual(cleared, [42])
  } finally {
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
  }
})
