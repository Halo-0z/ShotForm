<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import {
    Play,
    Pause,
    Info,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    BarChart3,
    Table as TableIcon,
    Bookmark,
    GitCompareArrows,
} from "lucide-vue-next"
import { Button } from "@/components/ui/button"
import { useAnalysisStore } from "@/stores/analysis"
import { formatTime } from "@/lib/analysis-utils"
import { getShotTypeName } from "@/types"
import AngleAnalysisChart from "@/components/analysis/AngleAnalysisChart.vue"
import AngleDeviationCards from "@/components/analysis/AngleDeviationCards.vue"
import AISuggestionList from "@/components/analysis/AISuggestionList.vue"

const router = useRouter()
const analysisStore = useAnalysisStore()

const analysis = computed(() => analysisStore.currentAnalysis)

const goToCompare = () => {
    router.push("/compare")
}
const videoAnalysis = computed(() => analysisStore.currentVideoAnalysis)
const currentFrameIndex = computed(() => analysisStore.currentVideoFrameIndex)
const frames = computed(() => videoAnalysis.value?.frames ?? [])
const currentAiSuggestions = computed(() => analysisStore.currentAiCoachingSuggestions)
const aiSuggestionsCount = computed(() => analysisStore.currentAiCoachingSuggestions.length)

const shotTypeName = computed(() => {
    if (videoAnalysis.value) {
        return getShotTypeName(videoAnalysis.value.overallShotType) ?? "一段式投篮"
    }
    const a = analysis.value
    if (!a) return "一段式投篮"
    return getShotTypeName(a.shotType) ?? "一段式投篮"
})

const displayAnalysis = computed(() => {
    if (videoAnalysis.value) {
        const va = videoAnalysis.value
        return va.frames[va.bestFrameIndex]?.analysis ?? analysis.value
    }
    return analysis.value
})

const score = computed(() => {
    const analysisToScore = displayAnalysis.value
    if (!analysisToScore) return 86
    const angles = analysisToScore.angles
    const scoreMap = new Map<string, number>()
    for (const angle of angles) {
        if (!angle.value || angle.value <= 0) continue
        const idealRanges: Record<string, [number, number]> = {
            left_elbow_angle: [90, 120],
            right_elbow_angle: [90, 120],
            left_shoulder_angle: [140, 170],
            right_shoulder_angle: [140, 170],
            left_knee_angle: [140, 165],
            right_knee_angle: [140, 165],
            trunk_tilt: [80, 100],
        }
        const range = idealRanges[angle.name]
        if (range) {
            const [min, max] = range
            if (angle.value >= min && angle.value <= max) {
                scoreMap.set(angle.name, 95)
            } else {
                const deviation = Math.min(Math.abs(angle.value - min), Math.abs(angle.value - max))
                scoreMap.set(angle.name, Math.max(40, 95 - deviation * 1.2))
            }
        }
    }
    if (scoreMap.size === 0) return 86
    let total = 0
    for (const s of scoreMap.values()) {
        total += s
    }
    return Math.round(total / scoreMap.size)
})

const confidencePercent = computed(() => {
    if (videoAnalysis.value) {
        return Math.round((videoAnalysis.value.overallShotTypeConfidence ?? 0) * 1000) / 10
    }
    if (!analysis.value) return 54.8
    return Math.round((analysis.value.shotTypeConfidence ?? 0) * 1000) / 10
})

const confidenceGrade = computed(() => {
    const c = confidencePercent.value
    if (c >= 80) return "高置信度"
    if (c >= 50) return "中等置信度"
    return "低置信度"
})

const analysisReasons = computed(() => {
    if (videoAnalysis.value?.overallReasons?.length) {
        return videoAnalysis.value.overallReasons
    }
    if (!analysis.value || !analysis.value.shotTypeReasons?.length) {
        return ["整体动作流畅，投篮发力较好，出手稳定性中等，建议优化起跳与手肘的协同发力。"]
    }
    return analysis.value.shotTypeReasons
})

const isPlaying = ref(false)
const playbackSpeed = ref(1)
const videoCanvasRef = ref<HTMLCanvasElement | null>(null)
const playbackTimer = ref<number | null>(null)
const imageCache = new Map<string, HTMLImageElement>()
let drawRequestId = 0

const activeFrame = computed(() => {
    if (frames.value.length === 0) return null
    return frames.value[currentFrameIndex.value] ?? frames.value[0]
})

const currentTimestampDisplay = computed(() => {
    if (frames.value.length === 0) return "0:00"
    const frame = frames.value[currentFrameIndex.value]
    return formatTime(frame?.timestampMs ?? 0)
})

const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const cached = imageCache.get(src)
        if (cached) {
            resolve(cached)
            return
        }
        const image = new Image()
        image.onload = () => {
            imageCache.set(src, image)
            resolve(image)
        }
        image.onerror = () => reject(new Error("图像加载失败"))
        image.src = src
    })

const preloadImages = async () => {
    const unique = [...new Set(frames.value.map((f) => f.imageData).filter(Boolean))]
    await Promise.allSettled(unique.map((src) => loadImage(src)))
}

const connections: Array<[number, number]> = [
    [11, 12],
    [11, 13],
    [13, 15],
    [15, 17],
    [15, 19],
    [15, 21],
    [12, 14],
    [14, 16],
    [16, 18],
    [16, 20],
    [16, 22],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [27, 29],
    [27, 31],
    [24, 26],
    [26, 28],
    [28, 30],
    [28, 32],
]
const leftJointIds = new Set([11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31])
const rightJointIds = new Set([12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32])

const getPointColor = (jointId: number) => {
    if (leftJointIds.has(jointId)) return "#38bdf8"
    if (rightJointIds.has(jointId)) return "#f59e0b"
    return "#34d399"
}
const getLineColor = (startId: number, endId: number) => {
    if (leftJointIds.has(startId) && leftJointIds.has(endId)) return "rgba(56, 189, 248, 0.92)"
    if (rightJointIds.has(startId) && rightJointIds.has(endId)) return "rgba(245, 158, 11, 0.92)"
    return "rgba(52, 211, 153, 0.92)"
}

const drawFrame = async () => {
    const frame = activeFrame.value
    const canvas = videoCanvasRef.value
    if (!frame || !canvas) return
    const requestId = ++drawRequestId
    const poseData = frame.analysis.poseData
    const context = canvas.getContext("2d")
    if (!context) return

    let frameImage: HTMLImageElement | null = null
    if (frame.imageData) {
        try {
            frameImage = await loadImage(frame.imageData)
        } catch {
            frameImage = null
        }
    }
    if (requestId !== drawRequestId) return

    const baseWidth = frameImage?.naturalWidth || poseData.width || 960
    const baseHeight = frameImage?.naturalHeight || poseData.height || 720
    const aspectRatio = baseWidth / Math.max(baseHeight, 1)
    const maxDisplayWidth = 800
    const maxDisplayHeight = 440
    let displayWidth = Math.min(baseWidth, maxDisplayWidth)
    let displayHeight = Math.max(240, Math.round(displayWidth / Math.max(aspectRatio, 0.1)))
    if (displayHeight > maxDisplayHeight) {
        displayHeight = maxDisplayHeight
        displayWidth = Math.max(240, Math.round(displayHeight * Math.max(aspectRatio, 0.1)))
    }

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(displayWidth * dpr)
    canvas.height = Math.round(displayHeight * dpr)
    canvas.style.width = "100%"
    canvas.style.height = "auto"

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, displayWidth, displayHeight)

    const background = context.createLinearGradient(0, 0, displayWidth, displayHeight)
    background.addColorStop(0, "#08111f")
    background.addColorStop(1, "#0f1f2f")
    context.fillStyle = background
    context.fillRect(0, 0, displayWidth, displayHeight)

    if (frameImage) {
        context.save()
        context.globalAlpha = 0.22
        context.drawImage(frameImage, 0, 0, displayWidth, displayHeight)
        context.restore()
    }

    const scaleX = displayWidth / Math.max(poseData.width || baseWidth, 1)
    const scaleY = displayHeight / Math.max(poseData.height || baseHeight, 1)
    const keypointMap = new Map(poseData.keypoints.map((kp) => [kp.id, kp]))

    context.lineCap = "round"
    context.lineJoin = "round"
    connections.forEach(([startId, endId]) => {
        const s = keypointMap.get(startId)
        const e = keypointMap.get(endId)
        if (!s || !e || s.visibility < 0.45 || e.visibility < 0.45) return
        context.beginPath()
        context.moveTo(s.x * scaleX, s.y * scaleY)
        context.lineTo(e.x * scaleX, e.y * scaleY)
        context.strokeStyle = getLineColor(startId, endId)
        context.shadowColor = context.strokeStyle
        context.shadowBlur = 10
        context.lineWidth = 3.5
        context.stroke()
    })

    context.shadowBlur = 0
    poseData.keypoints.forEach((kp) => {
        if (kp.visibility < 0.45) return
        const x = kp.x * scaleX
        const y = kp.y * scaleY
        const radius = 4.5 + kp.visibility * 2.5
        context.beginPath()
        context.arc(x, y, radius + 1.5, 0, Math.PI * 2)
        context.fillStyle = "rgba(255, 255, 255, 0.9)"
        context.fill()
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle = getPointColor(kp.id)
        context.shadowColor = getPointColor(kp.id)
        context.shadowBlur = 12
        context.fill()
    })

    context.shadowBlur = 0
    context.fillStyle = "rgba(5, 10, 20, 0.72)"
    context.fillRect(16, 16, 176, 54)
    context.fillStyle = "#f8fafc"
    context.font = "600 15px sans-serif"
    context.fillText(`关键帧 ${currentFrameIndex.value + 1}/${frames.value.length}`, 28, 38)
    context.font = "400 13px sans-serif"
    context.fillStyle = "rgba(226, 232, 240, 0.92)"
    context.fillText(`时间点 ${formatTime(frame.timestampMs)}`, 28, 58)
}

const handleFrameSelect = (frameIndex: number) => {
    analysisStore.selectVideoFrame(frameIndex)
}

const togglePlayback = () => {
    isPlaying.value = !isPlaying.value
    if (isPlaying.value) {
        startPlayback()
    } else {
        if (playbackTimer.value) clearInterval(playbackTimer.value)
        playbackTimer.value = null
    }
}

const startPlayback = () => {
    if (playbackTimer.value) clearInterval(playbackTimer.value)
    const interval = 500 / playbackSpeed.value
    playbackTimer.value = window.setInterval(() => {
        if (frames.value.length === 0) return
        const next = (currentFrameIndex.value + 1) % frames.value.length
        analysisStore.selectVideoFrame(next)
    }, interval)
}

const handleExport = () => {
    window.alert("导出报告功能开发中")
}

const handleWindowResize = () => {
    void drawFrame()
}

watch(
    frames,
    async () => {
        await preloadImages()
        await drawFrame()
    },
    { deep: true, immediate: true },
)

watch(currentFrameIndex, async () => {
    await drawFrame()
})

watch(playbackSpeed, () => {
    if (isPlaying.value) {
        if (playbackTimer.value) clearInterval(playbackTimer.value)
        startPlayback()
    }
})

onMounted(() => {
    window.addEventListener("resize", handleWindowResize)
})

onUnmounted(() => {
    if (playbackTimer.value) clearInterval(playbackTimer.value)
    window.removeEventListener("resize", handleWindowResize)
})
</script>

<template>
    <div class="analysis-workbench">
        <header class="analysis-workbench__topbar">
            <div class="analysis-workbench__topbar-left">
                <div class="analysis-workbench__heading">
                    <p class="analysis-workbench__eyebrow">ANALYSIS</p>
                    <h1 class="analysis-workbench__topbar-title">投篮姿势分析</h1>
                    <p class="analysis-workbench__topbar-subtitle">
                        基于动作识别和关键帧分析，为你提供专业的投篮姿势评估。
                    </p>
                </div>
            </div>
            <div class="analysis-workbench__topbar-right">
                <span class="analysis-workbench__badge analysis-workbench__badge--success"
                    >分析完成</span
                >
                <div class="analysis-workbench__topbar-actions">
                    <Button variant="outline" size="sm" @click="handleExport">
                        保存历史记录
                    </Button>
                    <Button variant="accent" size="sm" @click="handleExport"> 导出报告 </Button>
                    <Button v-if="analysis" variant="outline" size="sm" @click="goToCompare">
                        <GitCompareArrows class="h-4 w-4" />
                        球星对比
                    </Button>
                </div>
            </div>
        </header>

        <div class="analysis-workbench__body">
            <div class="analysis-workbench__left">
                <div class="analysis-workbench__top-row">
                    <section class="analysis-workbench__conclusion">
                        <div class="analysis-workbench__conclusion-header">
                            <h2 class="analysis-workbench__conclusion-title">本次分析结论</h2>
                        </div>

                        <div class="analysis-workbench__conclusion-main">
                            <h3 class="analysis-workbench__judgment">
                                {{ videoAnalysis ? "最终判断" : "当前判断" }}：<span
                                    class="analysis-workbench__judgment-type"
                                    >{{ shotTypeName }}</span
                                >
                            </h3>
                            <p class="analysis-workbench__conclusion-desc">
                                整体动作流畅，投篮发力较好，出手稳定性中等，建议优化起跳与手肘的协同发力。
                            </p>
                        </div>

                        <div class="analysis-workbench__conclusion-cards">
                            <div
                                class="analysis-workbench__card analysis-workbench__card--shot-type"
                            >
                                <span class="analysis-workbench__card-label">投篮类型</span>
                                <div class="analysis-workbench__card-shot-type-badge">
                                    {{ shotTypeName }}
                                </div>
                                <span class="analysis-workbench__card-sublabel">标准动作</span>
                            </div>

                            <div class="analysis-workbench__card analysis-workbench__card--score">
                                <span class="analysis-workbench__card-label">综合得分</span>
                                <div class="analysis-workbench__card-score">
                                    <span class="analysis-workbench__card-score-number">{{
                                        score
                                    }}</span>
                                    <span class="analysis-workbench__card-score-total">/100</span>
                                </div>
                                <span class="analysis-workbench__card-sublabel">优秀</span>
                            </div>

                            <div
                                class="analysis-workbench__card analysis-workbench__card--confidence"
                            >
                                <span class="analysis-workbench__card-label">置信度</span>
                                <div class="analysis-workbench__card-confidence-value">
                                    {{ confidencePercent }}%
                                </div>
                                <div class="analysis-workbench__card-confidence-bar">
                                    <div
                                        class="analysis-workbench__card-confidence-fill"
                                        :style="{ width: `${confidencePercent}%` }"
                                    />
                                </div>
                                <span class="analysis-workbench__card-sublabel">{{
                                    confidenceGrade
                                }}</span>
                            </div>
                        </div>

                        <div class="analysis-workbench__reasons">
                            <span class="analysis-workbench__reasons-label">本次分析依据</span>
                            <ul class="analysis-workbench__reasons-list">
                                <li
                                    v-for="(reason, idx) in analysisReasons"
                                    :key="idx"
                                    class="analysis-workbench__reason-item"
                                >
                                    <CheckCircle2 class="h-4 w-4" />
                                    <span>{{ reason }}</span>
                                </li>
                            </ul>
                        </div>
                    </section>

                    <section class="analysis-workbench__visualizer">
                        <div class="analysis-workbench__visualizer-header">
                            <h3 class="analysis-workbench__visualizer-title">动作可视化</h3>
                            <Info class="h-4 w-4 analysis-workbench__section-info" />
                        </div>
                        <div class="analysis-workbench__video-player">
                            <canvas
                                v-if="frames.length > 0"
                                ref="videoCanvasRef"
                                class="analysis-workbench__canvas"
                            />
                            <div v-else class="analysis-workbench__video-empty">
                                <Play class="h-8 w-8" />
                            </div>
                            <div class="analysis-workbench__video-controls">
                                <button
                                    class="analysis-workbench__video-play-btn"
                                    @click="togglePlayback"
                                >
                                    <Pause v-if="isPlaying" class="h-4 w-4" />
                                    <Play v-else class="h-4 w-4" />
                                </button>
                                <div class="analysis-workbench__video-progress">
                                    <div
                                        class="analysis-workbench__video-progress-fill"
                                        :style="{
                                            width: `${frames.length > 0 ? ((currentFrameIndex + 1) / frames.length) * 100 : 0}%`,
                                        }"
                                    />
                                </div>
                                <span class="analysis-workbench__video-time"
                                    >{{ currentTimestampDisplay }} /
                                    {{
                                        frames.length > 0
                                            ? formatTime(
                                                  frames[frames.length - 1]?.timestampMs ?? 0,
                                              )
                                            : "0:00"
                                    }}</span
                                >
                                <div class="analysis-workbench__video-speeds">
                                    <button
                                        v-for="speed in [0.5, 1, 1.5]"
                                        :key="speed"
                                        class="analysis-workbench__video-speed-btn"
                                        :class="{
                                            'analysis-workbench__video-speed-btn--active':
                                                playbackSpeed === speed,
                                        }"
                                        @click="playbackSpeed = speed"
                                    >
                                        {{ speed }}x
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <section class="analysis-workbench__angle-chart-section">
                    <div class="analysis-workbench__section-header">
                        <div class="analysis-workbench__section-header-left">
                            <h3 class="analysis-workbench__section-title">关节角度分析</h3>
                            <Info class="h-4 w-4 analysis-workbench__section-info" />
                        </div>
                        <div class="analysis-workbench__chart-toggle">
                            <button
                                class="analysis-workbench__chart-toggle-btn analysis-workbench__chart-toggle-btn--active"
                            >
                                <BarChart3 class="h-4 w-4" />
                                图表
                            </button>
                            <button class="analysis-workbench__chart-toggle-btn">
                                <TableIcon class="h-4 w-4" />
                                数据表
                            </button>
                        </div>
                    </div>
                    <AngleAnalysisChart :angles="analysis?.angles ?? []" />
                </section>

                <section class="analysis-workbench__timeline-section">
                    <div class="analysis-workbench__section-header">
                        <div class="analysis-workbench__section-header-left">
                            <h3 class="analysis-workbench__section-title">关键帧时间轴</h3>
                            <Info class="h-4 w-4 analysis-workbench__section-info" />
                        </div>
                        <div class="analysis-workbench__best-frame-badge">
                            <Bookmark class="h-3.5 w-3.5" />
                            <span
                                >最佳值
                                {{
                                    analysisReasons.length > 1 ? analysisReasons.length - 1 : 1
                                }}</span
                            >
                        </div>
                    </div>
                    <p class="analysis-workbench__timeline-hint">
                        分析帧数: {{ frames.length }} 片 片段区间: 0:00 —
                        {{
                            frames.length > 0
                                ? formatTime(frames[frames.length - 1]?.timestampMs ?? 0)
                                : "0:00"
                        }}
                    </p>
                    <div class="analysis-workbench__timeline-scroll">
                        <button
                            class="analysis-workbench__timeline-arrow"
                            @click="
                                analysisStore.selectVideoFrame(Math.max(0, currentFrameIndex - 1))
                            "
                        >
                            <ChevronLeft class="h-5 w-5" />
                        </button>
                        <div class="analysis-workbench__timeline-frames">
                            <button
                                v-for="(frame, idx) in frames.slice(0, 12)"
                                :key="idx"
                                class="analysis-workbench__timeline-frame"
                                :class="{
                                    'analysis-workbench__timeline-frame--active':
                                        currentFrameIndex === idx,
                                }"
                                @click="handleFrameSelect(idx)"
                            >
                                <img :src="frame.imageData" alt="" />
                                <span class="analysis-workbench__timeline-frame-time">{{
                                    formatTime(frame.timestampMs)
                                }}</span>
                            </button>
                        </div>
                        <button
                            class="analysis-workbench__timeline-arrow"
                            @click="
                                analysisStore.selectVideoFrame(
                                    Math.min(frames.length - 1, currentFrameIndex + 1),
                                )
                            "
                        >
                            <ChevronRight class="h-5 w-5" />
                        </button>
                    </div>
                </section>
            </div>

            <div class="analysis-workbench__right">
                <section class="analysis-workbench__deviation">
                    <div class="analysis-workbench__deviation-header">
                        <h3 class="analysis-workbench__deviation-title">关键角度偏差</h3>
                        <div class="analysis-workbench__deviation-legend">
                            <span
                                class="analysis-workbench__deviation-legend-item analysis-workbench__deviation-legend-item--error"
                                >偏差较大</span
                            >
                            <span
                                class="analysis-workbench__deviation-legend-item analysis-workbench__deviation-legend-item--warning"
                                >偏差一般</span
                            >
                            <span
                                class="analysis-workbench__deviation-legend-item analysis-workbench__deviation-legend-item--normal"
                                >表现良好</span
                            >
                        </div>
                    </div>
                    <AngleDeviationCards :angles="analysis?.angles ?? []" />
                </section>

                <section class="analysis-workbench__suggestions">
                    <div class="analysis-workbench__suggestions-header">
                        <h3 class="analysis-workbench__suggestions-title">AI姿势建议</h3>
                    </div>
                    <AISuggestionList
                        :suggestions="currentAiSuggestions"
                        :count="aiSuggestionsCount"
                    />
                </section>
            </div>
        </div>
    </div>
</template>

<style scoped>
.analysis-workbench {
    padding: clamp(3.75rem, 6vh, 4.5rem) 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-height: 100%;
}

.analysis-workbench__topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--surface-border);
}

.analysis-workbench__topbar-left {
    display: flex;
    align-items: flex-start;
    gap: 14px;
}

.analysis-workbench__heading {
    display: grid;
    gap: 8px;
}

.analysis-workbench__eyebrow {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.analysis-workbench__topbar-title {
    margin: 0;
    font-size: clamp(1.9rem, 1.55rem + 0.9vw, 2.45rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-primary);
}

.analysis-workbench__topbar-subtitle {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
}

.analysis-workbench__topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.analysis-workbench__topbar-actions {
    display: flex;
    gap: 8px;
}

.analysis-workbench__badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
}

.analysis-workbench__badge--success {
    background: color-mix(in srgb, var(--color-success) 14%, transparent);
    color: var(--color-success);
}

.analysis-workbench__body {
    display: grid;
    grid-template-columns: 1fr 420px;
    gap: 24px;
    flex: 1;
    align-items: start;
}

.analysis-workbench__left {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.analysis-workbench__top-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
}

.analysis-workbench__conclusion {
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.analysis-workbench__conclusion-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

.analysis-workbench__conclusion-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
}

.analysis-workbench__conclusion-main {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.analysis-workbench__judgment {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
}

.analysis-workbench__judgment-type {
    color: var(--accent-color);
}

.analysis-workbench__conclusion-desc {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
}

.analysis-workbench__conclusion-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

.analysis-workbench__card {
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--surface-border);
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.analysis-workbench__card-label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
}

.analysis-workbench__card-sublabel {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
}

.analysis-workbench__card--shot-type .analysis-workbench__card-shot-type-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    color: var(--accent-color);
    font-size: 14px;
    font-weight: 700;
    width: fit-content;
}

.analysis-workbench__card--score .analysis-workbench__card-score {
    display: flex;
    align-items: baseline;
    gap: 2px;
}

.analysis-workbench__card-score-number {
    font-size: 28px;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
}

.analysis-workbench__card-score-total {
    font-size: 14px;
    color: var(--text-muted);
    font-weight: 500;
}

.analysis-workbench__card--confidence .analysis-workbench__card-confidence-value {
    font-size: 24px;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
}

.analysis-workbench__card-confidence-bar {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text-muted) 16%, transparent);
    overflow: hidden;
}

.analysis-workbench__card-confidence-fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent-color);
    transition: width 300ms ease;
}

.analysis-workbench__reasons {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.analysis-workbench__reasons-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
}

.analysis-workbench__reasons-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    padding: 0;
    margin: 0;
}

.analysis-workbench__reason-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.55;
}

.analysis-workbench__reason-item svg {
    color: var(--color-success);
    flex-shrink: 0;
    margin-top: 1px;
}

.analysis-workbench__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.analysis-workbench__section-header-left {
    display: flex;
    align-items: center;
    gap: 6px;
}

.analysis-workbench__section-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
}

.analysis-workbench__section-info {
    color: var(--text-muted);
    cursor: pointer;
}

.analysis-workbench__chart-toggle {
    display: flex;
    gap: 4px;
}

.analysis-workbench__chart-toggle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 160ms ease;
}

.analysis-workbench__chart-toggle-btn--active {
    background: var(--accent-color);
    color: #fff;
    border-color: var(--accent-color);
}

.analysis-workbench__angle-chart-section {
    padding: 20px;
    border-radius: 16px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.analysis-workbench__best-frame-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--accent-color);
    font-size: 12px;
    font-weight: 600;
}

.analysis-workbench__timeline-section {
    padding: 20px;
    border-radius: 16px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.analysis-workbench__timeline-hint {
    font-size: 12px;
    color: var(--text-muted);
}

.analysis-workbench__timeline-scroll {
    display: flex;
    align-items: center;
    gap: 8px;
}

.analysis-workbench__timeline-arrow {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: all 160ms ease;
}

.analysis-workbench__timeline-arrow:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
}

.analysis-workbench__timeline-frames {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: thin;
    flex: 1;
    min-width: 0;
}

.analysis-workbench__timeline-frame {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px;
    border-radius: 10px;
    border: 2px solid transparent;
    cursor: pointer;
    background: var(--bg-solid);
    transition: all 160ms ease;
}

.analysis-workbench__timeline-frame:hover {
    border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
}

.analysis-workbench__timeline-frame--active {
    border-color: var(--accent-color);
    background: color-mix(in srgb, var(--accent-color) 8%, var(--bg-solid));
}

.analysis-workbench__timeline-frame img {
    width: 80px;
    height: 54px;
    object-fit: cover;
    border-radius: 6px;
    display: block;
}

.analysis-workbench__timeline-frame-time {
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.analysis-workbench__right {
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: sticky;
    top: 0;
}

.analysis-workbench__visualizer {
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.analysis-workbench__visualizer-header {
    display: flex;
    align-items: center;
    gap: 6px;
}

.analysis-workbench__visualizer-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
}

.analysis-workbench__video-player {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--surface-border);
    background: #0a0a0a;
}

.analysis-workbench__canvas {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
}

.analysis-workbench__video-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    color: var(--text-muted);
}

.analysis-workbench__video-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--bg-solid) 96%, #0a0a0a);
    border-top: 1px solid var(--surface-border);
}

.analysis-workbench__video-play-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--accent-color);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
}

.analysis-workbench__video-progress {
    flex: 1;
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text-muted) 20%, transparent);
    overflow: hidden;
}

.analysis-workbench__video-progress-fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent-color);
    transition: width 150ms ease;
}

.analysis-workbench__video-time {
    font-size: 11px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

.analysis-workbench__video-speeds {
    display: flex;
    gap: 3px;
    flex-shrink: 0;
}

.analysis-workbench__video-speed-btn {
    padding: 3px 8px;
    border-radius: 5px;
    border: 1px solid var(--surface-border);
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    transition: all 160ms ease;
}

.analysis-workbench__video-speed-btn--active {
    background: var(--accent-color);
    color: #fff;
    border-color: var(--accent-color);
}

.analysis-workbench__deviation {
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.analysis-workbench__deviation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.analysis-workbench__deviation-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
}

.analysis-workbench__deviation-legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.analysis-workbench__deviation-legend-item {
    font-size: 11px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 4px;
}

.analysis-workbench__deviation-legend-item::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 2px;
    display: block;
}

.analysis-workbench__deviation-legend-item--error::before {
    background: var(--color-danger);
}

.analysis-workbench__deviation-legend-item--warning::before {
    background: var(--color-warning);
}

.analysis-workbench__deviation-legend-item--normal::before {
    background: var(--color-success);
}

.analysis-workbench__suggestions {
    padding: 16px;
    border-radius: 16px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.analysis-workbench__suggestions-header {
    display: flex;
    align-items: center;
    gap: 6px;
}

.analysis-workbench__suggestions-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
}

@media (max-width: 1200px) {
    .analysis-workbench__body {
        grid-template-columns: 1fr;
    }

    .analysis-workbench__right {
        position: static;
    }
}

@media (max-width: 768px) {
    .analysis-workbench {
        padding: 16px 12px;
    }

    .analysis-workbench__topbar {
        flex-direction: column;
    }

    .analysis-workbench__conclusion-cards {
        grid-template-columns: 1fr;
    }
}
</style>
