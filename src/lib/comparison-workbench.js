export const withTimeout = async (promise, timeoutMs, errorMessage) => {
  let timer = null

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

const comparisonWeights = [
  ['shooting_elbow_angle', 2.6],
  ['right_elbow_angle', 2.4],
  ['left_elbow_angle', 2.4],
  ['release_angle', 2.3],
  ['right_shoulder_angle', 2.1],
  ['left_shoulder_angle', 2.1],
  ['trunk_tilt', 1.6],
  ['right_hip_angle', 1.4],
  ['left_hip_angle', 1.4],
  ['right_knee_angle', 1.3],
  ['left_knee_angle', 1.3],
  ['shoulder_tilt', 1.1]
]

const getKeypoint = (analysis, id) => {
  return analysis.poseData?.keypoints?.find((keypoint) => keypoint.id === id) ?? null
}

const sideScore = (shoulder, wrist, hip) => {
  if (!shoulder || !wrist || !hip) {
    return 0
  }

  const torsoHeight = Math.max(Math.abs(hip.y - shoulder.y), 1)
  const wristLift = Math.max((shoulder.y - wrist.y) / torsoHeight, 0)
  return wristLift + ((shoulder.visibility + wrist.visibility + hip.visibility) / 3) * 0.1
}

const detectShootingSide = (analysis) => {
  const leftScore = sideScore(
    getKeypoint(analysis, 11),
    getKeypoint(analysis, 15),
    getKeypoint(analysis, 23)
  )
  const rightScore = sideScore(
    getKeypoint(analysis, 12),
    getKeypoint(analysis, 16),
    getKeypoint(analysis, 24)
  )

  return leftScore > rightScore ? 'left' : 'right'
}

const canonicalAngleName = (name, dominantSide) => {
  if (dominantSide === 'right') {
    return name
  }

  switch (name) {
    case 'left_elbow_angle':
      return 'right_elbow_angle'
    case 'left_shoulder_angle':
      return 'right_shoulder_angle'
    case 'left_knee_angle':
      return 'right_knee_angle'
    case 'left_hip_angle':
      return 'right_hip_angle'
    default:
      return name
  }
}

export const calculateAngleDifferences = (analysis, player) => {
  const dominantSide = detectShootingSide(analysis)

  return (analysis.angles ?? []).flatMap((userAngle) => {
    const name = canonicalAngleName(userAngle.name, dominantSide)
    const playerAngle = (player.angles ?? []).find((angle) => angle.name === name)

    if (!playerAngle) {
      return []
    }

    return [{
      name,
      userValue: userAngle.value,
      playerValue: playerAngle.value,
      difference: userAngle.value - playerAngle.value
    }]
  })
}

export const calculateWeightedSimilarity = (differences) => {
  if (!differences.length) {
    return 0
  }

  const weightMap = new Map(comparisonWeights)
  const totalWeight = differences.reduce((sum, difference) => {
    return sum + (weightMap.get(difference.name) ?? 1)
  }, 0)

  if (!totalWeight) {
    return 0
  }

  const weightedDiff = differences.reduce((sum, difference) => {
    const weight = weightMap.get(difference.name) ?? 1
    const normalizedDiff = Math.abs(difference.difference) / 180
    return sum + weight * normalizedDiff * normalizedDiff
  }, 0)

  const rmse = Math.sqrt(weightedDiff / totalWeight)
  return Math.max(1 - rmse, 0)
}

export const comparePlayerLocally = ({ analysis, player }) => {
  const angleDifferences = calculateAngleDifferences(analysis, player)
  const similarity = calculateWeightedSimilarity(angleDifferences)

  return {
    player,
    similarity,
    angleDifferences,
    comparisonMode: 'single_frame_fallback'
  }
}

export const buildLocalWorkbench = (analysis, players, getAngleDisplayName = (name) => name) => {
  const comparisons = players
    .map((player) => comparePlayerLocally({ analysis, player }))
    .sort((left, right) => right.similarity - left.similarity || left.player.id - right.player.id)

  return {
    comparisons,
    summaries: buildFallbackSummaries(comparisons, getAngleDisplayName),
    selectedComparison: comparisons[0] ?? null
  }
}

export const sortDifferencesByGap = (differences) => {
  return [...differences].sort((left, right) => {
    const distanceOrder = Math.abs(right.difference) - Math.abs(left.difference)
    if (distanceOrder !== 0) return distanceOrder
    return left.name.localeCompare(right.name)
  })
}

export const buildFallbackMatchReason = (result, getAngleDisplayName = (name) => name) => {
  const closestAngles = [...result.angleDifferences]
    .sort((left, right) => {
      const distanceOrder = Math.abs(left.difference) - Math.abs(right.difference)
      if (distanceOrder !== 0) return distanceOrder
      return left.name.localeCompare(right.name)
    })
    .slice(0, 2)
    .map((difference) => getAngleDisplayName(difference.name))

  if (!closestAngles.length) {
    return `${result.player.name} 是当前最接近的模板。`
  }

  return `${result.player.name} 在 ${closestAngles.join('、')} 上与你更接近。`
}

export const buildFallbackSummary = (result, getAngleDisplayName = (name) => name) => ({
  player: result.player,
  similarity: result.similarity,
  topDifferences: sortDifferencesByGap(result.angleDifferences).slice(0, 3),
  matchReason: buildFallbackMatchReason(result, getAngleDisplayName),
  shotTypeAlignment: null,
  comparisonMode: result.comparisonMode ?? 'single_frame_fallback'
})

export const buildFallbackSummaries = (results, getAngleDisplayName = (name) => name) => {
  return results
    .map((result) => buildFallbackSummary(result, getAngleDisplayName))
    .sort((left, right) => right.similarity - left.similarity)
}

export const resolveFallbackComparisons = async ({
  players,
  analysis,
  comparePlayer,
  timeoutMs
}) => {
  const settled = await Promise.allSettled(
    players.map((player) =>
      withTimeout(
        Promise.resolve(comparePlayer({
          analysis,
          playerId: player.id
        })),
        timeoutMs,
        `compare_with_player ${player.id} timed out`
      )
    )
  )

  return settled
    .filter((item) => item.status === 'fulfilled')
    .map((item) => item.value)
    .sort((left, right) => right.similarity - left.similarity)
}
