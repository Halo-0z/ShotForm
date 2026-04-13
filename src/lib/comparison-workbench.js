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
  shotTypeAlignment: null
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
