export interface Keypoint {
  id: number
  name: string
  x: number
  y: number
  z: number
  visibility: number
}

export interface PoseData {
  keypoints: Keypoint[]
  width: number
  height: number
}

export interface JointAngle {
  name: string
  value: number
  normalRange: [number, number]
  status: 'normal' | 'warning' | 'error' | 'low_confidence'
  confidence: number
}

export type ShotType = 'one_motion' | 'one_point_five_motion' | 'two_motion' | 'unknown'

export const SHOT_TYPE_NAMES: Record<ShotType, string> = {
  one_motion: '一段式投篮',
  one_point_five_motion: '1.5 段式投篮',
  two_motion: '二段式投篮',
  unknown: '分型待确认'
}

const SHOT_TYPE_MAPPING: Record<string, ShotType> = {
  oneMotion: 'one_motion',
  onePointFiveMotion: 'one_point_five_motion',
  twoMotion: 'two_motion',
  one_motion: 'one_motion',
  one_point_five_motion: 'one_point_five_motion',
  two_motion: 'two_motion',
  OneMotion: 'one_motion',
  OnePointFiveMotion: 'one_point_five_motion',
  TwoMotion: 'two_motion',
  unknown: 'unknown',
  Unknown: 'unknown'
}

export const ANGLE_DISPLAY_NAMES: Record<string, string> = {
  left_elbow_angle: '左肘角',
  right_elbow_angle: '右肘角',
  left_shoulder_angle: '左肩角',
  right_shoulder_angle: '右肩角',
  left_knee_angle: '左膝角',
  right_knee_angle: '右膝角',
  left_hip_angle: '左髋角',
  right_hip_angle: '右髋角',
  shoulder_tilt: '肩线倾斜',
  trunk_tilt: '躯干倾斜',
  shooting_elbow_angle: '投篮肘角',
  release_angle: '出手角'
}

export const getAngleDisplayName = (name: string): string => {
  return ANGLE_DISPLAY_NAMES[name] ?? name
}

export const normalizeShotType = (type: string | null | undefined): ShotType => {
  if (!type) {
    return 'unknown'
  }

  return SHOT_TYPE_MAPPING[type] ?? 'unknown'
}

export const getShotTypeName = (type: string | null | undefined): string => {
  return SHOT_TYPE_NAMES[normalizeShotType(type)]
}

export const getShotTypeGuidance = (
  type: string | null | undefined,
  confidence: number,
  source: 'image' | 'video' = 'image'
): string => {
  const normalizedType = normalizeShotType(type)

  if (normalizedType === 'unknown') {
    if (source === 'video') {
      return '整段视频的关键帧都没有给出稳定的分型判断，可能动作区间裁剪不够精确，建议重新选取从举球到出手的完整区间再试。'
    }
    return '这张图更像出手末段或跟随段，适合看出手姿态细节，但不适合稳定判断一段式还是二段式。想看分型，优先上传举球到准备出手前手和球短暂停住的位置附近的单人全身画面。'
  }

  if (confidence < 0.6) {
    if (source === 'video') {
      return '整段视频的分型倾向还不够稳定，建议重新裁剪动作区间，确保包含从举球到出手的完整过程。'
    }
    return '这次已经有分型倾向，但参考度还不算高。建议再补一张更接近准备出手前手和球短暂停住的位置的画面，交叉确认会更稳。'
  }

  return ''
}

export interface ShotAnalysis {
  poseData: PoseData
  angles: JointAngle[]
  shotType: ShotType
  shotTypeConfidence: number
  shotTypeReasons: string[]
  aiReview?: AiShotReview | null
  timestamp: number
}

export interface VideoAnalysisFrame {
  index: number
  timestampMs: number
  imageData: string
  annotatedImageData: string
  analysis: ShotAnalysis
}

export interface TemporalFeatures {
  setPointRatio: number
  kneeElbowLeadRatio: number
  plateauSharpness: number
  phaseSequenceValid: boolean
  confidence: number
}

export interface MultiPoseEntry {
  poseIndex: number
  keypoints: Keypoint[]
  torsoCx: number
  torsoCy: number
}

export interface FirstFrameMultiPose {
  index: number
  imageData: string
  poses: MultiPoseEntry[]
  width: number
  height: number
}

export interface VideoShotAnalysis {
  videoPath: string
  durationMs: number
  trimStartMs: number
  trimEndMs: number
  fps: number
  totalFrames: number
  framesAnalyzed: number
  frames: VideoAnalysisFrame[]
  bestFrameIndex: number
  overallShotType: ShotType
  overallShotTypeConfidence: number
  overallReasons: string[]
  templateProfile?: PlayerTemplateProfile | null
  temporalFeatures?: TemporalFeatures | null
  detectedPoseCount?: number
  firstFrameMultiPose?: FirstFrameMultiPose | null
}

export interface AiShotReview {
  source: string
  phase: string
  phaseConfidence: number
  decisionMode: 'confirmed' | 'tendency' | 'insufficient'
  shotType: ShotType
  shotTypeConfidence: number
  title: string
  summary: string
  reasons: string[]
}

export interface AiAnglePayloadItem {
  name: string
  displayName: string
  value: number
  normalRange: [number, number]
  status: string
  confidence: number
  definition: string
}

export interface AiShotContext {
  source: string
  suspectedShootingHand: string
  shotPhase: string
  shotType: string
  shotTypeConfidence: number
}

export interface AiPayloadFlags {
  preferBusinessAngles: boolean
  ignoreRawSideAnglesWhenConflictWithShootingAngles: boolean
  skipLowConfidenceAngles: boolean
}

export interface AiAnalysisPayload {
  shotContext: AiShotContext
  primaryAngles: AiAnglePayloadItem[]
  referenceAngles: AiAnglePayloadItem[]
  lowConfidenceAngles: string[]
  shotTypeReasons: string[]
  flags: AiPayloadFlags
}

export interface PlayerTemplate {
  id: number
  name: string
  team: string
  description: string
  poseData: PoseData
  angles: JointAngle[]
  templateProfile?: PlayerTemplateProfile | null
}

export interface PlayerTemplateProfile {
  version: number
  sourceKind: string
  overallShotType: string
  representativeFrameIndex?: number | null
  representativeTimestampMs?: number | null
  samplesUsed: number
  coverage: number
  phaseProfiles: Record<string, PhaseAngleProfile>
}

export interface PhaseAngleProfile {
  phase: string
  sampleCount: number
  coverage: number
  angles: CanonicalAngleProfile[]
}

export interface CanonicalAngleProfile {
  name: string
  value: number
  confidence: number
}

export type ComparisonMode = 'video_level' | 'single_frame_fallback'

export interface AngleDifference {
  name: string
  userValue: number
  playerValue: number
  difference: number
}

export interface ComparisonResult {
  player: PlayerTemplate
  similarity: number
  angleDifferences: AngleDifference[]
  comparisonMode: ComparisonMode
}

export interface ComparisonSummary {
  player: PlayerTemplate
  similarity: number
  topDifferences: AngleDifference[]
  matchReason: string
  shotTypeAlignment?: string | null
  comparisonMode: ComparisonMode
}

export interface ComparisonWorkbenchResult {
  summaries: ComparisonSummary[]
  selectedComparison?: ComparisonResult | null
}

export interface ComparisonLearningGap {
  title: string
  detail: string
}

export interface ComparisonLearningBridge {
  intro: string
  gaps: ComparisonLearningGap[]
}

export interface ComparisonDetailPayload {
  result: ComparisonResult
  learningBridge: ComparisonLearningBridge
}

export interface ComparisonWorkbenchSnapshot {
  analysisKey: string
  summaries: ComparisonSummary[]
  detailsByPlayerId: Record<number, ComparisonDetailPayload>
  selectedPlayerId?: number | null
  selectedDetail?: ComparisonDetailPayload | null
  historyId?: number | null
}

export interface CorrectionSuggestion {
  bodyPart: string
  issue: string
  suggestion: string
  priority: 'high' | 'medium' | 'low'
}

export interface AiCoachingResponse {
  summary: string
  suggestions: CorrectionSuggestion[]
}

export type AiReviewState = 'idle' | 'cached'
export type AiCoachingState = 'idle' | 'cached'

export interface AnalysisHistory {
  id: number
  imagePath: string
  annotatedImagePath: string
  analysis: ShotAnalysis
  comparison: ComparisonWorkbenchSnapshot | null
  suggestions: CorrectionSuggestion[]
  aiCoachingSummary?: string | null
  aiCoachingSuggestions?: CorrectionSuggestion[] | null
  sourceIdentifier?: string | null
  videoAnalysis?: VideoShotAnalysis | null
  createdAt: number
}

