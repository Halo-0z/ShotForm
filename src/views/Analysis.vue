<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import BasketballGlyph from "@/components/basketball/BasketballGlyph.vue"
import { ChevronLeft, ChevronRight, GitCompareArrows } from "lucide-vue-next"
import { Button } from "@/components/ui/button"
import { useAnalysisStore } from "@/stores/analysis"
import {
    getShotTypeName,
    getRecordShotType,
    getAngleDisplayName,
    type AnalysisHistory,
} from "@/types"
import { buildAnalysisReport, saveReportFile } from "@/lib/training-report"
import { localDate } from "@/lib/training-comparison.js"
import AngleAnalysisChart from "@/components/analysis/AngleAnalysisChart.vue"
import AngleDeviationCards from "@/components/analysis/AngleDeviationCards.vue"
import AISuggestionList from "@/components/analysis/AISuggestionList.vue"

const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)} 秒`
const router = useRouter()
const analysisStore = useAnalysisStore()

const analysis = computed(() => analysisStore.currentAnalysis)

const goToCompare = () => {
    router.push("/compare")
}
const videoAnalysis = computed(() => analysisStore.currentVideoAnalysis)
const currentFrameIndex = computed(() => analysisStore.currentVideoFrameIndex)
const frames = computed(() => videoAnalysis.value?.frames ?? [])
const hasPlayableFrames = computed(() => frames.value.length > 1)

const shotTypeName = computed(() => {
    return getShotTypeName(
        getRecordShotType({
            analysis: analysis.value,
            videoAnalysis: videoAnalysis.value,
        }),
    )
})

const displayAnalysis = computed(() => {
    if (videoAnalysis.value) {
        const va = videoAnalysis.value
        return va.frames[va.bestFrameIndex]?.analysis ?? analysis.value
    }
    return analysis.value
})

const confidencePercent = computed(() => {
    if (videoAnalysis.value) {
        return Math.round((videoAnalysis.value.overallShotTypeConfidence ?? 0) * 1000) / 10
    }
    if (!analysis.value) return 0
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
        return ["当前没有足够的判断依据，请结合清晰的完整动作片段分析。"]
    }
    return analysis.value.shotTypeReasons
})

const isPlaying = ref(false)
const showPose = ref(true)
const frameImageError = ref(false)
const angleView = ref("chart")
const stageRef = ref<HTMLElement | null>(null)
let stageObserver: ResizeObserver | undefined
const chartAnalysis = ref(displayAnalysis.value)
watch(analysis, (value) => {
    chartAnalysis.value = value
})
const playbackSpeed = ref(1)
const playbackFrameIndex = ref(0)
const videoCanvasRef = ref<HTMLCanvasElement | null>(null)
const playbackTimer = ref<number | null>(null)
const imageCache = new Map<string, HTMLImageElement>()
let drawRequestId = 0

const clampFrameIndex = (frameIndex: number) => {
    if (frames.value.length === 0) return 0
    return Math.min(Math.max(frameIndex, 0), frames.value.length - 1)
}

const playbackFrame = computed(() => {
    if (frames.value.length === 0) return null
    return frames.value[playbackFrameIndex.value] ?? frames.value[0]
})

const currentTimestampDisplay = computed(() => {
    if (frames.value.length === 0) return "0:00"
    const frame = frames.value[playbackFrameIndex.value]
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
    const frame = playbackFrame.value
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

    frameImageError.value = !frameImage
    const baseWidth = frameImage?.naturalWidth || poseData.width || 960
    const baseHeight = frameImage?.naturalHeight || poseData.height || 720
    const availableWidth = stageRef.value?.clientWidth || 800
    const availableHeight = stageRef.value?.clientHeight || 500
    const scale = Math.min(availableWidth / baseWidth, availableHeight / baseHeight)
    const displayWidth = Math.round(baseWidth * scale)
    const displayHeight = Math.round(baseHeight * scale)
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(displayWidth * dpr)
    canvas.height = Math.round(displayHeight * dpr)
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, displayWidth, displayHeight)
    context.fillStyle = "#0a0d12"
    context.fillRect(0, 0, displayWidth, displayHeight)
    if (frameImage) context.drawImage(frameImage, 0, 0, displayWidth, displayHeight)
    if (!showPose.value) return
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
        context.shadowBlur = 0
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
        context.shadowBlur = 0
        context.fill()
    })
}

const handleFrameSelect = (frameIndex: number) => {
    isPlaying.value = false
    if (playbackTimer.value) clearTimeout(playbackTimer.value)
    playbackTimer.value = null
    void analysisStore.selectVideoFrame(frameIndex)
    playbackFrameIndex.value = clampFrameIndex(frameIndex)
    chartAnalysis.value = analysis.value
    void drawFrame()
}

const togglePlayback = () => {
    isPlaying.value = !isPlaying.value
    if (isPlaying.value) {
        startPlayback()
    } else {
        if (playbackTimer.value) clearTimeout(playbackTimer.value)
        playbackTimer.value = null
        handleFrameSelect(playbackFrameIndex.value)
    }
}

const startPlayback = () => {
    if (playbackTimer.value) clearTimeout(playbackTimer.value)
    if (frames.value.length <= 1) {
        playbackTimer.value = null
        return
    }
    const current = frames.value[playbackFrameIndex.value]
    const nextIndex = (playbackFrameIndex.value + 1) % frames.value.length
    const next = frames.value[nextIndex]
    const delta = nextIndex === 0 ? 500 : next.timestampMs - current.timestampMs
    const interval = Math.max(40, Math.min(2000, delta || 500)) / playbackSpeed.value
    playbackTimer.value = window.setTimeout(() => {
        if (!isPlaying.value || !frames.value.length) return
        playbackFrameIndex.value = nextIndex
        startPlayback()
    }, interval)
}

const actionMessage = ref("")
const isExporting = ref(false)
const reportRecord = (): AnalysisHistory => ({
    id: analysisStore.currentHistoryId ?? 0,
    imagePath: analysisStore.currentImage,
    annotatedImagePath: analysisStore.currentAnnotatedImage,
    analysis: analysis.value!,
    comparison: analysisStore.currentComparisonSnapshot,
    suggestions: analysisStore.currentRuleSuggestions,
    aiCoachingSummary:
        analysisStore.coachingSources.ai.state === "done"
            ? analysisStore.coachingSources.ai.summary
            : null,
    aiCoachingSuggestions:
        analysisStore.coachingSources.ai.state === "done"
            ? analysisStore.coachingSources.ai.data
            : null,
    videoAnalysis: videoAnalysis.value
        ? { ...videoAnalysis.value, bestFrameIndex: currentFrameIndex.value }
        : null,
    createdAt: analysis.value!.timestamp,
    ...analysisStore.currentTrainingMetadata,
    trainingDate:
        analysisStore.currentTrainingMetadata.trainingDate || localDate(analysis.value!.timestamp),
})
const handleSave = async () => {
    actionMessage.value = ""
    try {
        const id = await analysisStore.saveToHistory()
        actionMessage.value = `已保存记录 #${id}，可到历史记录编辑训练日期和备注。`
    } catch (error) {
        actionMessage.value = `保存失败，请重试：${String(error)}`
    }
}
const handleExport = async (extension: "html" | "json" = "html") => {
    if (!analysis.value || isExporting.value) return
    isExporting.value = true
    actionMessage.value = ""
    try {
        const record = reportRecord()
        const content =
            extension === "html" ? buildAnalysisReport(record) : JSON.stringify(record, null, 2)
        actionMessage.value = (await saveReportFile(content, extension))
            ? "报告已导出"
            : "已取消导出"
    } catch (error) {
        actionMessage.value = `导出失败：${String(error)}`
    } finally {
        isExporting.value = false
    }
}

const handleGenerateAiCoaching = async () => {
    if (analysisStore.coachingSources.ai.state === "loading" || !analysis.value) {
        return
    }
    await analysisStore.generateAiCoaching({ force: true })
}

const handleWindowResize = () => {
    void drawFrame()
}

watch(
    frames,
    async () => {
        const bestFrameIndex = videoAnalysis.value?.bestFrameIndex ?? currentFrameIndex.value
        playbackFrameIndex.value = clampFrameIndex(bestFrameIndex)
        await preloadImages()
        await drawFrame()
        if (videoAnalysis.value && !chartAnalysis.value) {
            chartAnalysis.value = displayAnalysis.value
        }
        if (isPlaying.value) {
            startPlayback()
        } else if (playbackTimer.value && frames.value.length <= 1) {
            clearTimeout(playbackTimer.value)
            playbackTimer.value = null
        }
    },
    { deep: true, immediate: true },
)

watch(playbackFrameIndex, async () => {
    await drawFrame()
})

watch(currentFrameIndex, async (frameIndex) => {
    chartAnalysis.value = analysis.value
    playbackFrameIndex.value = clampFrameIndex(frameIndex)
    await drawFrame()
})

watch(playbackSpeed, () => {
    if (isPlaying.value) {
        if (playbackTimer.value) clearTimeout(playbackTimer.value)
        startPlayback()
    }
})

watch(showPose, () => {
    void drawFrame()
})
watch(stageRef, (stage) => {
    stageObserver?.disconnect()
    if (stage) {
        stageObserver = new ResizeObserver(() => {
            void drawFrame()
        })
        stageObserver.observe(stage)
    }
})
const imageSource = computed(() =>
    showPose.value
        ? analysisStore.currentAnnotatedImage || analysisStore.currentImage
        : analysisStore.currentImage || analysisStore.currentAnnotatedImage,
)
const frameLabel = computed(() =>
    videoAnalysis.value
        ? `分析帧 ${currentFrameIndex.value + 1} / ${frames.value.length}`
        : "图片分析",
)
const validAngles = computed(() =>
    (chartAnalysis.value?.angles ?? []).filter((a) => Number.isFinite(a.value)),
)
onMounted(() => {
    window.addEventListener("resize", handleWindowResize)
    if (isPlaying.value) {
        startPlayback()
    }
})

onUnmounted(() => {
    stageObserver?.disconnect()
    if (playbackTimer.value) clearTimeout(playbackTimer.value)
    window.removeEventListener("resize", handleWindowResize)
})
</script>

<template>
    <main v-if="!analysis" class="analysis-workbench ui-page ui-empty ui-enter">
        <BasketballGlyph name="replay" />
        <h1>尚无分析结果</h1>
        <p>请先上传清晰的单人投篮图片或短视频。</p>
        <Button @click="router.push('/upload')">上传素材</Button>
    </main>
    <main v-else class="analysis-workbench ui-page ui-enter">
        <header class="ui-page__header analysis-workbench__topbar">
            <div>
                <h1>投篮动作分析</h1>
                <p>{{ frameLabel }}</p>
            </div>
            <div class="ui-actions analysis-workbench__topbar-actions">
                <Button
                    variant="outline"
                    size="sm"
                    :disabled="isExporting || isPlaying"
                    @click="handleExport('html')"
                    ><BasketballGlyph name="export" />导出 HTML 报告</Button
                >
                <Button
                    variant="outline"
                    size="sm"
                    :disabled="isExporting || isPlaying"
                    @click="handleExport('json')"
                    ><BasketballGlyph name="export" />导出 JSON</Button
                >
                <Button
                    size="sm"
                    :disabled="
                        analysisStore.isSavingHistory ||
                        analysisStore.currentHistoryId != null ||
                        analysisStore.coachingSources.rule.state === 'loading' ||
                        isPlaying
                    "
                    @click="handleSave"
                    ><BasketballGlyph name="save" />{{
                        analysisStore.isSavingHistory
                            ? "保存中…"
                            : analysisStore.currentHistoryId != null
                              ? "已保存历史记录"
                              : "保存历史记录"
                    }}</Button
                >
            </div>
        </header>
        <p v-if="actionMessage" role="status" class="ui-notice">{{ actionMessage }}</p>
        <div class="analysis-workbench__body" data-allow-copy="true">
            <div class="analysis-workbench__left">
                <section class="analysis-workbench__visualizer" aria-label="动作回放">
                    <div class="replay-toolbar">
                        <div class="replay-modes" role="group" aria-label="画面显示方式">
                            <button
                                :aria-pressed="!showPose"
                                :class="{ active: !showPose }"
                                @click="showPose = false"
                            >
                                原始画面
                            </button>
                            <button
                                :aria-pressed="showPose"
                                :class="{ active: showPose }"
                                @click="showPose = true"
                            >
                                姿态叠加
                            </button>
                        </div>
                        <span>{{
                            frames.length
                                ? `预览帧 ${playbackFrameIndex + 1} / ${frames.length}`
                                : "单张图片"
                        }}</span>
                    </div>
                    <div ref="stageRef" class="analysis-workbench__video-player">
                        <p
                            v-if="frames.length && frameImageError"
                            class="replay-missing replay-image-error"
                        >
                            原始帧图像无法加载，当前仅显示可用的姿态关键点。
                        </p>
                        <canvas
                            v-if="frames.length"
                            ref="videoCanvasRef"
                            class="analysis-workbench__canvas"
                            role="img"
                            :aria-label="`投篮动作第 ${playbackFrameIndex + 1} 帧`"
                        />
                        <img
                            v-else-if="imageSource"
                            :src="imageSource"
                            alt="图片姿态分析"
                            class="analysis-image"
                        />
                        <p v-else class="replay-missing">
                            此记录没有可显示的图像，仍可查看已保存的分析数据。
                        </p>
                    </div>
                    <div v-if="frames.length" class="analysis-workbench__video-controls">
                        <button
                            class="replay-icon"
                            aria-label="上一帧"
                            :disabled="playbackFrameIndex === 0"
                            @click="handleFrameSelect(playbackFrameIndex - 1)"
                        >
                            <ChevronLeft />
                        </button>
                        <button
                            class="replay-icon replay-play"
                            :aria-label="isPlaying ? '暂停回放' : '播放回放'"
                            :disabled="!hasPlayableFrames"
                            @click="togglePlayback"
                        >
                            <BasketballGlyph v-if="isPlaying" name="pause" /><BasketballGlyph
                                v-else
                                name="play"
                            />
                        </button>
                        <button
                            class="replay-icon"
                            aria-label="下一帧"
                            :disabled="playbackFrameIndex === frames.length - 1"
                            @click="handleFrameSelect(playbackFrameIndex + 1)"
                        >
                            <ChevronRight />
                        </button>
                        <span class="replay-time"
                            >{{ currentTimestampDisplay }} /
                            {{ formatTime(frames[frames.length - 1]?.timestampMs ?? 0) }}</span
                        >
                        <label class="replay-speed"
                            >速度<select v-model="playbackSpeed" aria-label="回放速度">
                                <option :value="0.5">0.5×</option>
                                <option :value="1">1×</option>
                                <option :value="1.5">1.5×</option>
                            </select></label
                        >
                    </div>
                    <div v-if="frames.length" class="analysis-workbench__timeline-section">
                        <div class="timeline-heading">
                            <h2>关键帧</h2>
                            <span>点击一帧，查看对应角度与建议</span>
                        </div>
                        <div
                            class="analysis-workbench__timeline-frames"
                            role="group"
                            aria-label="关键帧时间轴"
                        >
                            <button
                                v-for="(frame, idx) in frames"
                                :key="idx"
                                class="analysis-workbench__timeline-frame"
                                :class="{
                                    'analysis-workbench__timeline-frame--active':
                                        currentFrameIndex === idx,
                                }"
                                :aria-pressed="currentFrameIndex === idx"
                                :aria-label="`选择第 ${idx + 1} 帧`"
                                @click="handleFrameSelect(idx)"
                            >
                                <img :src="frame.imageData" alt="" /><span
                                    >{{ idx + 1 }} · {{ formatTime(frame.timestampMs) }}</span
                                >
                            </button>
                        </div>
                    </div>
                </section>
                <section class="analysis-workbench__angle-chart-section">
                    <div class="replay-toolbar">
                        <h2>关节角度</h2>
                        <div class="replay-modes" role="group" aria-label="角度显示方式">
                            <button
                                :class="{ active: angleView === 'chart' }"
                                :aria-pressed="angleView === 'chart'"
                                @click="angleView = 'chart'"
                            >
                                图表</button
                            ><button
                                :class="{ active: angleView === 'table' }"
                                :aria-pressed="angleView === 'table'"
                                @click="angleView = 'table'"
                            >
                                数据表
                            </button>
                        </div>
                    </div>
                    <p class="replay-caption">
                        {{ frameLabel }} · 角度用于观察动作，不代表投篮水平评分。
                    </p>
                    <AngleAnalysisChart
                        v-if="angleView === 'chart'"
                        :angles="chartAnalysis?.angles ?? []"
                    />
                    <div v-else class="angle-table-wrap">
                        <table class="angle-table">
                            <thead>
                                <tr>
                                    <th>关节</th>
                                    <th>当前角度</th>
                                    <th>参考范围</th>
                                    <th>识别状态</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="angle in validAngles" :key="angle.name">
                                    <th>{{ getAngleDisplayName(angle.name) }}</th>
                                    <td>
                                        {{
                                            angle.status === "low_confidence" || angle.value <= 0
                                                ? "暂不判断"
                                                : `${angle.value.toFixed(1)}°`
                                        }}
                                    </td>
                                    <td>{{ angle.normalRange[0] }}°–{{ angle.normalRange[1] }}°</td>
                                    <td>
                                        {{
                                            angle.status === "low_confidence" || angle.value <= 0
                                                ? "识别不稳定"
                                                : angle.status === "normal"
                                                  ? "位于参考范围"
                                                  : "超出参考范围"
                                        }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <p v-if="!validAngles.length" class="replay-caption">
                            当前帧没有可用的角度数据。
                        </p>
                    </div>
                </section>
            </div>
            <aside class="analysis-workbench__right" aria-label="分析判断与依据">
                <section class="analysis-workbench__conclusion">
                    <div class="replay-toolbar">
                        <h2>本次分析结论</h2>
                        <span>{{ videoAnalysis ? "整段视频" : "单帧判断" }}</span>
                    </div>
                    <h3 class="analysis-workbench__judgment">{{ shotTypeName }}</h3>
                    <div class="confidence-row">
                        <span>分型置信度</span><strong>{{ confidencePercent }}%</strong>
                    </div>
                    <div class="confidence-track">
                        <div
                            :style="{ width: `${Math.max(0, Math.min(100, confidencePercent))}%` }"
                        />
                    </div>
                    <p class="replay-caption">{{ confidenceGrade }}</p>
                    <ul class="analysis-reasons">
                        <li v-for="(reason, index) in analysisReasons" :key="index">
                            {{ reason }}
                        </li>
                    </ul>
                </section>
                <section class="analysis-workbench__deviation">
                    <h2>当前帧角度</h2>
                    <p class="replay-caption">
                        {{ isPlaying ? "播放预览中，暂停后更新当前帧。" : frameLabel }}
                    </p>
                    <AngleDeviationCards :angles="chartAnalysis?.angles ?? []" />
                </section>
                <section class="analysis-workbench__suggestions">
                    <h2>训练建议</h2>
                    <AISuggestionList
                        :rule-source="analysisStore.coachingSources.rule"
                        :ai-source="analysisStore.coachingSources.ai"
                        @generate="handleGenerateAiCoaching"
                    />
                </section>
                <Button variant="outline" @click="goToCompare"
                    ><GitCompareArrows class="h-4 w-4" />球星对比</Button
                >
            </aside>
        </div>
    </main>
</template>
<style scoped>
.analysis-workbench {
    --replay-stage-height: clamp(300px, 49vh, 550px);
}
.analysis-workbench__topbar {
    padding-bottom: 18px;
    border-bottom: 1px solid var(--surface-border);
    margin-bottom: 20px;
}
.analysis-meta {
    margin-left: 14px;
    padding-left: 14px;
    border-left: 1px solid var(--surface-border);
}
.analysis-workbench__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 28px;
    align-items: start;
}
.analysis-workbench__left {
    min-width: 0;
}
.analysis-workbench__right {
    border-left: 1px solid var(--surface-border);
    padding-left: 24px;
    min-width: 0;
    display: grid;
    gap: 24px;
}
h2 {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.5;
    margin: 0;
}
.replay-toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
.replay-toolbar > span,
.timeline-heading span {
    font-size: 13px;
    color: var(--text-muted);
}
.replay-modes {
    display: flex;
    gap: 4px;
}
.replay-modes button {
    padding: 7px 10px;
    color: var(--text-secondary);
    border-radius: 5px;
    border: 1px solid transparent;
    font-size: 14px;
}
.replay-modes .active {
    color: var(--selection-text);
    background: var(--selection-bg);
    border-color: color-mix(in srgb, var(--primary-color) 35%, transparent);
}
.analysis-workbench__video-player {
    display: grid;
    place-items: center;
    height: var(--replay-stage-height);
    background: var(--stage-bg);
    border-radius: 6px;
    overflow: hidden;
}
.analysis-image {
    display: block;
    width: 100%;
    height: 100%;
    max-height: var(--replay-stage-height);
    object-fit: contain;
}
.analysis-workbench__canvas {
    display: block;
    max-width: 100%;
    object-fit: contain;
}
.replay-missing {
    color: #c2ccd8;
    max-width: 40ch;
    padding: 20px;
    text-align: center;
}
.analysis-workbench__video-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 0;
    flex-wrap: wrap;
}
.replay-icon {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text-primary);
}
.replay-icon svg {
    width: 18px;
    height: 18px;
}
.replay-icon:disabled {
    opacity: 0.4;
}
.replay-play {
    color: var(--action-text);
    background: var(--primary-color);
}
.replay-time {
    font-family: var(--font-mono);
    font-size: 13px;
    margin-left: 6px;
}
.replay-speed {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
}
.replay-speed select {
    padding: 5px 8px;
}
.timeline-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0 12px;
}
.analysis-workbench__timeline-frames {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 3px 3px 10px;
}
.analysis-workbench__timeline-frame {
    flex: 0 0 112px;
    border: 2px solid transparent;
    border-radius: 5px;
    overflow: hidden;
    color: var(--text-secondary);
    background: var(--card-bg);
    padding: 2px;
}
.analysis-workbench__timeline-frame img {
    width: 100%;
    height: 72px;
    object-fit: contain;
    background: var(--stage-bg);
}
.analysis-workbench__timeline-frame span {
    display: block;
    padding: 4px;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
}
.analysis-workbench__timeline-frame--active {
    border-color: var(--evidence-text);
    color: var(--evidence-text);
}
.analysis-workbench__angle-chart-section {
    border-top: 1px solid var(--surface-border);
    padding-top: 22px;
    margin-top: 22px;
}
.analysis-workbench__judgment {
    margin: 14px 0 20px;
    font-size: 26px;
    line-height: 1.4;
    color: var(--evidence-text);
}
.confidence-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--text-secondary);
}
.confidence-row strong {
    color: var(--text-primary);
    font-size: 18px;
}
.confidence-track {
    height: 3px;
    margin-top: 10px;
    background: var(--surface-border);
}
.confidence-track div {
    height: 100%;
    background: var(--evidence-text);
}
.replay-caption {
    margin: 9px 0 14px;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.7;
}
.analysis-reasons {
    padding-left: 18px;
    margin: 16px 0 0;
    color: var(--text-secondary);
    font-size: 14px;
    line-height: 1.7;
}
.analysis-reasons li + li {
    margin-top: 8px;
}
.analysis-workbench__deviation,
.analysis-workbench__suggestions {
    border-top: 1px solid var(--surface-border);
    padding-top: 22px;
}
.analysis-workbench__suggestions h2 {
    margin-bottom: 14px;
}
.angle-table-wrap {
    overflow-x: auto;
}
.angle-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}
.angle-table th,
.angle-table td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--surface-border);
    white-space: nowrap;
}
.angle-table thead {
    color: var(--text-secondary);
}
.angle-table th {
    font-weight: 500;
}
@media (min-width: 1600px) {
    .analysis-workbench__body {
        grid-template-columns: minmax(0, 1fr) 360px;
    }
}
@media (max-width: 1100px) {
    .analysis-workbench__body {
        grid-template-columns: minmax(0, 1fr) 290px;
        gap: 20px;
    }
    .analysis-workbench__right {
        padding-left: 20px;
    }
}
@media (max-width: 850px) {
    .analysis-workbench__body {
        grid-template-columns: 1fr;
    }
    .analysis-workbench__right {
        border-left: 0;
        padding-left: 0;
    }
    .analysis-workbench__topbar-actions {
        width: 100%;
    }
    .analysis-workbench__right {
        border-top: 1px solid var(--surface-border);
        padding-top: 24px;
    }
    .timeline-heading {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
    }
}
.replay-image-error {
    position: absolute;
    top: 0;
    z-index: 1;
    background: #0a0d12;
}
.analysis-workbench__video-player {
    position: relative;
}
</style>
