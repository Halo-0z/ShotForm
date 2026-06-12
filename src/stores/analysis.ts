import { defineStore } from "pinia"
import { computed, reactive, ref } from "vue"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import {
    normalizeShotType,
    type AiAnalysisPayload,
    type AiShotReview,
    type AnalysisHistory,
    type ComparisonResult,
    type ComparisonWorkbenchSnapshot,
    type CorrectionSuggestion,
    type FirstFrameMultiPose,
    type ShotAnalysis,
    type VideoShotAnalysis,
} from "@/types"
import { getStoredAutoAiPreference, shouldAutoGenerateAiReview } from "@/lib/ai-analysis-flow.js"
import {
    buildHistoryComparisonPayload,
    wrapLegacyComparisonResult,
} from "@/lib/comparison-history.js"

import { hasTauriRuntime } from "@/lib/tauri-runtime"

export interface AnalysisProgress {
    stage: string
    progress: number
    message: string
}

type CoachingSourceState = "idle" | "loading" | "done" | "error"

interface CoachingSource {
    data: CorrectionSuggestion[]
    summary: string
    state: CoachingSourceState
    error: string
    timestamp: number | null
}

const emptyCoachingSource = (): CoachingSource => ({
    data: [],
    summary: "",
    state: "idle",
    error: "",
    timestamp: null,
})

type AiCoachingSource = "idle" | "rules" | "ai" | "cache"
type ComparisonInput = ComparisonWorkbenchSnapshot | ComparisonResult | null | undefined

const AUTO_AI_STORAGE_KEY = "autoAiAnalysisEnabled"

export const useAnalysisStore = defineStore("analysis", () => {
    const currentAnalysis = ref<ShotAnalysis | null>(null)
    const currentVideoAnalysis = ref<VideoShotAnalysis | null>(null)
    const currentVideoPath = ref("")
    const currentVideoFrameIndex = ref(0)
    const currentImage = ref<string>("")
    const currentAnnotatedImage = ref<string>("")
    const currentHistoryId = ref<number | null>(null)
    const currentComparison = ref<ComparisonResult | null>(null)
    const currentComparisonSnapshot = ref<ComparisonWorkbenchSnapshot | null>(null)
    const coachingSources = reactive({
        rule: emptyCoachingSource(),
        ai: emptyCoachingSource(),
    })
    const autoAiAnalysisEnabled = ref(false)
    const isLoading = ref(false)
    const progress = ref<AnalysisProgress | null>(null)

    const normalizeAnalysis = (analysis: ShotAnalysis): ShotAnalysis => ({
        ...analysis,
        shotType: normalizeShotType(analysis.shotType),
        aiReview: analysis.aiReview
            ? {
                  ...analysis.aiReview,
                  shotType: normalizeShotType(analysis.aiReview.shotType),
              }
            : null,
    })

    const normalizeVideoAnalysis = (analysis: VideoShotAnalysis): VideoShotAnalysis => ({
        ...analysis,
        overallShotType: normalizeShotType(analysis.overallShotType),
        frames: analysis.frames.map((frame) => ({
            ...frame,
            analysis: normalizeAnalysis(frame.analysis),
        })),
    })

    const isComparisonSnapshot = (
        comparison: ComparisonInput,
    ): comparison is ComparisonWorkbenchSnapshot => {
        return Boolean(comparison && "summaries" in comparison && "detailsByPlayerId" in comparison)
    }

    const normalizeComparisonSnapshot = (
        comparison: ComparisonInput,
        historyId?: number | null,
    ): ComparisonWorkbenchSnapshot | null => {
        if (!comparison) {
            return null
        }

        const snapshot = isComparisonSnapshot(comparison)
            ? comparison
            : wrapLegacyComparisonResult(comparison, { historyId })
        if (!snapshot) {
            return null
        }

        const payload = buildHistoryComparisonPayload(snapshot, { historyId })

        if (!payload) {
            return null
        }

        return {
            ...payload,
            historyId: historyId ?? snapshot.historyId ?? null,
        }
    }

    const applyCurrentComparisonSnapshot = (snapshot: ComparisonWorkbenchSnapshot | null) => {
        currentComparisonSnapshot.value = snapshot
        currentComparison.value = snapshot?.selectedDetail?.result ?? null
    }

    const clearCurrentComparisonState = () => {
        applyCurrentComparisonSnapshot(null)
    }

    const mergeSelectedComparisonIntoSnapshot = (
        comparison: ComparisonResult,
        historyId?: number | null,
    ): ComparisonWorkbenchSnapshot => {
        const fallbackSnapshot = normalizeComparisonSnapshot(comparison, historyId)
        if (!fallbackSnapshot) {
            return {
                analysisKey: "",
                summaries: [],
                detailsByPlayerId: {},
                selectedPlayerId: null,
                selectedDetail: null,
                historyId: historyId ?? null,
            }
        }

        const existingSnapshot = currentComparisonSnapshot.value
        if (!existingSnapshot) {
            return fallbackSnapshot
        }

        const playerId = fallbackSnapshot.selectedPlayerId
        const playerExistsInCurrentDetails =
            playerId != null && existingSnapshot.detailsByPlayerId[playerId] != null
        const playerExistsInCurrentSummaries =
            playerId != null &&
            existingSnapshot.summaries.some((summary) => summary.player.id === playerId)

        if (!playerExistsInCurrentDetails && !playerExistsInCurrentSummaries) {
            return fallbackSnapshot
        }

        const fallbackDetail = fallbackSnapshot.selectedDetail ?? null
        const existingDetail =
            playerId == null ? null : (existingSnapshot.detailsByPlayerId[playerId] ?? null)
        const selectedDetail =
            existingDetail && fallbackDetail
                ? {
                      ...existingDetail,
                      result: fallbackDetail.result,
                  }
                : (existingDetail ?? fallbackDetail)
        const detailsByPlayerId = { ...existingSnapshot.detailsByPlayerId }

        if (playerId != null && selectedDetail) {
            detailsByPlayerId[playerId] = selectedDetail
        }

        const nextSummary = fallbackSnapshot.summaries[0] ?? null
        const summaries = nextSummary
            ? existingSnapshot.summaries.some(
                  (summary) => summary.player.id === nextSummary.player.id,
              )
                ? existingSnapshot.summaries.map((summary) => {
                      if (summary.player.id !== nextSummary.player.id) {
                          return summary
                      }

                      return {
                          ...summary,
                          player: nextSummary.player,
                          similarity: nextSummary.similarity,
                          topDifferences: nextSummary.topDifferences,
                      }
                  })
                : [...existingSnapshot.summaries, nextSummary]
            : existingSnapshot.summaries

        return {
            ...existingSnapshot,
            summaries,
            detailsByPlayerId,
            selectedPlayerId: playerId ?? existingSnapshot.selectedPlayerId ?? null,
            selectedDetail,
            historyId: historyId ?? existingSnapshot.historyId ?? null,
        }
    }

    const normalizeHistoryRecord = (record: AnalysisHistory): AnalysisHistory => ({
        ...record,
        analysis: normalizeAnalysis(record.analysis),
        comparison: normalizeComparisonSnapshot(record.comparison, record.id),
        aiCoachingSummary: record.aiCoachingSummary ?? null,
        aiCoachingSuggestions: record.aiCoachingSuggestions ?? null,
        sourceIdentifier: record.sourceIdentifier ?? null,
        videoAnalysis: record.videoAnalysis ?? null,
    })

    const setAiCoachingCache = (
        summary: string | null | undefined,
        suggestions: CorrectionSuggestion[] | null | undefined,
        source: AiCoachingSource,
    ) => {
        if (source === "ai" || source === "cache") {
            coachingSources.ai.data = suggestions ?? []
            coachingSources.ai.summary = summary ?? ""
            coachingSources.ai.state = "done"
            coachingSources.ai.timestamp = Date.now()
        } else if (source === "rules") {
            coachingSources.rule.data = suggestions ?? []
            coachingSources.rule.summary = summary ?? ""
            coachingSources.rule.state = "done"
            coachingSources.rule.timestamp = Date.now()
        }
    }

    const clearAiCoachingCache = () => {
        coachingSources.rule = emptyCoachingSource()
        coachingSources.ai = emptyCoachingSource()
    }

    const clearCoachingSources = () => {
        coachingSources.rule = emptyCoachingSource()
        coachingSources.ai = emptyCoachingSource()
    }

    // 向后兼容（SuggestionPanel adapter）
    const currentAiCoachingSummary = computed(() => coachingSources.ai.summary)
    const currentAiCoachingSuggestions = computed(() => coachingSources.ai.data)
    const currentAiCoachingSource = computed<AiCoachingSource>(() => {
        if (coachingSources.ai.state === "done") return "ai"
        if (coachingSources.rule.state === "done") return "rules"
        return "idle"
    })

    const setCurrentComparison = (comparison: ComparisonResult | null) => {
        if (!comparison) {
            clearCurrentComparisonState()
            return
        }

        applyCurrentComparisonSnapshot(
            mergeSelectedComparisonIntoSnapshot(comparison, currentHistoryId.value),
        )
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
        clearCurrentComparisonState()
        coachingSources.ai = emptyCoachingSource()
        void loadRuleSuggestions(currentAnalysis.value)
    }

    const syncCurrentAnalysisAiReview = (review: AiShotReview, sourceTimestamp?: number) => {
        if (
            currentAnalysis.value &&
            (sourceTimestamp == null || currentAnalysis.value.timestamp === sourceTimestamp)
        ) {
            currentAnalysis.value = {
                ...currentAnalysis.value,
                aiReview: review,
            }
        }

        if (!currentVideoAnalysis.value?.frames.length) {
            return
        }

        const frame =
            sourceTimestamp == null
                ? currentVideoAnalysis.value.frames[currentVideoFrameIndex.value]
                : currentVideoAnalysis.value.frames.find(
                      (item) => item.analysis.timestamp === sourceTimestamp,
                  )

        if (frame) {
            frame.analysis.aiReview = review
        }
    }

    const clearVideoState = () => {
        currentVideoAnalysis.value = null
        currentVideoPath.value = ""
        currentVideoFrameIndex.value = 0
    }

    const clearImageState = () => {
        currentImage.value = ""
        currentAnnotatedImage.value = ""
        currentAnalysis.value = null
        currentHistoryId.value = null
        clearCurrentComparisonState()
        clearAiCoachingCache()
    }

    const loadPreferences = () => {
        if (typeof window === "undefined") {
            return
        }

        autoAiAnalysisEnabled.value = getStoredAutoAiPreference(
            window.localStorage.getItem(AUTO_AI_STORAGE_KEY),
        )
    }

    const setAutoAiAnalysisEnabled = (enabled: boolean) => {
        autoAiAnalysisEnabled.value = enabled
        if (typeof window !== "undefined") {
            window.localStorage.setItem(AUTO_AI_STORAGE_KEY, String(enabled))
        }
    }

    const setupProgressListener = async () => {
        if (!hasTauriRuntime()) {
            return
        }

        await listen<AnalysisProgress>("analysis-progress", (event) => {
            progress.value = event.payload
        })
    }

    setupProgressListener()
    loadPreferences()

    const generateAiReview = async (options?: {
        analysis?: ShotAnalysis | null
        imageData?: string | null
        annotatedImageData?: string | null
        force?: boolean
    }): Promise<AiShotReview | null> => {
        const analysis = options?.analysis ?? currentAnalysis.value
        if (!analysis) {
            return null
        }

        if (analysis.aiReview && !options?.force) {
            return analysis.aiReview
        }

        const aiReview = await invoke<AiShotReview>("get_ai_shot_review", {
            analysis,
            imageData: options?.imageData ?? (currentImage.value || null),
            annotatedImageData:
                options?.annotatedImageData ?? (currentAnnotatedImage.value || null),
        })

        const normalizedReview = {
            ...aiReview,
            shotType: normalizeShotType(aiReview.shotType),
        }

        syncCurrentAnalysisAiReview(normalizedReview, analysis.timestamp)
        return normalizedReview
    }

    const loadRuleSuggestions = async (analysis: ShotAnalysis | null) => {
        if (!analysis) return

        coachingSources.rule.state = "loading"
        coachingSources.rule.error = ""

        try {
            const suggestions = await invoke<CorrectionSuggestion[]>("get_correction_suggestions", {
                analysis,
            })
            coachingSources.rule.data = suggestions
            coachingSources.rule.summary = buildRuleSummary(suggestions)
            coachingSources.rule.state = "done"
            coachingSources.rule.timestamp = Date.now()
        } catch (error) {
            coachingSources.rule.state = "error"
            coachingSources.rule.error = error instanceof Error ? error.message : String(error)
        }
    }

    const generateAiCoaching = async (options?: {
        analysis?: ShotAnalysis | null
        imageData?: string | null
        annotatedImageData?: string | null
        force?: boolean
    }) => {
        const analysis = options?.analysis ?? currentAnalysis.value
        if (!analysis) {
            return
        }

        if (
            coachingSources.ai.state === "done" &&
            coachingSources.ai.data.length > 0 &&
            !options?.force
        ) {
            return
        }

        coachingSources.ai.state = "loading"
        coachingSources.ai.error = ""

        try {
            const response = await invoke<{ summary: string; suggestions: CorrectionSuggestion[] }>(
                "get_ai_correction_suggestions",
                {
                    analysis,
                    imageData: options?.imageData ?? (currentImage.value || null),
                    annotatedImageData:
                        options?.annotatedImageData ?? (currentAnnotatedImage.value || null),
                },
            )

            coachingSources.ai.data = response.suggestions
            coachingSources.ai.summary = response.summary
            coachingSources.ai.state = "done"
            coachingSources.ai.timestamp = Date.now()

            if (currentHistoryId.value) {
                await updateHistoryAiCoaching(
                    currentHistoryId.value,
                    response.summary,
                    response.suggestions,
                )
            }
        } catch (error) {
            coachingSources.ai.state = "error"
            coachingSources.ai.error = error instanceof Error ? error.message : String(error)
        }
    }

    const buildRuleSummary = (suggestions: CorrectionSuggestion[]): string => {
        if (!suggestions.length) {
            return "当前姿态未检测到明显偏差，整体表现良好。"
        }
        const focus = suggestions
            .slice(0, 2)
            .map((s) => s.bodyPart)
            .join("、")
        return `从本地规则分析看，主要需要关注 ${focus} 的配合。建议先调整这些部位，再结合 AI 深度分析获取更细致的动作指导。`
    }

    const analyzeImage = async (imageData: string): Promise<ShotAnalysis> => {
        isLoading.value = true
        progress.value = { stage: "starting", progress: 0, message: "开始分析..." }
        clearVideoState()
        clearAiCoachingCache()
        currentHistoryId.value = null
        clearCurrentComparisonState()
        currentImage.value = imageData
        currentAnnotatedImage.value = ""
        currentAnalysis.value = null

        try {
            const result = await invoke<ShotAnalysis>("analyze_shot", {
                imageData,
            })
            const normalizedResult = normalizeAnalysis(result)

            try {
                currentAnnotatedImage.value = await invoke<string>("draw_pose_on_image", {
                    imageData,
                    poseData: normalizedResult.poseData,
                })
            } catch {
                currentAnnotatedImage.value = ""
            }

            currentAnalysis.value = normalizedResult

            void loadRuleSuggestions(normalizedResult)

            if (shouldAutoGenerateAiReview(autoAiAnalysisEnabled.value, normalizedResult)) {
                void generateAiReview({
                    analysis: normalizedResult,
                    imageData,
                    annotatedImageData: currentAnnotatedImage.value || null,
                }).catch((error) => {
                    console.warn(
                        "AI shot review unavailable, falling back to local analysis:",
                        error,
                    )
                })
            }

            return normalizedResult
        } finally {
            isLoading.value = false
            progress.value = null
        }
    }

    const subjectPoseIndex = ref<number | null>(null)
    const firstFrameMultiPose = ref<FirstFrameMultiPose | null>(null)

    const analyzeVideo = async (
        filePath: string,
        trimStartMs: number,
        trimEndMs: number,
        selectedSubjectIndex?: number | null,
    ): Promise<VideoShotAnalysis> => {
        isLoading.value = true
        progress.value = { stage: "starting", progress: 0, message: "开始视频分析..." }
        clearImageState()
        clearVideoState()
        currentVideoPath.value = filePath
        firstFrameMultiPose.value = null

        try {
            const invokeArgs: Record<string, unknown> = {
                filePath,
                trimStartMs,
                trimEndMs,
            }
            if (selectedSubjectIndex != null) {
                invokeArgs.subjectPoseIndex = selectedSubjectIndex
            }

            const result = await invoke<VideoShotAnalysis>("analyze_video", invokeArgs)
            const normalizedResult = normalizeVideoAnalysis(result)
            currentVideoAnalysis.value = normalizedResult
            applyVideoFrameSelection(normalizedResult, normalizedResult.bestFrameIndex ?? 0)

            if (
                normalizedResult.firstFrameMultiPose &&
                normalizedResult.firstFrameMultiPose.poses.length > 1
            ) {
                firstFrameMultiPose.value = normalizedResult.firstFrameMultiPose
            }

            if (shouldAutoGenerateAiReview(autoAiAnalysisEnabled.value, currentAnalysis.value)) {
                void generateAiReview({
                    analysis: currentAnalysis.value,
                    imageData: currentImage.value || null,
                    annotatedImageData: currentAnnotatedImage.value || null,
                }).catch((error) => {
                    console.warn("AI shot review unavailable for video key frame:", error)
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
        clearCurrentComparisonState()
        clearAiCoachingCache()
    }

    const setCurrentHistoryRecord = (record: AnalysisHistory) => {
        const normalizedRecord = normalizeHistoryRecord(record)
        currentHistoryId.value = normalizedRecord.id
        currentAnalysis.value = normalizedRecord.analysis
        currentImage.value = normalizedRecord.imagePath
        currentAnnotatedImage.value = normalizedRecord.annotatedImagePath
        applyCurrentComparisonSnapshot(normalizedRecord.comparison ?? null)

        if (normalizedRecord.videoAnalysis) {
            currentVideoAnalysis.value = normalizedRecord.videoAnalysis
            currentVideoPath.value = normalizedRecord.videoAnalysis.videoPath
            applyVideoFrameSelection(
                normalizedRecord.videoAnalysis,
                normalizedRecord.videoAnalysis.bestFrameIndex ?? 0,
            )
        } else {
            clearVideoState()
        }

        // 恢复 AI 建议（如果有缓存）
        if (normalizedRecord.aiCoachingSummary || normalizedRecord.aiCoachingSuggestions?.length) {
            coachingSources.ai.data = normalizedRecord.aiCoachingSuggestions ?? []
            coachingSources.ai.summary = normalizedRecord.aiCoachingSummary ?? ""
            coachingSources.ai.state = "done"
            coachingSources.ai.timestamp = Date.now()
        } else {
            coachingSources.ai = emptyCoachingSource()
        }
    }

    const updateHistoryAiCoaching = async (
        historyId: number,
        summary: string,
        suggestions: CorrectionSuggestion[],
    ): Promise<void> => {
        await invoke("update_analysis_history_ai_coaching", {
            id: historyId,
            aiCoachingSummary: summary,
            aiCoachingSuggestions: suggestions,
        })
    }

    const updateHistoryComparison = async (
        historyId: number,
        comparison: ComparisonInput,
    ): Promise<void> => {
        const normalizedSnapshot = normalizeComparisonSnapshot(comparison, historyId)

        await invoke("update_analysis_history_comparison", {
            id: historyId,
            comparison: buildHistoryComparisonPayload(normalizedSnapshot, { historyId }),
        })
    }

    const saveToHistory = async (
        imagePath: string,
        annotatedImagePath: string,
        options?: {
            suggestions?: CorrectionSuggestion[]
            aiCoachingSummary?: string | null
            aiCoachingSuggestions?: CorrectionSuggestion[] | null
            sourceIdentifier?: string | null
            videoAnalysis?: VideoShotAnalysis | null
        },
    ): Promise<void> => {
        if (!currentAnalysis.value) return

        await invoke("save_analysis_history", {
            imagePath,
            annotatedImagePath,
            analysis: currentAnalysis.value,
            comparison: buildHistoryComparisonPayload(currentComparisonSnapshot.value, {
                historyId: null,
            }),
            suggestions: options?.suggestions ?? [],
            aiCoachingSummary: options?.aiCoachingSummary ?? null,
            aiCoachingSuggestions: options?.aiCoachingSuggestions ?? null,
            sourceIdentifier: options?.sourceIdentifier ?? null,
            videoAnalysis: options?.videoAnalysis ?? null,
        })
    }

    const getHistory = async (): Promise<AnalysisHistory[]> => {
        const history = await invoke<AnalysisHistory[]>("get_analysis_history")
        return history.map(normalizeHistoryRecord)
    }

    const getHistoryPage = async (limit: number, offset: number): Promise<AnalysisHistory[]> => {
        const history = await invoke<AnalysisHistory[]>("get_analysis_history_page", {
            limit,
            offset,
        })
        return history.map(normalizeHistoryRecord)
    }

    const deleteHistory = async (id: number): Promise<void> => {
        await invoke("delete_analysis_history", { id })
    }

    const buildAiAnalysisPayload = async (): Promise<AiAnalysisPayload | null> => {
        if (!currentAnalysis.value) return null

        return invoke<AiAnalysisPayload>("build_ai_analysis_payload", {
            analysis: currentAnalysis.value,
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
        currentComparisonSnapshot,
        coachingSources,
        currentAiCoachingSummary,
        currentAiCoachingSuggestions,
        currentAiCoachingSource,
        autoAiAnalysisEnabled,
        isLoading,
        progress,
        subjectPoseIndex,
        firstFrameMultiPose,
        analyzeImage,
        analyzeVideo,
        selectVideoFrame,
        generateAiReview,
        generateAiCoaching,
        loadRuleSuggestions,
        setCurrentAnalysis,
        setCurrentHistoryRecord,
        setCurrentComparison,
        setAiCoachingCache,
        clearAiCoachingCache,
        clearCoachingSources,
        loadPreferences,
        setAutoAiAnalysisEnabled,
        updateHistoryAiCoaching,
        updateHistoryComparison,
        saveToHistory,
        getHistory,
        getHistoryPage,
        deleteHistory,
        buildAiAnalysisPayload,
    }
})
