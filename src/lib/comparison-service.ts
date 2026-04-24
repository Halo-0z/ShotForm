import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { ComparisonWorkbenchSnapshot, PlayerTemplateProfile, ShotAnalysis } from '@/types'
import { hasTauriRuntime } from '@/lib/tauri-runtime'

export interface ComparisonIdentity {
  source: 'image' | 'video-frame'
  sessionId: string
  videoPath?: string
  frameIndex?: number | null
  historyId?: number | null
  analysisKey: string
  profileKey?: string
}

export interface CompareProgressEvent {
  requestId: string
  analysisKey: string
  stage: string
  percent: number
  message: string
}

export interface ComparisonService {
  buildWorkbench(args: {
    requestId: string
    identity: ComparisonIdentity
    analysis: ShotAnalysis
    analysisProfile?: PlayerTemplateProfile | null
  }): Promise<ComparisonWorkbenchSnapshot>
  listenToProgress(handler: (event: CompareProgressEvent) => void): Promise<() => void>
}

export const buildAnalysisProfileKey = (profile?: PlayerTemplateProfile | null) => {
  if (!profile) {
    return ''
  }

  const phaseSignature = Object.entries(profile.phaseProfiles ?? {})
    .map(([phase, phaseProfile]) => {
      const angleSignature = (phaseProfile.angles ?? [])
        .map(angle => `${angle.name}:${angle.value.toFixed(1)}`)
        .join(',')

      return `${phase}:${phaseProfile.sampleCount}:${phaseProfile.coverage.toFixed(3)}:${angleSignature}`
    })
    .join('|')

  return [
    profile.sourceKind,
    profile.overallShotType,
    profile.samplesUsed,
    profile.coverage.toFixed(3),
    profile.representativeTimestampMs ?? 'na',
    phaseSignature
  ].join('::')
}

export const createTauriComparisonService = (): ComparisonService => ({
  async buildWorkbench({ requestId, identity, analysis, analysisProfile }) {
    if (!hasTauriRuntime()) {
      throw new Error('球星对比服务只能在桌面端运行。')
    }

    return invoke<ComparisonWorkbenchSnapshot>('build_compare_workbench', {
      requestId,
      analysisKey: identity.analysisKey,
      analysis,
      analysisProfile
    })
  },

  async listenToProgress(handler) {
    if (!hasTauriRuntime()) {
      return async () => {}
    }

    return listen<CompareProgressEvent>('compare-progress', event => {
      handler(event.payload)
    })
  }
})

export const comparisonService = createTauriComparisonService()
