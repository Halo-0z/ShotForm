import type { ComparisonService, CompareProgressEvent } from '@/lib/comparison-service'
import type {
  ComparisonDetailPayload,
  ComparisonMode,
  ComparisonWorkbenchSnapshot,
  ShotAnalysis
} from '@/types'

export type ComparisonPreviewMode = 'loading' | 'ready' | 'empty' | 'error'

const hasTauriRuntime = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

export const getComparisonPreviewMode = (): ComparisonPreviewMode | null => {
  if (typeof window === 'undefined' || hasTauriRuntime()) {
    return null
  }

  const value = new URLSearchParams(window.location.search).get('comparePreview')
  if (value === 'loading' || value === 'ready' || value === 'empty' || value === 'error') {
    return value
  }

  return null
}

export const isComparisonPreviewMode = () => getComparisonPreviewMode() !== null

const player = (id: number, name: string) => ({
  id,
  name,
  team: 'Preview Warriors',
  description: 'browser preview template',
  poseData: { keypoints: [], width: 0, height: 0 },
  angles: [
    { name: 'right_elbow_angle', value: id === 23 ? 88 : 94, normalRange: [70, 110] as [number, number], status: 'normal' as const, confidence: 1 },
    { name: 'release_angle', value: id === 23 ? 52 : 57, normalRange: [45, 70] as [number, number], status: 'normal' as const, confidence: 1 },
    { name: 'right_knee_angle', value: id === 23 ? 142 : 136, normalRange: [120, 165] as [number, number], status: 'normal' as const, confidence: 1 }
  ]
})

const detail = (id: number, name: string): ComparisonDetailPayload => ({
  result: {
    player: player(id, name),
    similarity: id === 23 ? 0.94 : 0.87,
    comparisonMode: (id === 23 ? 'video_level' : 'single_frame_fallback') as ComparisonMode,
    angleDifferences: [
      { name: 'right_elbow_angle', userValue: 91, playerValue: id === 23 ? 88 : 94, difference: id === 23 ? 3 : -3 },
      { name: 'release_angle', userValue: 55, playerValue: id === 23 ? 52 : 57, difference: id === 23 ? 3 : -2 },
      { name: 'right_knee_angle', userValue: 140, playerValue: id === 23 ? 142 : 136, difference: id === 23 ? -2 : 4 }
    ]
  },
  learningBridge: {
    intro: `Start with ${name}'s release rhythm, then compare the largest angle gaps.`,
    gaps: [
      { title: `${name} release line`, detail: 'Keep the elbow path compact before extending.' },
      { title: `${name} lower-body load`, detail: 'Match the knee bend before speeding up the shot.' }
    ]
  }
})

export const getComparisonPreviewAnalysis = (): ShotAnalysis | null => {
  if (!isComparisonPreviewMode()) {
    return null
  }

  return {
    poseData: { keypoints: [], width: 1280, height: 720 },
    angles: [
      { name: 'right_elbow_angle', value: 91, normalRange: [70, 110], status: 'normal', confidence: 1 },
      { name: 'release_angle', value: 55, normalRange: [45, 70], status: 'normal', confidence: 1 },
      { name: 'right_knee_angle', value: 140, normalRange: [120, 165], status: 'normal', confidence: 1 }
    ],
    shotType: 'one_motion',
    shotTypeConfidence: 0.82,
    shotTypeReasons: ['Preview analysis fixture'],
    aiReview: null,
    timestamp: 2026042001
  }
}

export const buildComparisonPreviewSnapshot = (analysisKey: string): ComparisonWorkbenchSnapshot => {
  const curry = detail(23, 'Curry')
  const thompson = detail(34, 'Thompson')

  return {
    analysisKey,
    summaries: [
      {
        player: curry.result.player,
        similarity: curry.result.similarity,
        topDifferences: curry.result.angleDifferences,
        matchReason: 'Curry is closest on release rhythm and elbow path.',
        shotTypeAlignment: null,
        comparisonMode: 'video_level'
      },
      {
        player: thompson.result.player,
        similarity: thompson.result.similarity,
        topDifferences: thompson.result.angleDifferences,
        matchReason: 'Thompson gives a cleaner set-point reference.',
        shotTypeAlignment: null,
        comparisonMode: 'single_frame_fallback'
      }
    ],
    detailsByPlayerId: {
      23: curry,
      34: thompson
    },
    selectedPlayerId: 23,
    selectedDetail: curry
  }
}

export const createComparisonPreviewService = (): ComparisonService => {
  let handler: ((event: CompareProgressEvent) => void) | null = null

  const emit = (event: CompareProgressEvent) => {
    queueMicrotask(() => handler?.(event))
  }

  return {
    async listenToProgress(nextHandler) {
      handler = nextHandler
      return async () => {
        handler = null
      }
    },

    async buildWorkbench({ requestId, identity }) {
      const mode = getComparisonPreviewMode() ?? 'ready'
      const base = { requestId, analysisKey: identity.analysisKey }

      emit({ ...base, stage: 'loading_templates', percent: 25, message: 'Loading preview templates...' })

      if (mode === 'loading') {
        return new Promise<ComparisonWorkbenchSnapshot>(() => {})
      }

      if (mode === 'error') {
        emit({ ...base, stage: 'failed', percent: 25, message: 'Preview template load failed.' })
        throw new Error('Preview template load failed.')
      }

      emit({ ...base, stage: 'ranking_players', percent: 68, message: 'Ranking preview players...' })

      if (mode === 'empty') {
        emit({ ...base, stage: 'empty', percent: 100, message: 'No preview templates available.' })
        return {
          analysisKey: identity.analysisKey,
          summaries: [],
          detailsByPlayerId: {},
          selectedPlayerId: null,
          selectedDetail: null
        }
      }

      emit({ ...base, stage: 'ready', percent: 100, message: 'Preview compare workbench ready.' })
      return buildComparisonPreviewSnapshot(identity.analysisKey)
    }
  }
}
