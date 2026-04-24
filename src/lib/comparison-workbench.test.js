import test from 'node:test'
import assert from 'node:assert/strict'

const importComparisonWorkbench = async () => {
  try {
    return await import('./comparison-workbench.js')
  } catch (error) {
    assert.fail(`comparison workbench helper missing: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const makeResult = (playerId, similarity, differences = []) => ({
  player: {
    id: playerId,
    name: `Player ${playerId}`,
    team: `Team ${playerId}`,
    description: `Description ${playerId}`,
    poseData: { keypoints: [], width: 0, height: 0 },
    angles: []
  },
  similarity,
  angleDifferences: differences
})

test('resolveFallbackComparisons keeps successful player comparisons when one request fails or times out', async () => {
  const { resolveFallbackComparisons } = await importComparisonWorkbench()

  const players = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const never = new Promise(() => {})

  const results = await resolveFallbackComparisons({
    players,
    analysis: { id: 'analysis' },
    timeoutMs: 10,
    comparePlayer: async ({ playerId }) => {
      if (playerId === 1) return makeResult(1, 0.91)
      if (playerId === 2) throw new Error('template failed')
      return never
    }
  })

  assert.equal(results.length, 1)
  assert.equal(results[0]?.player.id, 1)
})

test('resolveFallbackComparisons sorts successful results by similarity descending', async () => {
  const { resolveFallbackComparisons } = await importComparisonWorkbench()

  const players = [{ id: 1 }, { id: 2 }, { id: 3 }]

  const results = await resolveFallbackComparisons({
    players,
    analysis: { id: 'analysis' },
    timeoutMs: 10,
    comparePlayer: async ({ playerId }) => {
      if (playerId === 1) return makeResult(1, 0.72)
      if (playerId === 2) return makeResult(2, 0.96)
      return makeResult(3, 0.81)
    }
  })

  assert.deepEqual(
    results.map(result => result.player.id),
    [2, 3, 1]
  )
})

test('buildFallbackSummaries keeps the largest angle gaps at the top of each summary', async () => {
  const { buildFallbackSummaries } = await importComparisonWorkbench()

  const summaries = buildFallbackSummaries(
    [
      makeResult(1, 0.88, [
        { name: 'trunk_tilt', userValue: 10, playerValue: 3, difference: 7 },
        { name: 'right_elbow_angle', userValue: 91, playerValue: 90, difference: 1 },
        { name: 'release_angle', userValue: 70, playerValue: 60, difference: 10 },
        { name: 'right_knee_angle', userValue: 120, playerValue: 118, difference: 2 }
      ])
    ],
    name => name
  )

  assert.equal(summaries.length, 1)
  assert.deepEqual(
    summaries[0]?.topDifferences.map(item => item.name),
    ['release_angle', 'trunk_tilt', 'right_knee_angle']
  )
})

test('comparePlayerLocally computes a higher similarity for smaller angle gaps', async () => {
  const { comparePlayerLocally } = await importComparisonWorkbench()

  const analysis = {
    shotType: 'one_motion',
    poseData: {
      keypoints: [
        { id: 11, x: 0, y: 20, visibility: 1 },
        { id: 15, x: 0, y: 5, visibility: 1 },
        { id: 23, x: 0, y: 40, visibility: 1 },
        { id: 12, x: 20, y: 20, visibility: 1 },
        { id: 16, x: 20, y: 30, visibility: 1 },
        { id: 24, x: 20, y: 40, visibility: 1 }
      ]
    },
    angles: [
      { name: 'left_elbow_angle', value: 90 },
      { name: 'release_angle', value: 70 },
      { name: 'trunk_tilt', value: 8 }
    ]
  }

  const nearPlayer = {
    id: 1,
    name: 'Near',
    team: 'A',
    description: '',
    poseData: { keypoints: [], width: 0, height: 0 },
    angles: [
      { name: 'right_elbow_angle', value: 89 },
      { name: 'release_angle', value: 69 },
      { name: 'trunk_tilt', value: 7 }
    ]
  }

  const farPlayer = {
    ...nearPlayer,
    id: 2,
    name: 'Far',
    angles: [
      { name: 'right_elbow_angle', value: 120 },
      { name: 'release_angle', value: 30 },
      { name: 'trunk_tilt', value: 25 }
    ]
  }

  const nearResult = comparePlayerLocally({ analysis, player: nearPlayer })
  const farResult = comparePlayerLocally({ analysis, player: farPlayer })

  assert.ok(nearResult.similarity > farResult.similarity)
  assert.equal(nearResult.angleDifferences[0]?.name, 'right_elbow_angle')
})

test('buildLocalWorkbench returns summaries sorted by local similarity descending', async () => {
  const { buildLocalWorkbench } = await importComparisonWorkbench()

  const analysis = {
    shotType: 'one_motion',
    poseData: {
      keypoints: [
        { id: 12, x: 20, y: 20, visibility: 1 },
        { id: 16, x: 20, y: 5, visibility: 1 },
        { id: 24, x: 20, y: 40, visibility: 1 }
      ]
    },
    angles: [
      { name: 'right_elbow_angle', value: 90 },
      { name: 'release_angle', value: 70 }
    ]
  }

  const players = [
    makeResult(1, 0.1).player,
    makeResult(2, 0.1).player,
    makeResult(3, 0.1).player
  ]

  players[0].angles = [
    { name: 'right_elbow_angle', value: 120 },
    { name: 'release_angle', value: 20 }
  ]
  players[1].angles = [
    { name: 'right_elbow_angle', value: 89 },
    { name: 'release_angle', value: 69 }
  ]
  players[2].angles = [
    { name: 'right_elbow_angle', value: 95 },
    { name: 'release_angle', value: 74 }
  ]

  const workbench = buildLocalWorkbench(analysis, players, (name) => name)

  assert.deepEqual(
    workbench.summaries.map((summary) => summary.player.id),
    [2, 3, 1]
  )
  assert.equal(workbench.selectedComparison?.player.id, 2)
})
