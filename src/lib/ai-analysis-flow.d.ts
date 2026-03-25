import type { ShotAnalysis } from '@/types'

export type AiReviewState = 'idle' | 'cached'
export type AiCoachingState = 'idle' | 'cached'

export declare function getStoredAutoAiPreference(rawValue: string | null | undefined): boolean
export declare function shouldAutoGenerateAiReview(
  enabled: boolean,
  analysis: Pick<ShotAnalysis, 'aiReview'> | null | undefined
): boolean
export declare function getAiReviewState(
  analysis: Pick<ShotAnalysis, 'aiReview'> | null | undefined
): AiReviewState
export declare function getAiCoachingState(
  payload:
    | {
        aiCoachingSummary?: string | null
        aiCoachingSuggestions?: unknown[] | null
      }
    | null
    | undefined
): AiCoachingState
