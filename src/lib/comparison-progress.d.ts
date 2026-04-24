export const STAGE_TIMEOUT_MS: number
export const TOTAL_TIMEOUT_MS: number

export interface ProgressIdentity {
  requestId?: string | null
  analysisKey?: string | null
}

export interface ProgressState {
  requestId: string | null
  analysisKey: string
  stage: string
  percent: number
  message: string
  updatedAt: number
}

export interface ProgressEvent {
  requestId?: string | null
  analysisKey?: string | null
  stage?: string
  percent?: number
  message?: string
  updatedAt?: number
}

export function isTerminalProgressStage(stage: string): boolean
export function createProgressState(overrides?: Partial<ProgressState>): ProgressState
export function acceptProgressEvent(
  state: ProgressState,
  event: ProgressEvent,
  activeIdentity?: ProgressIdentity | null
): ProgressState
export function shouldStageTimeout(state: ProgressState, now: number): boolean
export function shouldTotalTimeout(startedAt: number, now: number): boolean
