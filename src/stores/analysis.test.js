import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { createPinia, setActivePinia } from 'pinia'

const ANALYSIS_STORE_PATH = fileURLToPath(new URL('./analysis.ts', import.meta.url))
const PINIA_MODULE_URL = import.meta.resolve('pinia')
const VUE_MODULE_URL = import.meta.resolve('vue')
const AI_FLOW_MODULE_URL = pathToFileURL(
  fileURLToPath(new URL('../lib/ai-analysis-flow.js', import.meta.url))
).href
const COMPARISON_HISTORY_MODULE_URL = pathToFileURL(
  fileURLToPath(new URL('../lib/comparison-history.js', import.meta.url))
).href

const toDataUrl = (code) => {
  return `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`
}

const TYPES_MODULE_URL = toDataUrl(`
const SHOT_TYPE_MAPPING = {
  oneMotion: 'one_motion',
  onePointFiveMotion: 'one_point_five_motion',
  twoMotion: 'two_motion',
  one_motion: 'one_motion',
  one_point_five_motion: 'one_point_five_motion',
  two_motion: 'two_motion',
  OneMotion: 'one_motion',
  OnePointFiveMotion: 'one_point_five_motion',
  TwoMotion: 'two_motion',
  unknown: 'unknown',
  Unknown: 'unknown'
}

export const normalizeShotType = (type) => {
  if (!type) {
    return 'unknown'
  }

  return SHOT_TYPE_MAPPING[type] ?? 'unknown'
}
`)

const CORE_MODULE_URL = toDataUrl(`
export const invoke = (...args) => globalThis.__analysisStoreTestMocks.invoke(...args)
`)

const EVENT_MODULE_URL = toDataUrl(`
export const listen = (...args) => globalThis.__analysisStoreTestMocks.listen(...args)
`)

const replaceImport = (source, request, replacement) => {
  const escaped = request.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.replace(new RegExp(`(['"])${escaped}\\1`, 'g'), `'${replacement}'`)
}

const createPlayer = (id, name = `Player ${id}`) => ({
  id,
  name,
  team: 'Warriors',
  description: 'template',
  poseData: { keypoints: [], width: 0, height: 0 },
  angles: []
})

const createComparisonResult = (id, overrides = {}) => ({
  player: createPlayer(id, overrides.playerName ?? `Player ${id}`),
  similarity: overrides.similarity ?? 0.91,
  angleDifferences: overrides.angleDifferences ?? [
    { name: 'right_elbow_angle', userValue: 91, playerValue: 88, difference: 3 },
    { name: 'release_angle', userValue: 54, playerValue: 48, difference: 6 },
    { name: 'trunk_tilt', userValue: 8, playerValue: 13, difference: -5 }
  ]
})

const createDetail = (id, overrides = {}) => ({
  result: createComparisonResult(id, overrides.result ?? {}),
  learningBridge: {
    intro: overrides.intro ?? `Learn from player ${id}`,
    gaps: overrides.gaps ?? [
      { title: 'Elbow gap', detail: 'Align the elbow path.' },
      { title: 'Release gap', detail: 'Smooth the release.' }
    ]
  }
})

const createSnapshot = (options = {}) => {
  const playerId = options.playerId ?? 23
  const detail = options.detail ?? createDetail(playerId, options.detailOverrides)
  const summary = {
    player: detail.result.player,
    similarity: detail.result.similarity,
    topDifferences: detail.result.angleDifferences.slice(0, 3),
    matchReason: options.matchReason ?? `${detail.result.player.name} is the closest match.`,
    shotTypeAlignment: null,
    ...(options.summaryOverrides ?? {})
  }

  return {
    analysisKey: options.analysisKey ?? 'analysis-1',
    historyId: options.historyId ?? 9,
    summaries: options.summaries ?? [summary],
    detailsByPlayerId: options.detailsByPlayerId ?? {
      [playerId]: detail
    },
    selectedPlayerId: options.selectedPlayerId ?? playerId,
    selectedDetail: Object.hasOwn(options, 'selectedDetail') ? options.selectedDetail : detail
  }
}

const createAnalysis = (overrides = {}) => ({
  poseData: { keypoints: [], width: 0, height: 0 },
  angles: overrides.angles ?? [],
  shotType: overrides.shotType ?? 'one_motion',
  shotTypeConfidence: overrides.shotTypeConfidence ?? 0.75,
  shotTypeReasons: overrides.shotTypeReasons ?? ['Compact load-up'],
  aiReview: overrides.aiReview ?? null,
  timestamp: overrides.timestamp ?? 1710000000
})

const createHistoryRecord = (overrides = {}) => ({
  id: overrides.id ?? 9,
  imagePath: overrides.imagePath ?? 'image.png',
  annotatedImagePath: overrides.annotatedImagePath ?? 'annotated.png',
  analysis: overrides.analysis ?? createAnalysis(),
  comparison: Object.hasOwn(overrides, 'comparison') ? overrides.comparison : createSnapshot(),
  suggestions: overrides.suggestions ?? [],
  aiCoachingSummary: overrides.aiCoachingSummary ?? null,
  aiCoachingSuggestions: overrides.aiCoachingSuggestions ?? null,
  createdAt: overrides.createdAt ?? 1710000100
})

const loadAnalysisStoreModule = async (options = {}) => {
  const invokeCalls = []
  const listenCalls = []
  globalThis.__analysisStoreTestMocks = {
    invoke: async (command, args) => {
      invokeCalls.push({ command, args })

      if (options.invokeImpl) {
        return options.invokeImpl(command, args)
      }

      if (command === 'draw_pose_on_image') {
        return 'annotated-output'
      }

      if (command === 'analyze_shot') {
        return createAnalysis({ timestamp: 1710000200 })
      }

      return null
    },
    listen: async (eventName, handler) => {
      listenCalls.push({ eventName, handler })
      return async () => {}
    }
  }

  const source = await readFile(ANALYSIS_STORE_PATH, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: ANALYSIS_STORE_PATH
  }).outputText

  const rewritten = [
    ['pinia', PINIA_MODULE_URL],
    ['vue', VUE_MODULE_URL],
    ['@/types', TYPES_MODULE_URL],
    ['@/lib/ai-analysis-flow.js', AI_FLOW_MODULE_URL],
    ['@/lib/comparison-history.js', COMPARISON_HISTORY_MODULE_URL],
    ['@tauri-apps/api/core', CORE_MODULE_URL],
    ['@tauri-apps/api/event', EVENT_MODULE_URL]
  ].reduce((current, [request, replacement]) => replaceImport(current, request, replacement), transpiled)

  const moduleUrl = toDataUrl(`${rewritten}\n//# sourceURL=analysis.test.module.${Date.now()}.${Math.random()}.mjs`)
  const module = await import(moduleUrl)

  return {
    invokeCalls,
    listenCalls,
    useAnalysisStore: module.useAnalysisStore
  }
}

const createStoreHarness = async (options = {}) => {
  setActivePinia(createPinia())
  const loaded = await loadAnalysisStoreModule(options)
  return {
    ...loaded,
    store: loaded.useAnalysisStore()
  }
}

test('analysis progress listener is skipped outside the Tauri runtime', async () => {
  const { listenCalls } = await createStoreHarness()

  assert.equal(listenCalls.length, 0)
})

test('setCurrentHistoryRecord restores both snapshot state and legacy selected comparison', async () => {
  const { store } = await createStoreHarness()
  const snapshot = createSnapshot()

  store.setCurrentHistoryRecord(createHistoryRecord({ comparison: snapshot }))

  assert.equal(store.currentComparisonSnapshot.analysisKey, 'analysis-1')
  assert.equal(store.currentComparisonSnapshot.selectedPlayerId, 23)
  assert.equal(store.currentComparison.player.id, 23)
  assert.equal(store.currentComparison.similarity, snapshot.selectedDetail.result.similarity)
})

test('setCurrentComparison falls back to a legacy snapshot when the player does not belong to current snapshot', async () => {
  const { store } = await createStoreHarness()
  store.setCurrentHistoryRecord(createHistoryRecord({ comparison: createSnapshot({ historyId: 9 }) }))

  store.setCurrentComparison(createComparisonResult(34, { playerName: 'Thompson', similarity: 0.82 }))

  assert.equal(store.currentComparisonSnapshot.analysisKey, 'legacy-history-9-player-34')
  assert.equal(store.currentComparisonSnapshot.summaries.length, 1)
  assert.equal(store.currentComparisonSnapshot.summaries[0].player.id, 34)
  assert.equal(store.currentComparisonSnapshot.selectedDetail.result.player.id, 34)
  assert.equal(store.currentComparison.player.id, 34)
})

test('setCurrentComparison reuses current snapshot only when selected player already exists and updates summary/detail', async () => {
  const { store } = await createStoreHarness()
  const originalSnapshot = createSnapshot({
    analysisKey: 'analysis-stable',
    detailOverrides: {
      result: {
        similarity: 0.61,
        angleDifferences: [
          { name: 'release_angle', userValue: 50, playerValue: 47, difference: 3 }
        ]
      }
    }
  })

  store.setCurrentHistoryRecord(createHistoryRecord({ comparison: originalSnapshot }))

  store.setCurrentComparison(createComparisonResult(23, {
    similarity: 0.97,
    angleDifferences: [
      { name: 'release_angle', userValue: 57, playerValue: 48, difference: 9 }
    ]
  }))

  assert.equal(store.currentComparisonSnapshot.analysisKey, 'analysis-stable')
  assert.equal(store.currentComparisonSnapshot.selectedDetail.result.similarity, 0.97)
  assert.equal(store.currentComparisonSnapshot.summaries[0].similarity, 0.97)
  assert.equal(store.currentComparisonSnapshot.summaries[0].topDifferences[0].difference, 9)
  assert.equal(store.currentComparisonSnapshot.selectedDetail.learningBridge.intro, 'Learn from player 23')
})

test('setCurrentAnalysis and analyzeImage clear currentComparisonSnapshot', async () => {
  const { store } = await createStoreHarness({
    invokeImpl: async (command) => {
      if (command === 'analyze_shot') {
        return createAnalysis({ timestamp: 1710000300 })
      }

      if (command === 'draw_pose_on_image') {
        return 'annotated-image'
      }

      return null
    }
  })

  store.setCurrentHistoryRecord(createHistoryRecord({ comparison: createSnapshot() }))
  store.setCurrentAnalysis(createAnalysis({ timestamp: 1710000400 }))
  assert.equal(store.currentComparisonSnapshot, null)

  store.setCurrentHistoryRecord(createHistoryRecord({ comparison: createSnapshot() }))
  await store.analyzeImage('raw-image-data')
  assert.equal(store.currentComparisonSnapshot, null)
})

test('saveToHistory and updateHistoryComparison send history-safe snapshot payloads', async () => {
  const { store, invokeCalls } = await createStoreHarness()
  const detail = createDetail(23)
  const comparisonWithoutSelectedDetail = createSnapshot({
    historyId: 3,
    analysisKey: 'legacy-history-3-player-23',
    selectedDetail: null,
    detailsByPlayerId: {
      23: detail
    }
  })

  store.setCurrentHistoryRecord(createHistoryRecord({
    id: 9,
    comparison: comparisonWithoutSelectedDetail,
    analysis: createAnalysis({ timestamp: 1710000500 })
  }))

  await store.updateHistoryComparison(9, comparisonWithoutSelectedDetail)
  await store.saveToHistory('image.png', 'annotated.png')

  const updateCall = invokeCalls.find(call => call.command === 'update_analysis_history_comparison')
  const saveCall = invokeCalls.find(call => call.command === 'save_analysis_history')

  assert.ok(updateCall)
  assert.ok(saveCall)
  assert.equal(Object.hasOwn(updateCall.args.comparison, 'historyId'), false)
  assert.equal(updateCall.args.comparison.selectedDetail.result.player.id, 23)
  assert.equal(updateCall.args.comparison.detailsByPlayerId[23].learningBridge.intro, 'Learn from player 23')
  assert.equal(updateCall.args.comparison.analysisKey, 'legacy-history-9-player-23')
  assert.equal(Object.hasOwn(saveCall.args.comparison, 'historyId'), false)
  assert.equal(saveCall.args.comparison.selectedDetail.result.player.id, 23)
  assert.equal(saveCall.args.comparison.selectedPlayerId, 23)
})

test('updateHistoryComparison rebinds stale legacy snapshot key to the target history id', async () => {
  const { store, invokeCalls } = await createStoreHarness()
  const staleSnapshot = createSnapshot({
    historyId: 3,
    analysisKey: 'legacy-history-3-player-23'
  })

  await store.updateHistoryComparison(12, staleSnapshot)

  const updateCall = invokeCalls.find(call => call.command === 'update_analysis_history_comparison')
  assert.ok(updateCall)
  assert.equal(updateCall.args.comparison.analysisKey, 'legacy-history-12-player-23')
  assert.equal(Object.hasOwn(updateCall.args.comparison, 'historyId'), false)
})

test('saveToHistory does not persist stale legacy history ids when the target row id is not known yet', async () => {
  const { store, invokeCalls } = await createStoreHarness()
  store.setCurrentHistoryRecord(createHistoryRecord({
    id: 3,
    comparison: createSnapshot({
      historyId: 3,
      analysisKey: 'legacy-history-3-player-23'
    }),
    analysis: createAnalysis({ timestamp: 1710000600 })
  }))

  await store.saveToHistory('image.png', 'annotated.png')

  const saveCall = invokeCalls.find(call => call.command === 'save_analysis_history')
  assert.ok(saveCall)
  assert.equal(saveCall.args.comparison.analysisKey, 'legacy-player-23')
  assert.equal(Object.hasOwn(saveCall.args.comparison, 'historyId'), false)
})
