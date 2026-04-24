import type {
  ComparisonResult,
  ComparisonWorkbenchSnapshot
} from '@/types'

export interface HistorySnapshotIdentity {
  historyId?: number | null
  analysisKey?: string | null
}

export interface WrapLegacyComparisonOptions {
  historyId?: number | null
}

export function wrapLegacyComparisonResult(
  legacyResult: ComparisonResult | null | undefined,
  options?: WrapLegacyComparisonOptions
): ComparisonWorkbenchSnapshot | null

export function buildHistoryComparisonPayload(
  snapshot: ComparisonWorkbenchSnapshot | ComparisonResult | null | undefined,
  options?: WrapLegacyComparisonOptions
): ComparisonWorkbenchSnapshot | null

export function isSameHistorySnapshotIdentity(
  snapshot: ComparisonWorkbenchSnapshot | null | undefined,
  identity?: HistorySnapshotIdentity
): boolean
