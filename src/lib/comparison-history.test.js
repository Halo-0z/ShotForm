import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHistoryComparisonPayload,
  isSameHistorySnapshotIdentity,
  wrapLegacyComparisonResult
} from './comparison-history.js'

const samplePlayer = (id = 23) => ({
  id,
  name: id === 23 ? 'Curry' : 'Thompson',
  team: 'Warriors',
  description: 'template',
  poseData: { keypoints: [], width: 0, height: 0 },
  angles: []
})

const sampleResult = (id = 23) => ({
  player: samplePlayer(id),
  similarity: 0.91,
  angleDifferences: [
    { name: 'right_elbow_angle', userValue: 91, playerValue: 88, difference: 3 },
    { name: 'release_angle', userValue: 54, playerValue: 48, difference: 6 },
    { name: 'trunk_tilt', userValue: 8, playerValue: 13, difference: -5 }
  ]
})

const sampleDetail = (id = 23) => ({
  result: sampleResult(id),
  learningBridge: {
    intro: `Learn from player ${id}`,
    gaps: [
      { title: 'Elbow gap', detail: 'Align the elbow path.' },
      { title: 'Release gap', detail: 'Smooth the release.' },
      { title: 'Trunk gap', detail: 'Stabilize posture.' }
    ]
  }
})

const sampleSnapshot = () => ({
  analysisKey: 'analysis-1',
  historyId: 9,
  summaries: [
    {
      player: samplePlayer(23),
      similarity: 0.91,
      topDifferences: sampleResult(23).angleDifferences.slice(0, 3),
      matchReason: 'Curry is the closest match.',
      shotTypeAlignment: null
    }
  ],
  detailsByPlayerId: {
    23: sampleDetail(23)
  },
  selectedPlayerId: 23,
  selectedDetail: sampleDetail(23)
})

test('buildHistoryComparisonPayload keeps selected player, summaries, and learning bridge content', () => {
  const payload = buildHistoryComparisonPayload(sampleSnapshot())

  assert.equal(payload.selectedPlayerId, 23)
  assert.equal(payload.summaries.length, 1)
  assert.equal(payload.selectedDetail.learningBridge.gaps.length, 3)
  assert.equal(payload.detailsByPlayerId[23].learningBridge.gaps[1].title, 'Release gap')
  assert.equal(Object.hasOwn(payload, 'historyId'), false)
})

test('buildHistoryComparisonPayload falls back to detailsByPlayerId when selectedDetail is missing', () => {
  const payload = buildHistoryComparisonPayload({
    ...sampleSnapshot(),
    selectedDetail: null
  })

  assert.equal(payload.selectedPlayerId, 23)
  assert.equal(payload.selectedDetail.result.player.id, 23)
  assert.equal(payload.selectedDetail.learningBridge.intro, 'Learn from player 23')
})

test('buildHistoryComparisonPayload rebinds stale legacy history keys to the target history id', () => {
  const payload = buildHistoryComparisonPayload({
    ...sampleSnapshot(),
    analysisKey: 'legacy-history-3-player-23'
  }, { historyId: 11 })

  assert.equal(payload.analysisKey, 'legacy-history-11-player-23')
})

test('buildHistoryComparisonPayload strips stale legacy history id when no target history id is provided', () => {
  const payload = buildHistoryComparisonPayload({
    ...sampleSnapshot(),
    analysisKey: 'legacy-history-3-player-23'
  }, { historyId: null })

  assert.equal(payload.analysisKey, 'legacy-player-23')
})

test('wrapLegacyComparisonResult creates a one-player snapshot fallback preserving selected player', () => {
  const snapshot = wrapLegacyComparisonResult(sampleResult(34), { historyId: 17 })

  assert.equal(snapshot.summaries.length, 1)
  assert.equal(snapshot.selectedPlayerId, snapshot.selectedDetail.result.player.id)
  assert.equal(snapshot.detailsByPlayerId[34].result.player.name, 'Thompson')
  assert.equal(snapshot.analysisKey, 'legacy-history-17-player-34')
  assert.equal(snapshot.historyId, 17)
  assert.ok(snapshot.summaries[0].matchReason.length > 0)
  assert.ok(snapshot.selectedDetail.learningBridge.gaps.length > 0)
})

test('isSameHistorySnapshotIdentity requires strict historyId match when caller provides it', () => {
  const snapshot = sampleSnapshot()

  assert.equal(
    isSameHistorySnapshotIdentity(snapshot, { historyId: 9, analysisKey: 'analysis-1' }),
    true
  )
  assert.equal(
    isSameHistorySnapshotIdentity(snapshot, { historyId: 8, analysisKey: 'analysis-1' }),
    false
  )
  assert.equal(
    isSameHistorySnapshotIdentity(snapshot, { historyId: 9, analysisKey: 'analysis-2' }),
    false
  )
  assert.equal(
    isSameHistorySnapshotIdentity(
      { ...snapshot, historyId: undefined },
      { historyId: 8, analysisKey: 'analysis-1' }
    ),
    false
  )
  assert.equal(
    isSameHistorySnapshotIdentity(
      { ...snapshot, historyId: undefined },
      { analysisKey: 'analysis-1' }
    ),
    true
  )
})
