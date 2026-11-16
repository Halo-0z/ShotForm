import type { AnalysisHistory, JointAngle, ShotAnalysis } from "../types"
export function localDate(timestamp?: number): string
export function recordFrame(
    record: AnalysisHistory,
    index?: number,
): { analysis: ShotAnalysis; image: string; timestampMs: number | null }
export interface TrainingDifference {
    name: string
    before: number | null
    after: number | null
    delta: number | null
    reason: string
}
export function compareTrainingAngles(
    before: JointAngle[],
    after: JointAngle[],
): TrainingDifference[]
export function trainingTrendPoints(
    records: AnalysisHistory[],
    angleName: string,
): { time: number; value: number; recordId: number; createdAt: number }[]
