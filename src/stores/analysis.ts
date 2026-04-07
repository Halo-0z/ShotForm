import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  normalizeShotType,
  type AiAnalysisPayload,
  type AiShotReview,
  type AnalysisHistory,
  type ComparisonResult,
  type CorrectionSuggestion,
  type ShotAnalysis,
  type VideoShotAnalysis
} from '@/types'
import { getStoredAutoAiPreference, shouldAutoGenerateAiReview } from '@/lib/ai-analysis-flow.js'

export interface AnalysisProgress {
  stage: string
  progress: number
  message: string
}

type AiCoachingSource = 'idle' | 'rules' | 'ai' | 'cache'

const AUTO_AI_STORAGE_KEY = 'autoAiAnalysisEnabled'

export const useAnalysisStore = defineStore('analysis', () => {
  const currentAnalysis = ref<ShotAnalysis | null>(null)
  const currentVideoAnalysis = ref<VideoShotAnalysis | null>(null)
  const currentVideoPath = ref('')
  const currentVideoFrameIndex = ref(0)
  const currentImage = ref<string>('')
  const currentAnnotatedImage = ref<string>('')
  const currentHistoryId = ref<number | null>(null)
  const currentComparison = ref<ComparisonResult | null>(null)
  const currentAiCoachingSummary = ref('')
  const currentAiCoachingSuggestions = ref<CorrectionSuggestion[]>([])
  const currentAiCoachingSource = ref<AiCoachingSource>('idle')
  const autoAiAnalysisEnabled = ref(false)
  const isLoading = ref(false)
  const progress = ref<AnalysisProgress | null>(null)

  const normalizeAnalysis = (analysis: ShotAnalysis): ShotAnalysis => ({
    ...analysis,
    shotType: normalizeShotType(analysis.shotType),
    aiReview: analysis.aiReview
      ? {
          ...analysis.aiReview,
          shotType: normalizeShotType(analysis.aiReview.shotType)
        }
      : null
  })

  const normalizeVideoAnalysis = (analysis: VideoShotAnalysis): VideoShotAnalysis => ({
    ...analysis,
    overallShotType: normalizeShotType(analysis.overallShotType),
    frames: analysis.frames.map(frame => ({
      ...frame,
      analysis: normalizeAnalysis(frame.analysis)
    }))
  })

  const normalizeComparison = (comparison: ComparisonResult | null | undefined) => comparison ?? null

  const normalizeHistoryRecord = (record: AnalysisHistory): AnalysisHistory => ({
    ...record,
    analysis: normalizeAnalysis(record.analysis),
    comparison: normalizeComparison(record.comparison),
    aiCoachingSummary: record.aiCoachingSummary ?? null,
    aiCoachingSuggestions: record.aiCoachingSuggestions ?? null
  })

  const setAiCoachingCache = (
    summary: string | null | undefined,
    suggestions: CorrectionSuggestion[] | null | undefined,
    source: AiCoachingSource
  ) => {
    currentAiCoachingSummary.value = summary ?? ''
    currentAiCoachingSuggestions.value = suggestions ?? []
    currentAiCoachingSource.value = summary || suggestions?.length ? source : 'idle'
  }

  const clearAiCoachingCache = () => {
    setAiCoachingCache('', [], 'idle')
  }

  const setCurrentComparison = (comparison: ComparisonResult | null) => {
    currentComparison.value = normalizeComparison(comparison)
  }

  const applyVideoFrameSelection = (analysis: VideoShotAnalysis | null, frameIndex: number) => {
    if (!analysis || !analysis.frames.length) {
      currentVideoFrameIndex.value = 0
      return
    }

    const safeIndex = Math.min(Math.max(frameIndex, 0), analysis.frames.length - 1)
    const frame = analysis.frames[safeIndex]
    currentVideoFrameIndex.value = safeIndex
    currentAnalysis.value = normalizeAnalysis(frame.analysis)
    currentImage.value = frame.imageData
    currentAnnotatedImage.value = frame.annotatedImageData || frame.imageData
    currentComparison.value = null
    clearAiCoachingCache()
  }

  const syncCurrentAnalysisAiReview = (review: AiShotReview) => {
    if (!currentAnalysis.value) {
      return
    }

    currentAnalysis.value = {
      ...currentAnalysis.value,
      aiReview: review
    }

    if (currentVideoAnalysis.value?.frames.length) {
      const frame = currentVideoAnalysis.value.frames[currentVideoFrameIndex.value]
      if (frame) {
        frame.analysis.aiReview = review
      }
    }
  }

  const clearVideoState = () => {
    currentVideoAnalysis.value = null
    currentVideoPath.value = ''
    currentVideoFrameIndex.value = 0
  }

  const clearImageState = () => {
    currentImage.value = ''
    currentAnnotatedImage.value = ''
    currentAnalysis.value = null
    currentHistoryId.value = null
    currentComparison.value = null
    clearAiCoachingCache()
  }

  const loadPreferences = () => {
    if (typeof window === 'undefined') {
      return
    }

    autoAiAnalysisEnabled.value = getStoredAutoAiPreference(
      window.localStorage.getItem(AUTO_AI_STORAGE_KEY)
    )
  }

  const setAutoAiAnalysisEnabled = (enabled: boolean) => {
    autoAiAnalysisEnabled.value = enabled
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_AI_STORAGE_KEY, String(enabled))
    }
  }

  const setupProgressListener = async () => {
    await listen<AnalysisProgress>('analysis-progress', event => {
      progress.value = event.payload
    })
  }

  setupProgressListener()
  loadPreferences()

  const generateAiReview = async (
    options?: {
      analysis?: ShotAnalysis | null
      imageData?: string | null
      annotatedImageData?: string | null
      force?: boolean
    }
  ): Promise<AiShotReview | null> => {
    const analysis = options?.analysis ?? currentAnalysis.value
    if (!analysis) {
      return null
    }

    if (analysis.aiReview && !options?.force) {
      return analysis.aiReview
    }

    const aiReview = await invoke<AiShotReview>('get_ai_shot_review', {
      analysis,
      imageData: options?.imageData ?? (currentImage.value || null),
      annotatedImageData: options?.annotatedImageData ?? (currentAnnotatedImage.value || null)
    })

    const normalizedReview = {
      ...aiReview,
      shotType: normalizeShotType(aiReview.shotType)
    }

    syncCurrentAnalysisAiReview(normalizedReview)
    return normalizedReview
  }

  const analyzeImage = async (imageData: string): Promise<ShotAnalysis> => {
    isLoading.value = true
    progress.value = { stage: 'starting', progress: 0, message: '开始分析...' }
    clearVideoState()
    clearAiCoachingCache()
    currentHistoryId.value = null
    currentComparison.value = null
    currentImage.value = imageData
    currentAnnotatedImage.value = ''
    currentAnalysis.value = null

    try {
      const result = await invoke<ShotAnalysis>('analyze_shot', {
        imageData
      })
      const normalizedResult = normalizeAnalysis(result)

      try {
        currentAnnotatedImage.value = await invoke<string>('draw_pose_on_image', {
          imageData,
          poseData: normalizedResult.poseData
        })
      } catch {
        currentAnnotatedImage.value = ''
      }

      currentAnalysis.value = normalizedResult

      if (shouldAutoGenerateAiReview(autoAiAnalysisEnabled.value, normalizedResult)) {
        void generateAiReview({
          analysis: normalizedResult,
          imageData,
          annotatedImageData: currentAnnotatedImage.value || null
        }).catch(error => {
          console.warn('AI shot review unavailable, falling back to local analysis:', error)
        })
      }

      return normalizedResult
    } finally {
      isLoading.value = false
      progress.value = null
    }
  }

  const analyzeVideo = async (
    filePath: string,
    trimStartMs: number,
    trimEndMs: number
  ): Promise<VideoShotAnalysis> => {
    isLoading.value = true
    progress.value = { stage: 'starting', progress: 0, message: '开始视频分析...' }
    clearImageState()
    clearVideoState()
    currentVideoPath.value = filePath

    try {
      const result = await invoke<VideoShotAnalysis>('analyze_video', {
        filePath,
        trimStartMs,
        trimEndMs
      })
      const normalizedResult = normalizeVideoAnalysis(result)
      currentVideoAnalysis.value = normalizedResult
      applyVideoFrameSelection(normalizedResult, normalizedResult.bestFrameIndex)

      if (shouldAutoGenerateAiReview(autoAiAnalysisEnabled.value, currentAnalysis.value)) {
        void generateAiReview({
          analysis: currentAnalysis.value,
          imageData: currentImage.value || null,
          annotatedImageData: currentAnnotatedImage.value || null
        }).catch(error => {
          console.warn('AI shot review unavailable for video key frame:', error)
        })
      }

      return normalizedResult
    } finally {
      isLoading.value = false
      progress.value = null
    }
  }

  const selectVideoFrame = (frameIndex: number) => {
    applyVideoFrameSelection(currentVideoAnalysis.value, frameIndex)
  }

  const setCurrentAnalysis = (analysis: ShotAnalysis) => {
    currentHistoryId.value = null
    currentAnalysis.value = normalizeAnalysis(analysis)
    currentComparison.value = null
    clearAiCoachingCache()
  }

  const setCurrentHistoryRecord = (record: AnalysisHistory) => {
    const normalizedRecord = normalizeHistoryRecord(record)
    currentHistoryId.value = normalizedRecord.id
    currentAnalysis.value = normalizedRecord.analysis
    currentImage.value = normalizedRecord.imagePath
    currentAnnotatedImage.value = normalizedRecord.annotatedImagePath
    currentComparison.value = normalizedRecord.comparison ?? null
    clearVideoState()
    setAiCoachingCache(
      normalizedRecord.aiCoachingSummary,
      normalizedRecord.aiCoachingSuggestions,
      normalizedRecord.aiCoachingSummary || normalizedRecord.aiCoachingSuggestions?.length ? 'cache' : 'idle'
    )
  }

  const updateHistoryAiCoaching = async (
    historyId: number,
    summary: string,
    suggestions: CorrectionSuggestion[]
  ): Promise<void> => {
    await invoke('update_analysis_history_ai_coaching', {
      id: historyId,
      aiCoachingSummary: summary,
      aiCoachingSuggestions: suggestions
    })
  }

  const updateHistoryComparison = async (
    historyId: number,
    comparison: ComparisonResult | null
  ): Promise<void> => {
    await invoke('update_analysis_history_comparison', {
      id: historyId,
      comparison: normalizeComparison(comparison)
    })
  }

  const saveToHistory = async (
    imagePath: string,
    annotatedImagePath: string,
    options?: {
      suggestions?: CorrectionSuggestion[]
      aiCoachingSummary?: string | null
      aiCoachingSuggestions?: CorrectionSuggestion[] | null
    }
  ): Promise<void> => {
    if (!currentAnalysis.value) return

    await invoke('save_analysis_history', {
      imagePath,
      annotatedImagePath,
      analysis: currentAnalysis.value,
      comparison: currentComparison.value,
      suggestions: options?.suggestions ?? [],
      aiCoachingSummary: options?.aiCoachingSummary ?? null,
      aiCoachingSuggestions: options?.aiCoachingSuggestions ?? null
    })
  }

  const getHistory = async (): Promise<AnalysisHistory[]> => {
    const history = await invoke<AnalysisHistory[]>('get_analysis_history')
    return history.map(normalizeHistoryRecord)
  }

  const deleteHistory = async (id: number): Promise<void> => {
    await invoke('delete_analysis_history', { id })
  }

  const buildAiAnalysisPayload = async (): Promise<AiAnalysisPayload | null> => {
    if (!currentAnalysis.value) return null

    return invoke<AiAnalysisPayload>('build_ai_analysis_payload', {
      analysis: currentAnalysis.value
    })
  }

  return {
    currentAnalysis,
    currentVideoAnalysis,
    currentVideoPath,
    currentVideoFrameIndex,
    currentImage,
    currentAnnotatedImage,
    currentHistoryId,
    currentComparison,
    currentAiCoachingSummary,
    currentAiCoachingSuggestions,
    currentAiCoachingSource,
    autoAiAnalysisEnabled,
    isLoading,
    progress,
    analyzeImage,
    analyzeVideo,
    selectVideoFrame,
    generateAiReview,
    setCurrentAnalysis,
    setCurrentHistoryRecord,
    setCurrentComparison,
    setAiCoachingCache,
    clearAiCoachingCache,
    loadPreferences,
    setAutoAiAnalysisEnabled,
    updateHistoryAiCoaching,
    updateHistoryComparison,
    saveToHistory,
    getHistory,
    deleteHistory,
    buildAiAnalysisPayload
  }
})




