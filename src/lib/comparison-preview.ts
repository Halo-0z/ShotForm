import type { ComparisonService, CompareProgressEvent } from "@/lib/comparison-service"
import type {
    ComparisonDetailPayload,
    ComparisonMode,
    ComparisonWorkbenchSnapshot,
    ShotAnalysis,
} from "@/types"
import { hasTauriRuntime } from "@/lib/tauri-runtime"

export type ComparisonPreviewMode = "loading" | "ready" | "empty" | "error"

export const getComparisonPreviewMode = (): ComparisonPreviewMode | null => {
    if (typeof window === "undefined" || hasTauriRuntime()) {
        return null
    }

    const value = new URLSearchParams(window.location.search).get("comparePreview")
    if (value === "loading" || value === "ready" || value === "empty" || value === "error") {
        return value
    }

    return null
}

export const isComparisonPreviewMode = () => getComparisonPreviewMode() !== null

const player = (id: number, name: string) => ({
    id,
    name,
    team: "预览示例 · 非实测数据",
    description: "浏览器布局示例模板",
    poseData: { keypoints: [], width: 0, height: 0 },
    angles: [
        {
            name: "right_elbow_angle",
            value: id === 23 ? 88 : 94,
            normalRange: [70, 110] as [number, number],
            status: "normal" as const,
            confidence: 1,
        },
        {
            name: "release_angle",
            value: id === 23 ? 52 : 57,
            normalRange: [45, 70] as [number, number],
            status: "normal" as const,
            confidence: 1,
        },
        {
            name: "right_knee_angle",
            value: id === 23 ? 142 : 136,
            normalRange: [120, 165] as [number, number],
            status: "normal" as const,
            confidence: 1,
        },
    ],
})

const detail = (id: number, name: string): ComparisonDetailPayload => ({
    result: {
        player: player(id, name),
        similarity: id === 23 ? 0.94 : 0.87,
        comparisonMode: (id === 23 ? "video_level" : "single_frame_fallback") as ComparisonMode,
        angleDifferences: [
            {
                name: "right_elbow_angle",
                userValue: 91,
                playerValue: id === 23 ? 88 : 94,
                difference: id === 23 ? 3 : -3,
            },
            {
                name: "release_angle",
                userValue: 55,
                playerValue: id === 23 ? 52 : 57,
                difference: id === 23 ? 3 : -2,
            },
            {
                name: "right_knee_angle",
                userValue: 140,
                playerValue: id === 23 ? 142 : 136,
                difference: id === 23 ? -2 : 4,
            },
        ],
    },
    learningBridge: {
        intro: `结合 ${name} 模板，先查看角度差异，再回看相应动作片段。以下为布局示例。`,
        gaps: [
            { title: "出手路径", detail: "回看伸展前的肘部位置与出手方向。" },
            { title: "下肢配合", detail: "观察屈膝与伸展的衔接，不以单帧角度判断动作优劣。" },
        ],
    },
})

export const getComparisonPreviewAnalysis = (): ShotAnalysis | null => {
    if (!isComparisonPreviewMode()) {
        return null
    }

    return {
        poseData: { keypoints: [], width: 1280, height: 720 },
        angles: [
            {
                name: "right_elbow_angle",
                value: 91,
                normalRange: [70, 110],
                status: "normal",
                confidence: 1,
            },
            {
                name: "release_angle",
                value: 55,
                normalRange: [45, 70],
                status: "normal",
                confidence: 1,
            },
            {
                name: "right_knee_angle",
                value: 140,
                normalRange: [120, 165],
                status: "normal",
                confidence: 1,
            },
        ],
        shotType: "one_motion",
        shotTypeConfidence: 0.82,
        shotTypeReasons: ["Preview analysis fixture"],
        aiReview: null,
        timestamp: 2026042001,
    }
}

export const buildComparisonPreviewSnapshot = (
    analysisKey: string,
): ComparisonWorkbenchSnapshot => {
    const curry = detail(23, "Curry")
    const thompson = detail(34, "Thompson")

    return {
        analysisKey,
        summaries: [
            {
                player: curry.result.player,
                similarity: curry.result.similarity,
                topDifferences: curry.result.angleDifferences,
                matchReason: "示例数据中，出手角和肘部角度最接近此模板。",
                shotTypeAlignment: null,
                comparisonMode: "video_level",
            },
            {
                player: thompson.result.player,
                similarity: thompson.result.similarity,
                topDifferences: thompson.result.angleDifferences,
                matchReason: "可查看此模板的出手位置与下肢角度差异。",
                shotTypeAlignment: null,
                comparisonMode: "single_frame_fallback",
            },
        ],
        detailsByPlayerId: {
            23: curry,
            34: thompson,
        },
        selectedPlayerId: 23,
        selectedDetail: curry,
    }
}

export const createComparisonPreviewService = (): ComparisonService => {
    let handler: ((event: CompareProgressEvent) => void) | null = null

    const emit = (event: CompareProgressEvent) => {
        queueMicrotask(() => handler?.(event))
    }

    return {
        async listenToProgress(nextHandler) {
            handler = nextHandler
            return async () => {
                handler = null
            }
        },

        async buildWorkbench({ requestId, identity }) {
            const mode = getComparisonPreviewMode() ?? "ready"
            const base = { requestId, analysisKey: identity.analysisKey }

            emit({ ...base, stage: "loading_templates", percent: 25, message: "正在加载预览模板…" })

            if (mode === "loading") {
                return new Promise<ComparisonWorkbenchSnapshot>(() => {})
            }

            if (mode === "error") {
                emit({
                    ...base,
                    stage: "failed",
                    percent: 25,
                    message: "模板加载失败，请重新加载。",
                })
                throw new Error("模板加载失败，请重新加载。")
            }

            emit({
                ...base,
                stage: "ranking_players",
                percent: 68,
                message: "Ranking preview players...",
            })

            if (mode === "empty") {
                emit({
                    ...base,
                    stage: "empty",
                    percent: 100,
                    message: "No preview templates available.",
                })
                return {
                    analysisKey: identity.analysisKey,
                    summaries: [],
                    detailsByPlayerId: {},
                    selectedPlayerId: null,
                    selectedDetail: null,
                }
            }

            emit({
                ...base,
                stage: "ready",
                percent: 100,
                message: "Preview compare workbench ready.",
            })
            return buildComparisonPreviewSnapshot(identity.analysisKey)
        },
    }
}
