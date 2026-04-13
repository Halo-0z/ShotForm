import type { ComparisonResult, ComparisonSummary, PlayerTemplate, ShotAnalysis } from '@/types'

export declare const withTimeout: <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
) => Promise<T>

export declare const sortDifferencesByGap: (
  differences: ComparisonResult['angleDifferences']
) => ComparisonResult['angleDifferences']

export declare const buildFallbackMatchReason: (
  result: ComparisonResult,
  getAngleDisplayName?: (name: string) => string
) => string

export declare const buildFallbackSummary: (
  result: ComparisonResult,
  getAngleDisplayName?: (name: string) => string
) => ComparisonSummary

export declare const buildFallbackSummaries: (
  results: ComparisonResult[],
  getAngleDisplayName?: (name: string) => string
) => ComparisonSummary[]

export declare const resolveFallbackComparisons: (options: {
  players: Array<Pick<PlayerTemplate, 'id'>>
  analysis: ShotAnalysis
  comparePlayer: (input: { analysis: ShotAnalysis; playerId: number }) => Promise<ComparisonResult> | ComparisonResult
  timeoutMs: number
}) => Promise<ComparisonResult[]>
