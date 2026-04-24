const cloneJsonSafe = (value) => {
  if (value == null) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

const sortDifferencesByGap = (differences = []) => {
  return [...differences].sort((left, right) => {
    const distanceOrder = Math.abs(right.difference ?? 0) - Math.abs(left.difference ?? 0)
    if (distanceOrder !== 0) return distanceOrder
    return String(left.name ?? '').localeCompare(String(right.name ?? ''))
  })
}

const buildLegacyLearningGaps = (result) => {
  const gaps = sortDifferencesByGap(result?.angleDifferences).slice(0, 3).map((difference) => ({
    title: `${difference.name} differs by ${Math.abs(difference.difference ?? 0).toFixed(1)} degrees`,
    detail: 'Use this restored angle gap as the first correction checkpoint.'
  }))

  if (gaps.length) {
    return gaps
  }

  return [{
    title: 'Legacy comparison detail',
    detail: "Review the restored selected player's stored comparison result."
  }]
}

const getDetailByPlayerId = (detailsByPlayerId, playerId) => {
  if (!detailsByPlayerId || playerId == null) {
    return null
  }

  return detailsByPlayerId[playerId] ?? detailsByPlayerId[String(playerId)] ?? null
}

const buildLegacyAnalysisKey = (playerId, historyId) => {
  if (historyId == null) {
    return `legacy-player-${playerId}`
  }

  return `legacy-history-${historyId}-player-${playerId}`
}

const LEGACY_HISTORY_KEY_PATTERN = /^legacy-history-\d+-player-(\d+)$/
const LEGACY_PLAYER_KEY_PATTERN = /^legacy-player-(\d+)$/

const isLegacyAnalysisKey = (analysisKey = '') => {
  return LEGACY_HISTORY_KEY_PATTERN.test(analysisKey) || LEGACY_PLAYER_KEY_PATTERN.test(analysisKey)
}

const rebindLegacyAnalysisKey = (analysisKey, selectedPlayerId, historyId) => {
  if (!isLegacyAnalysisKey(analysisKey) || selectedPlayerId == null) {
    return analysisKey ?? ''
  }

  return buildLegacyAnalysisKey(selectedPlayerId, historyId)
}

export const wrapLegacyComparisonResult = (legacyResult, options = {}) => {
  if (!legacyResult) {
    return null
  }

  const { historyId } = options
  const result = {
    comparisonMode: 'single_frame_fallback',
    ...cloneJsonSafe(legacyResult)
  }
  const playerId = result?.player?.id ?? 0
  const topDifferences = sortDifferencesByGap(result?.angleDifferences).slice(0, 3)
  const detail = {
    result,
    learningBridge: {
      intro: `This comparison was restored from legacy history for ${result?.player?.name ?? 'the selected player'}.`,
      gaps: buildLegacyLearningGaps(result)
    }
  }

  return {
    analysisKey: buildLegacyAnalysisKey(playerId, historyId),
    summaries: [{
      player: result.player,
      similarity: result.similarity ?? 0,
      topDifferences,
      matchReason: `${result?.player?.name ?? 'The selected player'} was restored from legacy comparison history.`,
      shotTypeAlignment: null,
      comparisonMode: 'single_frame_fallback'
    }],
    detailsByPlayerId: {
      [playerId]: detail
    },
    selectedPlayerId: playerId,
    selectedDetail: detail,
    historyId: historyId ?? null
  }
}

export const buildHistoryComparisonPayload = (snapshot, options = {}) => {
  if (!snapshot) {
    return null
  }

  if (snapshot.player && snapshot.angleDifferences) {
    return buildHistoryComparisonPayload(
      wrapLegacyComparisonResult(snapshot, options),
      options
    )
  }

  const { historyId } = options
  const detailsByPlayerId = Object.fromEntries(
    Object.entries(cloneJsonSafe(snapshot.detailsByPlayerId ?? {})).map(([playerId, detail]) => [
      playerId,
      detail
        ? {
            ...detail,
            result: {
              comparisonMode: 'single_frame_fallback',
              ...detail.result
            }
          }
        : detail
    ])
  )
  const selectedPlayerId =
    snapshot.selectedPlayerId ??
    snapshot.selectedDetail?.result?.player?.id ??
    snapshot.summaries?.[0]?.player?.id ??
    null
  const selectedDetail =
    cloneJsonSafe(snapshot.selectedDetail) ??
    cloneJsonSafe(getDetailByPlayerId(detailsByPlayerId, selectedPlayerId))

  if (selectedPlayerId != null && selectedDetail) {
    detailsByPlayerId[selectedPlayerId] = selectedDetail
  }

  return {
    analysisKey: rebindLegacyAnalysisKey(
      snapshot.analysisKey ?? '',
      selectedPlayerId,
      historyId
    ),
    summaries: cloneJsonSafe(snapshot.summaries ?? []).map(summary => ({
      comparisonMode: 'single_frame_fallback',
      ...summary
    })),
    detailsByPlayerId,
    selectedPlayerId,
    selectedDetail: selectedDetail
      ? {
          ...selectedDetail,
          result: {
            comparisonMode: 'single_frame_fallback',
            ...selectedDetail.result
          }
        }
      : null
  }
}

export const isSameHistorySnapshotIdentity = (snapshot, { historyId, analysisKey } = {}) => {
  if (!snapshot || !analysisKey || snapshot.analysisKey !== analysisKey) {
    return false
  }

  if (historyId != null) {
    return snapshot.historyId === historyId
  }

  if (snapshot.historyId != null) {
    return false
  }

  return true
}
