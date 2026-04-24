export const STAGE_TIMEOUT_MS = 8_000
export const TOTAL_TIMEOUT_MS = 20_000

const STAGE_ORDER = new Map([
  ['idle', 0],
  ['preparing', 1],
  ['loading_templates', 2],
  ['validating_templates', 3],
  ['ranking_players', 4],
  ['building_default_detail', 5],
  ['ready', 6],
  ['empty', 6],
  ['failed', 6],
  ['error', 6]
])

const TERMINAL_STAGES = new Set(['ready', 'empty', 'failed', 'error'])
const COMPLETE_STAGES = new Set(['ready', 'empty'])

export const isTerminalProgressStage = (stage) => TERMINAL_STAGES.has(stage)

const stageOrder = (stage) => STAGE_ORDER.get(stage) ?? STAGE_ORDER.get('idle')

const normalizePercent = (stage, percent) => {
  const numericPercent = Number.isFinite(percent) ? percent : 0
  if (COMPLETE_STAGES.has(stage)) {
    return 100
  }

  return Math.max(0, Math.min(100, numericPercent))
}

const matchesActiveIdentity = (event, activeIdentity) => {
  if (!activeIdentity) {
    return true
  }

  if (activeIdentity.requestId && event.requestId !== activeIdentity.requestId) {
    return false
  }

  if (activeIdentity.analysisKey && event.analysisKey !== activeIdentity.analysisKey) {
    return false
  }

  return true
}

export const createProgressState = (overrides = {}) => ({
  requestId: overrides.requestId ?? null,
  analysisKey: overrides.analysisKey ?? '',
  stage: overrides.stage ?? 'idle',
  percent: normalizePercent(overrides.stage ?? 'idle', overrides.percent ?? 0),
  message: overrides.message ?? '',
  updatedAt: overrides.updatedAt ?? 0
})

export const acceptProgressEvent = (state, event, activeIdentity = null) => {
  if (!event || !matchesActiveIdentity(event, activeIdentity)) {
    return state
  }

  const current = createProgressState(state)
  const nextStage = event.stage ?? current.stage
  const nextPercent = normalizePercent(nextStage, event.percent ?? current.percent)
  const isTerminal = isTerminalProgressStage(nextStage)
  const isStageRegression = stageOrder(nextStage) < stageOrder(current.stage)

  if (isStageRegression && nextPercent <= current.percent && !isTerminal) {
    return state
  }

  const acceptedStage = isStageRegression && !isTerminal ? current.stage : nextStage

  return {
    ...current,
    requestId: event.requestId ?? current.requestId,
    analysisKey: event.analysisKey ?? current.analysisKey,
    stage: acceptedStage,
    percent: Math.max(current.percent, nextPercent),
    message: event.message ?? current.message,
    updatedAt: event.updatedAt ?? current.updatedAt
  }
}

export const shouldStageTimeout = (state, now) => {
  if (!state || state.stage === 'idle' || isTerminalProgressStage(state.stage)) {
    return false
  }

  if (!state.updatedAt) {
    return false
  }

  return now - state.updatedAt >= STAGE_TIMEOUT_MS
}

export const shouldTotalTimeout = (startedAt, now) => {
  if (!startedAt) {
    return false
  }

  return now - startedAt >= TOTAL_TIMEOUT_MS
}
