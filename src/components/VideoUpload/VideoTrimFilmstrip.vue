<script setup lang="ts">
import {
    computed,
    nextTick,
    onMounted,
    onUnmounted,
    ref,
    watch,
    type ComponentPublicInstance,
} from "vue"
import { Play, Pause } from "lucide-vue-next"

const props = withDefaults(
    defineProps<{
        previewUrl: string
        durationMs: number
        trimStartMs: number
        trimEndMs: number
        minClipMs?: number
        compact?: boolean
        disabled?: boolean
        isPreviewing?: boolean
    }>(),
    {
        minClipMs: 300,
        compact: false,
        disabled: false,
        isPreviewing: false,
    },
)

const emit = defineEmits<{
    (e: "update:trimStartMs", value: number): void
    (e: "update:trimEndMs", value: number): void
    (e: "preview"): void
}>()

const timelineCaptureVideoRef = ref<HTMLVideoElement | null>(null)
const timelineFilmstripRef = ref<HTMLElement | null>(null)
const filmstripCanvasRef = ref<HTMLCanvasElement | null>(null)
const isRenderingFilmstrip = ref(false)
const filmstripRenderError = ref("")
const timelineRailWidth = ref(0)
const timelineRailHeight = ref(0)

const frameBitmaps = ref<(ImageBitmap | null)[]>([])
const frameBitmapVideoW = ref(0)
const frameBitmapVideoH = ref(0)
const frameBitmapSourceUrl = ref("")

const configuredMinClipMs = computed(() => Math.max(0, props.minClipMs || 0))
const sliderMaxMs = computed(() => Math.max(0, props.durationMs))
const effectiveMinClipMs = computed(() => Math.min(configuredMinClipMs.value, sliderMaxMs.value))
const safeTrimEndMs = computed(() => Math.min(Math.max(0, props.trimEndMs), sliderMaxMs.value))
const trimStartPercent = computed(() =>
    sliderMaxMs.value <= 0 ? 0 : (props.trimStartMs / sliderMaxMs.value) * 100,
)
const trimEndPercent = computed(() =>
    sliderMaxMs.value <= 0 ? 100 : (safeTrimEndMs.value / sliderMaxMs.value) * 100,
)
const trimMidpointPercent = computed(() => (trimStartPercent.value + trimEndPercent.value) / 2)
const filmstripOverlayStyle = computed(() => ({
    "--clip-start-percent": `${Math.max(0, Math.min(100, trimStartPercent.value))}%`,
    "--clip-end-percent": `${Math.max(0, Math.min(100, trimEndPercent.value))}%`,
}))
const clipStartHandleStyle = computed(() => ({
    left: `${Math.max(0, Math.min(100, trimStartPercent.value))}%`,
}))
const clipEndHandleStyle = computed(() => ({
    left: `${Math.max(0, Math.min(100, trimEndPercent.value))}%`,
}))
const clipStartInputStyle = computed(() => ({
    clipPath: `inset(0 ${Math.max(0, 100 - trimMidpointPercent.value)}% 0 0 round 1.35rem)`,
}))
const clipEndInputStyle = computed(() => ({
    clipPath: `inset(0 0 0 ${Math.max(0, trimMidpointPercent.value)}% round 1.35rem)`,
}))
const previewButtonLabel = computed(() =>
    props.isPreviewing ? "停止预览裁剪片段" : "预览裁剪片段",
)

let filmstripRenderId = 0
let timelineResizeObserver: ResizeObserver | null = null
let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null

const resolveRailSize = () => {
    const measuredWidth = Math.round(timelineFilmstripRef.value?.clientWidth || 0)
    const measuredHeight = Math.round(timelineFilmstripRef.value?.clientHeight || 0)
    const railWidth = Math.max(
        1,
        measuredWidth || timelineRailWidth.value || (props.compact ? 420 : 640),
    )
    const railHeight = Math.max(
        1,
        measuredHeight || timelineRailHeight.value || (props.compact ? 58 : 72),
    )

    timelineRailWidth.value = railWidth
    timelineRailHeight.value = railHeight

    return { railWidth, railHeight }
}

const prepareCanvasContext = (railWidth: number, railHeight: number) => {
    const canvas = filmstripCanvasRef.value
    if (!canvas) return null

    const filmstripCanvasDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    canvas.width = Math.round(railWidth * filmstripCanvasDpr)
    canvas.height = Math.round(railHeight * filmstripCanvasDpr)
    canvas.style.width = `${railWidth}px`
    canvas.style.height = `${railHeight}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.setTransform(filmstripCanvasDpr, 0, 0, filmstripCanvasDpr, 0, 0)
    ctx.clearRect(0, 0, railWidth, railHeight)
    ctx.fillStyle = "#10141d"
    ctx.fillRect(0, 0, railWidth, railHeight)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    return ctx
}

const clearFilmstripCanvas = () => {
    const { railWidth, railHeight } = resolveRailSize()
    prepareCanvasContext(railWidth, railHeight)
}

const releaseFrameBitmaps = () => {
    for (const bitmap of frameBitmaps.value) {
        bitmap?.close()
    }
    frameBitmaps.value = []
    frameBitmapVideoW.value = 0
    frameBitmapVideoH.value = 0
    frameBitmapSourceUrl.value = ""
}

const resetFilmstripRender = () => {
    filmstripRenderId += 1
    isRenderingFilmstrip.value = false
    filmstripRenderError.value = ""
    releaseFrameBitmaps()
    clearFilmstripCanvas()
}

const syncTimelineRailSize = () => {
    const nextWidth = Math.round(timelineFilmstripRef.value?.clientWidth || 0)
    const nextHeight = Math.round(timelineFilmstripRef.value?.clientHeight || 0)

    if (nextWidth > 0) timelineRailWidth.value = nextWidth
    if (nextHeight > 0) timelineRailHeight.value = nextHeight
}

const handleResize = () => {
    const nextWidth = Math.round(timelineFilmstripRef.value?.clientWidth || 0)
    const nextHeight = Math.round(timelineFilmstripRef.value?.clientHeight || 0)
    if (nextWidth !== timelineRailWidth.value || nextHeight !== timelineRailHeight.value) {
        timelineRailWidth.value = nextWidth
        timelineRailHeight.value = nextHeight
    }
}

const bindTimelineFilmstrip = (element: Element | ComponentPublicInstance | null) => {
    const nextElement = element instanceof HTMLElement ? element : null
    if (timelineResizeObserver) {
        timelineResizeObserver.disconnect()
        timelineResizeObserver = null
    }

    timelineFilmstripRef.value = nextElement
    syncTimelineRailSize()

    if (nextElement && typeof ResizeObserver !== "undefined") {
        timelineResizeObserver = new ResizeObserver(() => {
            if (resizeDebounceTimer) return
            resizeDebounceTimer = window.setTimeout(() => {
                resizeDebounceTimer = null
                handleResize()
            }, 200)
        })
        timelineResizeObserver.observe(nextElement)
    }
}

const waitForVideoEvent = (
    video: HTMLVideoElement,
    eventName: "loadeddata" | "seeked",
    timeoutMs = 8000,
) =>
    new Promise<void>((resolve, reject) => {
        let settled = false
        const timeoutId = window.setTimeout(() => {
            if (settled) return
            settled = true
            video.removeEventListener(eventName, handleResolve)
            video.removeEventListener("error", handleError)
            reject(new Error(`video ${eventName} timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        const handleResolve = () => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
            video.removeEventListener("error", handleError)
            resolve()
        }

        const handleError = () => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
            video.removeEventListener(eventName, handleResolve)
            reject(new Error(`video ${eventName} failed`))
        }

        video.addEventListener(eventName, handleResolve, { once: true })
        video.addEventListener("error", handleError, { once: true })
    })

const seekVideoWithRetry = async (
    video: HTMLVideoElement,
    timeInSeconds: number,
    maxRetries = 3,
) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            if (Math.abs(video.currentTime - timeInSeconds) < 0.01) {
                await new Promise<void>((r) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => r())),
                )
                return
            }

            const seeked = waitForVideoEvent(video, "seeked", 8000)
            video.currentTime = timeInSeconds
            await seeked

            await new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
            )
            return
        } catch {
            if (attempt === maxRetries - 1)
                throw new Error(
                    `seek to ${timeInSeconds.toFixed(2)}s failed after ${maxRetries} retries`,
                )
            await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
        }
    }
}

const drawFrameFromBitmap = (
    ctx: CanvasRenderingContext2D,
    bitmap: ImageBitmap,
    frameIndex: number,
    captureCount: number,
    railWidth: number,
    railHeight: number,
) => {
    const frameCellWidth = railWidth / captureCount
    const cellX = frameIndex * frameCellWidth
    const scale = Math.min(frameCellWidth / bitmap.width, railHeight / bitmap.height)
    const drawW = bitmap.width * scale
    const drawH = bitmap.height * scale
    const drawX = cellX + (frameCellWidth - drawW) / 2
    const drawY = (railHeight - drawH) / 2

    ctx.save()
    ctx.beginPath()
    ctx.rect(cellX, 0, frameCellWidth, railHeight)
    ctx.clip()
    ctx.fillStyle = "#10141d"
    ctx.fillRect(cellX, 0, frameCellWidth, railHeight)
    ctx.drawImage(bitmap, drawX, drawY, drawW, drawH)

    if (frameIndex > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)"
        ctx.fillRect(cellX, 0, 1, railHeight)
    }
    ctx.restore()
}

const repaintFromCache = (railWidth: number, railHeight: number) => {
    const bitmaps = frameBitmaps.value
    if (bitmaps.length === 0) return

    const ctx = prepareCanvasContext(railWidth, railHeight)
    if (!ctx) return

    const captureCount = bitmaps.length

    for (let i = 0; i < captureCount; i++) {
        const bitmap = bitmaps[i]
        if (!bitmap) continue
        drawFrameFromBitmap(ctx, bitmap, i, captureCount, railWidth, railHeight)
    }
}

const captureFrameAsBitmap = async (video: HTMLVideoElement): Promise<ImageBitmap | null> => {
    if (video.videoWidth === 0 || video.videoHeight === 0) return null

    try {
        return await createImageBitmap(video, {
            resizeWidth: Math.max(video.videoWidth, 640),
            resizeHeight: Math.max(video.videoHeight, 360),
            resizeQuality: "high",
        })
    } catch {
        return null
    }
}

const captureFramesBatch = async (
    captureVideo: HTMLVideoElement,
    batchIndices: number[],
    totalCount: number,
    durationSeconds: number,
    generationId: number,
): Promise<(ImageBitmap | null)[]> => {
    const results: (ImageBitmap | null)[] = batchIndices.map(() => null)

    for (const actualIndex of batchIndices) {
        if (generationId !== filmstripRenderId) return results

        const progress = totalCount === 1 ? 0.5 : actualIndex / (totalCount - 1)
        const targetTime = Math.min(progress * durationSeconds, Math.max(0, durationSeconds - 0.05))

        await seekVideoWithRetry(captureVideo, targetTime)
        try {
            results[batchIndices.indexOf(actualIndex)] = await captureFrameAsBitmap(captureVideo)
        } catch {
            results[batchIndices.indexOf(actualIndex)] = null
        }
    }

    return results
}

const requestIdleOrTimeout = (callback: () => void, fallbackMs = 16) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        window.requestIdleCallback(() => callback(), { timeout: fallbackMs })
    } else {
        setTimeout(callback, fallbackMs)
    }
}

const renderFilmstripFrames = async () => {
    if (!props.previewUrl || props.durationMs <= 0 || typeof document === "undefined") {
        filmstripRenderError.value = ""
        clearFilmstripCanvas()
        return
    }

    const { railWidth, railHeight } = resolveRailSize()
    const generationId = ++filmstripRenderId
    isRenderingFilmstrip.value = true
    filmstripRenderError.value = ""

    const captureVideo = timelineCaptureVideoRef.value
    if (!captureVideo) {
        isRenderingFilmstrip.value = false
        return
    }

    const sourceChanged = frameBitmapSourceUrl.value !== props.previewUrl
    if (!sourceChanged && frameBitmaps.value.length > 0) {
        repaintFromCache(railWidth, railHeight)
        isRenderingFilmstrip.value = false
        return
    }

    const ctx = prepareCanvasContext(railWidth, railHeight)
    if (!ctx) {
        isRenderingFilmstrip.value = false
        return
    }

    try {
        if (captureVideo.src !== props.previewUrl) {
            releaseFrameBitmaps()
            captureVideo.src = props.previewUrl
        }

        if (captureVideo.readyState < 2) {
            try {
                const loaded = waitForVideoEvent(captureVideo, "loadeddata", 12000)
                captureVideo.load()
                await loaded
            } catch {
                if (captureVideo.readyState < 2) {
                    await new Promise((r) => setTimeout(r, 800))
                }
            }
        }

        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        if (captureVideo.videoWidth === 0 || captureVideo.videoHeight === 0) {
            await new Promise((r) => setTimeout(r, 600))
        }

        const captureCount = Math.min(10, Math.max(6, Math.round(railWidth / 112)))
        const durationSeconds = Math.max(props.durationMs / 1000, 0.1)

        const batch1 = Array.from({ length: Math.min(4, captureCount) }, (_, i) => i)
        const remaining = Array.from({ length: captureCount }, (_, i) => i).filter(
            (i) => !batch1.includes(i),
        )
        const batch2Indices = remaining.filter((_, idx) => idx % 2 === 0)
        const batch3Indices = remaining.filter((_, idx) => idx % 2 === 1)

        const allBitmaps = new Array<ImageBitmap | null>(captureCount).fill(null)

        const batch1Results = await captureFramesBatch(
            captureVideo,
            batch1,
            captureCount,
            durationSeconds,
            generationId,
        )
        for (let i = 0; i < batch1.length; i++) {
            const bitmap = batch1Results[i]
            allBitmaps[batch1[i]] = bitmap
            if (bitmap) {
                drawFrameFromBitmap(ctx, bitmap, batch1[i], captureCount, railWidth, railHeight)
            }
        }

        if (generationId !== filmstripRenderId) return

        const renderBatch2 = () => {
            if (generationId !== filmstripRenderId) return
            requestAnimationFrame(async () => {
                const results = await captureFramesBatch(
                    captureVideo,
                    batch2Indices,
                    captureCount,
                    durationSeconds,
                    generationId,
                )
                for (let i = 0; i < batch2Indices.length; i++) {
                    const bitmap = results[i]
                    allBitmaps[batch2Indices[i]] = bitmap
                    if (bitmap) {
                        drawFrameFromBitmap(
                            ctx,
                            bitmap,
                            batch2Indices[i],
                            captureCount,
                            railWidth,
                            railHeight,
                        )
                    }
                }

                if (generationId !== filmstripRenderId) return

                const results3 = await captureFramesBatch(
                    captureVideo,
                    batch3Indices,
                    captureCount,
                    durationSeconds,
                    generationId,
                )
                for (let i = 0; i < batch3Indices.length; i++) {
                    const bitmap = results3[i]
                    allBitmaps[batch3Indices[i]] = bitmap
                    if (bitmap && ctx) {
                        drawFrameFromBitmap(
                            ctx,
                            bitmap,
                            batch3Indices[i],
                            captureCount,
                            railWidth,
                            railHeight,
                        )
                    }
                }

                frameBitmaps.value = allBitmaps
                frameBitmapVideoW.value = captureVideo.videoWidth || 640
                frameBitmapVideoH.value = captureVideo.videoHeight || 360
                frameBitmapSourceUrl.value = props.previewUrl
            })
        }

        requestIdleOrTimeout(renderBatch2, 50)
    } catch (error) {
        if (generationId === filmstripRenderId) {
            filmstripRenderError.value =
                error instanceof Error ? error.message : "filmstrip render failed"
            clearFilmstripCanvas()
        }
    } finally {
        captureVideo.pause()
        if (generationId === filmstripRenderId) {
            isRenderingFilmstrip.value = false
        }
    }
}

const clampTrimStartMs = (nextValue: number, endValue = props.trimEndMs) => {
    const safeEnd = Math.min(Math.max(0, endValue), sliderMaxMs.value)
    const maxStart = Math.max(0, safeEnd - effectiveMinClipMs.value)
    return Math.min(Math.max(0, nextValue), maxStart)
}

const clampTrimEndMs = (nextValue: number, startValue = props.trimStartMs) => {
    const safeStart = clampTrimStartMs(startValue, sliderMaxMs.value)
    return Math.min(Math.max(nextValue, safeStart + effectiveMinClipMs.value), sliderMaxMs.value)
}

const updateTrimStart = (event: Event) => {
    const nextValue = Number((event.target as HTMLInputElement).value)
    emit("update:trimStartMs", clampTrimStartMs(nextValue))
}

const updateTrimEnd = (event: Event) => {
    const nextValue = Number((event.target as HTMLInputElement).value)
    emit("update:trimEndMs", clampTrimEndMs(nextValue))
}

const emitPreview = () => {
    if (props.disabled || props.durationMs <= 0) return
    emit("preview")
}

watch(
    [timelineRailWidth, timelineRailHeight],
    ([nextWidth, nextHeight], [previousWidth, previousHeight]) => {
        if (!props.previewUrl || props.durationMs <= 0 || nextWidth <= 0 || nextHeight <= 0) return
        if (nextWidth === previousWidth && nextHeight === previousHeight) return
        void renderFilmstripFrames()
    },
)

watch([() => props.previewUrl, () => props.durationMs], async () => {
    resetFilmstripRender()
    if (!props.previewUrl || props.durationMs <= 0) return
    await nextTick()
    requestAnimationFrame(() => {
        syncTimelineRailSize()
        void renderFilmstripFrames()
    })
})

watch(
    [() => props.trimStartMs, () => props.trimEndMs, () => props.durationMs, () => props.minClipMs],
    () => {
        const nextStart = clampTrimStartMs(props.trimStartMs, props.trimEndMs)
        const nextEnd = clampTrimEndMs(props.trimEndMs, nextStart)

        if (nextStart !== props.trimStartMs) {
            emit("update:trimStartMs", nextStart)
        }
        if (nextEnd !== props.trimEndMs) {
            emit("update:trimEndMs", nextEnd)
        }
    },
    { immediate: true },
)

onMounted(() => {
    syncTimelineRailSize()
    clearFilmstripCanvas()
    if (props.previewUrl && props.durationMs > 0) {
        requestAnimationFrame(() => void renderFilmstripFrames())
    }
})

onUnmounted(() => {
    timelineResizeObserver?.disconnect()
    timelineResizeObserver = null
    resetFilmstripRender()
})
</script>

<template>
    <div class="video-trim-filmstrip" :class="{ 'video-trim-filmstrip--compact': compact }">
        <video
            ref="timelineCaptureVideoRef"
            :src="previewUrl"
            muted
            playsinline
            preload="auto"
            tabindex="-1"
            aria-hidden="true"
            class="video-trim-filmstrip__capture-video"
        ></video>

        <div class="video-trim-filmstrip__rail">
            <div class="video-trim-filmstrip__ios-strip">
                <button
                    type="button"
                    class="video-trim-filmstrip__play-pane"
                    :class="{ 'video-trim-filmstrip__play-pane--active': isPreviewing }"
                    :aria-label="previewButtonLabel"
                    :disabled="disabled || durationMs <= 0"
                    @click="emitPreview"
                >
                    <Pause v-if="isPreviewing" class="video-trim-filmstrip__play-icon" />
                    <Play
                        v-else
                        class="video-trim-filmstrip__play-icon video-trim-filmstrip__play-icon--play"
                    />
                </button>

                <div class="video-trim-filmstrip__track-shell">
                    <div
                        class="video-trim-filmstrip__track-gutter video-trim-filmstrip__track-gutter--start"
                        aria-hidden="true"
                    ></div>
                    <div
                        class="video-trim-filmstrip__track-gutter video-trim-filmstrip__track-gutter--end"
                        aria-hidden="true"
                    ></div>

                    <div :ref="bindTimelineFilmstrip" class="video-trim-filmstrip__frames">
                        <canvas
                            ref="filmstripCanvasRef"
                            class="video-trim-filmstrip__canvas"
                            aria-hidden="true"
                        ></canvas>
                        <div
                            v-if="isRenderingFilmstrip"
                            class="video-trim-filmstrip__loading"
                            aria-hidden="true"
                        ></div>
                        <div v-if="filmstripRenderError" class="video-trim-filmstrip__error">
                            <p class="video-trim-filmstrip__error-title">时间轴生成失败</p>
                            <button
                                type="button"
                                class="video-trim-filmstrip__error-retry"
                                :disabled="disabled"
                                @click="renderFilmstripFrames"
                            >
                                重新生成
                            </button>
                        </div>
                        <div
                            class="video-trim-filmstrip__inactive-regions"
                            :style="filmstripOverlayStyle"
                        ></div>
                    </div>

                    <div class="video-trim-filmstrip__interaction-layer">
                        <div
                            class="video-trim-filmstrip__selection-layer"
                            :style="filmstripOverlayStyle"
                        >
                            <div class="video-trim-filmstrip__trim-window"></div>
                            <div
                                class="video-trim-filmstrip__edge-handle video-trim-filmstrip__edge-handle--start"
                                :style="clipStartHandleStyle"
                            ></div>
                            <div
                                class="video-trim-filmstrip__edge-handle video-trim-filmstrip__edge-handle--end"
                                :style="clipEndHandleStyle"
                            ></div>
                        </div>

                        <input
                            aria-label="开始时间"
                            class="video-trim-filmstrip__input video-trim-filmstrip__input--start"
                            :style="clipStartInputStyle"
                            type="range"
                            min="0"
                            :max="sliderMaxMs"
                            step="10"
                            :value="trimStartMs"
                            :disabled="disabled"
                            @input="updateTrimStart"
                        />

                        <input
                            aria-label="结束时间"
                            class="video-trim-filmstrip__input video-trim-filmstrip__input--end"
                            :style="clipEndInputStyle"
                            type="range"
                            min="0"
                            :max="sliderMaxMs"
                            step="10"
                            :value="safeTrimEndMs"
                            :disabled="disabled"
                            @input="updateTrimEnd"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.video-trim-filmstrip {
    --clip-range-gutter: 1.55rem;
    --clip-range-vertical-gutter: 0.56rem;
    --clip-control-bg: color-mix(in srgb, #b6b7bb 84%, var(--surface-color));
    --clip-control-separator: rgba(255, 255, 255, 0.72);
    --clip-handle-color: #fbfbfb;
}

.video-trim-filmstrip__capture-video {
    position: fixed;
    top: 0;
    left: 0;
    width: 960px;
    height: 540px;
    clip-path: inset(100%);
    pointer-events: none;
    z-index: -1;
}

.video-trim-filmstrip__rail {
    position: relative;
    height: 5.75rem;
    overflow: hidden;
    border-radius: 1rem;
    background: var(--clip-control-bg);
    box-shadow:
        inset 0 0 0 1px color-mix(in srgb, var(--surface-border) 42%, transparent),
        0 8px 18px rgba(24, 29, 38, 0.08);
    transition:
        box-shadow 160ms ease,
        outline-color 160ms ease;
}

.video-trim-filmstrip__rail:focus-within {
    outline: 2px solid color-mix(in srgb, var(--primary-color) 72%, transparent);
    outline-offset: 3px;
    box-shadow:
        inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 42%, transparent),
        0 0 0 5px color-mix(in srgb, var(--primary-color) 16%, transparent),
        0 10px 22px rgba(24, 29, 38, 0.1);
}

.video-trim-filmstrip__ios-strip {
    display: grid;
    grid-template-columns: clamp(4.8rem, 18%, 6.5rem) minmax(0, 1fr);
    height: 100%;
}

.video-trim-filmstrip__play-pane {
    display: grid;
    place-items: center;
    border: 0;
    border-inline-end: 2px solid var(--clip-control-separator);
    background: color-mix(in srgb, var(--clip-control-bg) 92%, #8e9095);
    color: #ffffff;
    cursor: pointer;
    transition:
        background-color 140ms ease,
        opacity 140ms ease;
}

.video-trim-filmstrip__play-pane:hover:not(:disabled),
.video-trim-filmstrip__play-pane--active {
    background: color-mix(in srgb, var(--clip-control-bg) 76%, #7d8086);
}

.video-trim-filmstrip__play-pane:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--primary-color) 72%, transparent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.video-trim-filmstrip__error-retry:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--primary-color) 72%, transparent);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.video-trim-filmstrip__play-pane:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.video-trim-filmstrip__play-icon {
    width: 2.55rem;
    height: 2.55rem;
    stroke-width: 2.4;
}

.video-trim-filmstrip__play-icon--play {
    fill: currentColor;
}

.video-trim-filmstrip__track-shell {
    position: relative;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    background: var(--clip-control-bg);
}

.video-trim-filmstrip__track-gutter {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 6;
    display: grid;
    width: var(--clip-range-gutter);
    place-items: center;
    pointer-events: none;
}

.video-trim-filmstrip__track-gutter--start {
    left: 0;
    border-inline-end: 1px solid var(--clip-control-separator);
}

.video-trim-filmstrip__track-gutter--end {
    right: 0;
    border-inline-start: 1px solid var(--clip-control-separator);
}

.video-trim-filmstrip__track-gutter::before {
    content: "";
    width: 0.76rem;
    height: 0.76rem;
    border-block-start: 0.26rem solid #ffffff;
    border-inline-start: 0.26rem solid #ffffff;
    border-radius: 0.12rem;
}

.video-trim-filmstrip__track-gutter--start::before {
    transform: rotate(-45deg);
}

.video-trim-filmstrip__track-gutter--end::before {
    transform: rotate(135deg);
}

.video-trim-filmstrip__frames {
    position: absolute;
    inset: var(--clip-range-vertical-gutter) var(--clip-range-gutter);
    overflow: hidden;
    border-radius: 0.24rem;
    background: #10141d;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.video-trim-filmstrip__canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.video-trim-filmstrip__loading {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.12) 48%, transparent 100%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 62%);
    opacity: 0.3;
    animation: video-trim-filmstrip-scan 1.1s ease-in-out infinite;
}

.video-trim-filmstrip__error {
    position: absolute;
    inset: 0;
    z-index: 7;
    display: grid;
    place-items: center;
    gap: 0.45rem;
    padding: 0.9rem;
    text-align: center;
    background: color-mix(in srgb, var(--bg-solid) 90%, black);
}

.video-trim-filmstrip__error-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
}

.video-trim-filmstrip__error-retry {
    border: 1px solid color-mix(in srgb, var(--accent-color) 26%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--text-primary);
    font-size: 0.75rem;
    line-height: 1;
    padding: 0.5rem 0.9rem;
}

.video-trim-filmstrip__error-retry:disabled {
    cursor: not-allowed;
    opacity: 0.52;
}

.video-trim-filmstrip__inactive-regions {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
        to right,
        rgba(10, 13, 18, 0.18) 0%,
        rgba(10, 13, 18, 0.18) var(--clip-start-percent),
        transparent var(--clip-start-percent),
        transparent var(--clip-end-percent),
        rgba(10, 13, 18, 0.18) var(--clip-end-percent),
        rgba(10, 13, 18, 0.18) 100%
    );
}

.video-trim-filmstrip__interaction-layer {
    position: absolute;
    inset: var(--clip-range-vertical-gutter) var(--clip-range-gutter);
    z-index: 8;
}

.video-trim-filmstrip__selection-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.video-trim-filmstrip__trim-window {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--clip-start-percent);
    right: calc(100% - var(--clip-end-percent));
    border-block: 3px solid var(--clip-handle-color);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.5),
        0 1px 4px rgba(10, 13, 18, 0.16);
}

.video-trim-filmstrip__edge-handle {
    position: absolute;
    top: -0.18rem;
    bottom: -0.18rem;
    width: 0.64rem;
    transform: translateX(-50%);
    border-radius: 999px;
    background: var(--clip-handle-color);
    box-shadow:
        0 1px 6px rgba(10, 13, 18, 0.24),
        inset 0 0 0 1px rgba(10, 13, 18, 0.08);
}

.video-trim-filmstrip__edge-handle::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2px;
    height: 54%;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: rgba(20, 25, 34, 0.25);
}

.video-trim-filmstrip__edge-handle--end {
    transform: translateX(-50%);
}

.video-trim-filmstrip__input {
    position: absolute;
    inset: 0;
    z-index: 9;
    width: 100%;
    height: 100%;
    margin: 0;
    appearance: none;
    background: transparent;
    outline: none;
}

.video-trim-filmstrip__input:disabled {
    cursor: not-allowed;
}

.video-trim-filmstrip__input::-webkit-slider-runnable-track {
    height: 100%;
    background: transparent;
}

.video-trim-filmstrip__input::-webkit-slider-thumb {
    appearance: none;
    width: 1.95rem;
    height: 100%;
    border: none;
    background: transparent;
    cursor: ew-resize;
}

.video-trim-filmstrip__input::-moz-range-track {
    height: 100%;
    background: transparent;
    border: none;
}

.video-trim-filmstrip__input::-moz-range-thumb {
    width: 1.95rem;
    height: 100%;
    border: none;
    border-radius: 0;
    background: transparent;
    cursor: ew-resize;
}

.video-trim-filmstrip__input--start {
    z-index: 10;
}

.video-trim-filmstrip__input--end {
    z-index: 11;
}

@keyframes video-trim-filmstrip-scan {
    0% {
        transform: translateX(-62%);
    }

    100% {
        transform: translateX(62%);
    }
}

@media (max-width: 640px) {
    .video-trim-filmstrip {
        --clip-range-gutter: 1.28rem;
        --clip-range-vertical-gutter: 0.48rem;
    }

    .video-trim-filmstrip__rail {
        height: 4.85rem;
    }

    .video-trim-filmstrip__ios-strip {
        grid-template-columns: 4.35rem minmax(0, 1fr);
    }

    .video-trim-filmstrip__play-icon {
        width: 2.15rem;
        height: 2.15rem;
    }
}
</style>
