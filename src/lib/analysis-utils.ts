import type { ShotType } from '@/types'
import { normalizeShotType } from '@/types'
import type { ComparisonIdentity } from '@/lib/comparison-service'
import { buildAnalysisProfileKey } from '@/lib/comparison-service'
import type { ShotAnalysis, VideoShotAnalysis } from '@/types'

export const buildAnalysisCompareKey = (analysis: ShotAnalysis): string => {
  const angleSignature = analysis.angles
    .map(angle => `${angle.name}:${angle.value.toFixed(2)}`)
    .join('|')

  return `${analysis.timestamp}|${analysis.shotType}|${angleSignature}`
}

export const buildCompareIdentity = (args: {
  analysis: ShotAnalysis
  videoAnalysis: VideoShotAnalysis | null
  videoPath: string
  videoFrameIndex: number
  historyId: number | null
}): ComparisonIdentity => {
  const { analysis, videoAnalysis, videoPath, videoFrameIndex, historyId } = args
  const isVideo = Boolean(videoAnalysis?.frames.length)
  const analysisProfile = videoAnalysis?.templateProfile ?? null

  return {
    source: isVideo ? 'video-frame' : 'image',
    sessionId: isVideo
      ? `video:${videoPath || 'current'}`
      : `image:${historyId ?? analysis.timestamp}`,
    videoPath: isVideo ? videoPath : undefined,
    frameIndex: isVideo ? videoFrameIndex : null,
    historyId,
    analysisKey: buildAnalysisCompareKey(analysis),
    profileKey: buildAnalysisProfileKey(analysisProfile)
  }
}

export const getShotTypeBadgeVariant = (type: ShotType | string): 'excellent' | 'good' | 'average' | 'poor' | 'secondary' => {
  const variants: Record<ShotType, 'excellent' | 'good' | 'average' | 'poor' | 'secondary'> = {
    one_motion: 'excellent',
    one_point_five_motion: 'good',
    two_motion: 'average',
    unknown: 'secondary'
  }

  return variants[normalizeShotType(type)] || 'secondary'
}

export const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
