import type { ComparisonDetailPayload, ComparisonSummary, ComparisonWorkbenchSnapshot } from '@/types'
import type { CompareProgressEvent, ComparisonIdentity } from './comparison-service'

export type ComparisonSessionStatus =
  | 'idle'
  | 'preparing'
  | 'loading_templates'
  | 'validating_templates'
  | 'ranking_players'
  | 'building_default_detail'
  | 'ready'
  | 'empty'
  | 'error'

export interface ComparisonProgressState {
  requestId: string | null
  analysisKey: string
  stage: string
  percent: number
  message: string
  updatedAt: number
}

export interface ComparisonSessionState {
  status: ComparisonSessionStatus
  requestId: string | null
  startedAt: number
  identity: ComparisonIdentity | null
  analysisKey: string
  progress: ComparisonProgressState
  rankedSummaries: ComparisonSummary[]
  detailsByPlayerId: Record<number, ComparisonDetailPayload>
  selectedPlayerId: number | null
  selectedDetail: ComparisonDetailPayload | null
  snapshot: ComparisonWorkbenchSnapshot | null
  errorMessage: string
  canRetry: boolean
}

export interface ComparisonSessionController {
  startRequest(identity: ComparisonIdentity, options?: {
    bypassCache?: boolean
  }): {
    requestId: string
    startedAt: number
    restoredFromCache: boolean
  }
  acceptProgress(event: CompareProgressEvent): boolean
  completeRequest(requestId: string, snapshot: ComparisonWorkbenchSnapshot): boolean
  failRequest(
    requestId: string,
    error?: {
      analysisKey?: string
      message?: string
      stage?: string
      percent?: number
      updatedAt?: number
    }
  ): boolean
  tick(currentTime?: number): boolean
  selectPlayer(playerId: number): boolean
  hydrateReady(snapshot: ComparisonWorkbenchSnapshot, identity?: ComparisonIdentity | null): boolean
  cacheReady(snapshot: ComparisonWorkbenchSnapshot, identity: ComparisonIdentity): void
  getState(): ComparisonSessionState
}

export function createComparisonSessionController(options?: {
  now?: () => number
}): ComparisonSessionController
