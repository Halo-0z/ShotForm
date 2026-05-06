<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { open } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"
import { basename } from "@tauri-apps/api/path"
import { Film, Upload as UploadIcon, Play, Pause, AlertCircle, Trash2 } from "lucide-vue-next"
import { Button } from "@/components/ui/button"
import { navigateWithFogTransition } from "@/composables/useFogRouteTransition"
import { useAnalysisStore } from "@/stores/analysis"
import { hasTauriRuntime } from "@/lib/tauri-runtime"

const router = useRouter()
const analysisStore = useAnalysisStore()

type UploadState = "empty" | "uploading" | "ready" | "analyzing"
const uploadState = ref<UploadState>("empty")

const uploadMode = ref<"image" | "video">("video")
const videoPath = ref("")
const videoName = ref("")
const videoSize = ref("")
const videoResolution = ref("")
const previewUrl = ref("")
const durationMs = ref(0)
const trimStartMs = ref(0)
const trimEndMs = ref(0)
const isPlaying = ref(false)
const currentTimeMs = ref(0)
const videoRef = ref<HTMLVideoElement | null>(null)
const timelineCaptureVideoRef = ref<HTMLVideoElement | null>(null)
const timelineRailEl = ref<HTMLElement | null>(null)
const timelineFrames = ref<string[]>([])
const isGeneratingFrames = ref(false)
const timelineRailWidth = ref(0)
const isDragOver = ref(false)
const handoffError = ref("")
const browserFileInputRef = ref<HTMLInputElement | null>(null)
const minClipMs = 300

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"]
const VIDEO_EXTS = ["mp4", "mov", "avi", "webm", "mkv", "m4v"]

const isBusy = computed(
    () =>
        analysisStore.isLoading ||
        uploadState.value === "analyzing" ||
        uploadState.value === "uploading",
)
const hasVideo = computed(() => Boolean(previewUrl.value))
const sliderMaxMs = computed(() => Math.max(minClipMs, durationMs.value))
const trimStartPercent = computed(() =>
    sliderMaxMs.value <= 0 ? 0 : (trimStartMs.value / sliderMaxMs.value) * 100,
)
const trimEndPercent = computed(() =>
    sliderMaxMs.value <= 0 ? 100 : (trimEndMs.value / sliderMaxMs.value) * 100,
)
const clipSelectionStyle = computed(() => ({
    left: `${trimStartPercent.value}%`,
    width: `${Math.max(0.75, trimEndPercent.value - trimStartPercent.value)}%`,
}))
const clipStartMaskStyle = computed(() => ({ width: `${Math.max(0, trimStartPercent.value)}%` }))
const clipEndMaskStyle = computed(() => ({
    left: `${trimEndPercent.value}%`,
    width: `${Math.max(0, 100 - trimEndPercent.value)}%`,
}))

const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.round(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

const formatPreciseTime = (ms: number) => {
    const safe = Math.max(0, Number(ms) || 0)
    const totalCs = Math.round(safe / 10)
    const minutes = Math.floor(totalCs / 6000)
    const seconds = Math.floor((totalCs % 6000) / 100)
    const cs = totalCs % 100
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const mimeTypeFromPath = (path: string) => {
    const lower = path.toLowerCase()
    if (lower.endsWith(".mov")) return "video/quicktime"
    if (lower.endsWith(".webm")) return "video/webm"
    if (lower.endsWith(".avi")) return "video/x-msvideo"
    return "video/mp4"
}

const revokePreviewUrl = () => {
    if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value)
        previewUrl.value = ""
    }
}

const resetAll = () => {
    revokePreviewUrl()
    videoPath.value = ""
    videoName.value = ""
    videoSize.value = ""
    videoResolution.value = ""
    durationMs.value = 0
    trimStartMs.value = 0
    trimEndMs.value = 0
    currentTimeMs.value = 0
    isPlaying.value = false
    timelineFrames.value = []
    handoffError.value = ""
    uploadState.value = "empty"
}

const getFileExtension = (name: string) => name.split(".").pop()?.toLowerCase() ?? ""

const readAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("读取文件失败"))
        reader.readAsDataURL(file)
    })

const applyVideoFile = async (file: File, path = "") => {
    revokePreviewUrl()
    previewUrl.value = URL.createObjectURL(file)
    videoPath.value = path
    videoName.value = file.name
    videoSize.value = formatFileSize(file.size)
    durationMs.value = 0
    trimStartMs.value = 0
    trimEndMs.value = 0
    uploadState.value = "uploading"
}

const applyImageFile = async (file: File) => {
    uploadState.value = "uploading"
    try {
        const dataUrl = await readAsDataURL(file)
        videoName.value = file.name
        videoSize.value = formatFileSize(file.size)
        previewUrl.value = dataUrl
        videoPath.value = ""
        durationMs.value = 0
        uploadState.value = "ready"
    } catch (e) {
        handoffError.value = e instanceof Error ? e.message : String(e)
        uploadState.value = "empty"
    }
}

const handleBrowserFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    if (uploadMode.value === "video") {
        applyVideoFile(file)
    } else {
        applyImageFile(file)
    }
    target.value = ""
}

const pickVideo = async () => {
    if (!hasTauriRuntime()) {
        browserFileInputRef.value?.click()
        return
    }
    try {
        const selected = await open({
            title: "选择投篮视频",
            multiple: false,
            directory: false,
            filters: [{ name: "Video", extensions: VIDEO_EXTS }],
        })
        if (!selected || Array.isArray(selected)) return
        const bytes = await readFile(selected)
        const blob = new Blob([bytes], { type: mimeTypeFromPath(selected) })
        const filename = await basename(selected)
        await applyVideoFile(
            new File([blob], filename, { type: mimeTypeFromPath(selected) }),
            selected,
        )
    } catch (error) {
        handoffError.value = error instanceof Error ? error.message : String(error)
    }
}

const pickImage = async () => {
    if (!hasTauriRuntime()) {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = IMAGE_EXTS.map((e) => `.${e}`).join(",")
        input.onchange = () => {
            const file = input.files?.[0]
            if (file) applyImageFile(file)
        }
        input.click()
        return
    }
    try {
        const selected = await open({
            title: "选择投篮图片",
            multiple: false,
            directory: false,
            filters: [{ name: "Image", extensions: IMAGE_EXTS }],
        })
        if (!selected || Array.isArray(selected)) return
        const bytes = await readFile(selected)
        const mime = "image/jpeg"
        const blob = new Blob([bytes], { type: mime })
        const filename = await basename(selected)
        await applyImageFile(new File([blob], filename, { type: mime }))
    } catch (error) {
        handoffError.value = error instanceof Error ? error.message : String(error)
    }
}

const handleDrop = async (event: DragEvent) => {
    isDragOver.value = false
    const files = event.dataTransfer?.files
    if (!files?.length) return
    const first = files[0]
    const ext = getFileExtension(first.name)
    if (IMAGE_EXTS.includes(ext)) {
        uploadMode.value = "image"
        await applyImageFile(first)
    } else if (VIDEO_EXTS.includes(ext)) {
        uploadMode.value = "video"
        await applyVideoFile(first)
    } else {
        handoffError.value = `不支持的文件类型：.${ext}`
    }
}

const onVideoLoadedMetadata = () => {
    const duration = Math.max(0, Math.round((videoRef.value?.duration || 0) * 1000))
    durationMs.value = duration
    trimStartMs.value = 0
    trimEndMs.value = duration
    videoResolution.value = `${videoRef.value?.videoWidth || 0}x${videoRef.value?.videoHeight || 0}`
    uploadState.value = "ready"
    void generateTimelineFrames()
}

const onVideoTimeUpdate = () => {
    if (!videoRef.value) return
    currentTimeMs.value = Math.round(videoRef.value.currentTime * 1000)
}

const onVideoPlay = () => {
    isPlaying.value = true
}
const onVideoPause = () => {
    isPlaying.value = false
}

const togglePlay = () => {
    if (!videoRef.value) return
    if (videoRef.value.paused) {
        videoRef.value.play()
    } else {
        videoRef.value.pause()
    }
}

const updateTrimStart = (event: Event) => {
    const next = Number((event.target as HTMLInputElement).value)
    trimStartMs.value = Math.min(next, Math.max(0, trimEndMs.value - minClipMs))
}

const updateTrimEnd = (event: Event) => {
    const next = Number((event.target as HTMLInputElement).value)
    trimEndMs.value = Math.max(next, trimStartMs.value + minClipMs)
}

const handleImageLoaded = async (imageData: string) => {
    handoffError.value = ""
    try {
        if (!hasTauriRuntime()) {
            handoffError.value = "当前为浏览器预览模式，分析需在桌面端完成。"
            window.alert(handoffError.value)
            return
        }
        await analysisStore.analyzeImage(imageData)
        await navigateWithFogTransition(router, "/analysis")
    } catch (error) {
        handoffError.value = error instanceof Error ? error.message : String(error)
        window.alert(`图片分析失败：${handoffError.value}`)
    }
}

const handleVideoLoaded = async (payload: {
    filePath: string
    previewUrl: string
    trimStartMs: number
    trimEndMs: number
    durationMs: number
}) => {
    handoffError.value = ""
    try {
        if (!hasTauriRuntime()) {
            handoffError.value = "当前为浏览器预览模式，分析需在桌面端完成。"
            window.alert(handoffError.value)
            return
        }
        await analysisStore.analyzeVideo(payload.filePath, payload.trimStartMs, payload.trimEndMs)
        await navigateWithFogTransition(router, "/analysis")
    } catch (error) {
        handoffError.value = error instanceof Error ? error.message : String(error)
        window.alert(`视频分析失败：${handoffError.value}`)
    }
}

const handleStartAnalysis = async () => {
    if (!hasVideo.value || isBusy.value) return
    if (uploadMode.value === "image") {
        await handleImageLoaded(previewUrl.value)
    } else {
        await handleVideoLoaded({
            filePath: videoPath.value,
            previewUrl: previewUrl.value,
            trimStartMs: trimStartMs.value,
            trimEndMs: trimEndMs.value,
            durationMs: durationMs.value,
        })
    }
}

const waitForVideoEvent = (video: HTMLVideoElement, eventName: "loadeddata" | "seeked") =>
    new Promise<void>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            cleanup()
            reject(new Error(`video ${eventName} timed out`))
        }, 5000)
        const cleanup = () => {
            window.clearTimeout(timeoutId)
            video.removeEventListener(eventName, handleResolve)
            video.removeEventListener("error", handleError)
        }
        const handleResolve = () => {
            cleanup()
            resolve()
        }
        const handleError = () => {
            cleanup()
            reject(new Error(`video ${eventName} failed`))
        }
        video.addEventListener(eventName, handleResolve, { once: true })
        video.addEventListener("error", handleError, { once: true })
    })

const waitForRenderedVideoFrame = (video: HTMLVideoElement) =>
    new Promise<void>((resolve) => {
        if (typeof video.requestVideoFrameCallback === "function") {
            video.requestVideoFrameCallback(() => resolve())
            return
        }
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => resolve())
                return
            })
        }
        window.setTimeout(resolve, 34)
    })

const seekOffscreenVideo = async (video: HTMLVideoElement, timeInSeconds: number) => {
    if (Math.abs(video.currentTime - timeInSeconds) < 0.01) {
        await waitForRenderedVideoFrame(video)
        return
    }
    const seeked = waitForVideoEvent(video, "seeked")
    video.currentTime = timeInSeconds
    await seeked
    await waitForRenderedVideoFrame(video)
}

const syncTimelineRailWidth = () => {
    timelineRailWidth.value = Math.round(timelineRailEl.value?.clientWidth || 0)
}

const generateTimelineFrames = async () => {
    if (
        !previewUrl.value ||
        durationMs.value <= 0 ||
        timelineRailWidth.value <= 0 ||
        typeof document === "undefined"
    ) {
        timelineFrames.value = []
        return
    }
    isGeneratingFrames.value = true
    const captureVideo = timelineCaptureVideoRef.value
    if (!captureVideo) {
        timelineFrames.value = []
        isGeneratingFrames.value = false
        return
    }
    try {
        if (!captureVideo.src) captureVideo.src = previewUrl.value
        if (captureVideo.readyState < 2) {
            const loaded = waitForVideoEvent(captureVideo, "loadeddata")
            captureVideo.load()
            await loaded
        }
        await waitForRenderedVideoFrame(captureVideo)
        const captureCount = Math.min(48, Math.max(18, Math.ceil(timelineRailWidth.value / 36) + 4))
        const durationSeconds = durationMs.value / 1000
        const safeDuration = Math.max(durationSeconds, 0.1)
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            timelineFrames.value = []
            return
        }
        const renderScale = Math.max(
            2,
            typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        )
        canvas.width = Math.max(48, Math.round(36 * renderScale))
        canvas.height = Math.max(68, Math.round(68 * renderScale))
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        const vW = captureVideo.videoWidth || 16
        const vH = captureVideo.videoHeight || 9
        const ratio = canvas.width / canvas.height
        const vRatio = vW / vH
        let sW = vW
        let sH = vH
        let sX = 0
        let sY = 0
        if (vRatio > ratio) {
            sW = vH * ratio
            sX = (vW - sW) / 2
        } else {
            sH = vW / ratio
            sY = (vH - sH) / 2
        }
        const frames: string[] = []
        for (let i = 0; i < captureCount; i += 1) {
            const progress = captureCount === 1 ? 0.5 : i / (captureCount - 1)
            const targetTime = Math.min(
                Math.max(progress * safeDuration, 0),
                Math.max(0, safeDuration - 0.05),
            )
            await seekOffscreenVideo(captureVideo, targetTime)
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = "rgba(15, 23, 42, 1)"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(captureVideo, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height)
            frames.push(canvas.toDataURL("image/png"))
        }
        timelineFrames.value = frames
    } catch {
        timelineFrames.value = []
    } finally {
        captureVideo.pause()
        isGeneratingFrames.value = false
    }
}

watch(timelineRailWidth, (nextWidth, prevWidth) => {
    if (!previewUrl.value || durationMs.value <= 0 || nextWidth <= 0 || nextWidth === prevWidth)
        return
    void generateTimelineFrames()
})

watch([trimStartMs, trimEndMs], () => {
    if (!videoRef.value || durationMs.value <= 0) return
    const clipStart = trimStartMs.value / 1000
    const clipEnd = trimEndMs.value / 1000
    if (videoRef.value.currentTime < clipStart || videoRef.value.currentTime > clipEnd) {
        videoRef.value.currentTime = clipStart
    }
})

onMounted(() => {
    syncTimelineRailWidth()
})

onUnmounted(() => {
    revokePreviewUrl()
})
</script>

<template>
    <div class="upload-workbench">
        <input
            ref="browserFileInputRef"
            type="file"
            :accept="
                uploadMode === 'video'
                    ? 'video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm,.m4v'
                    : 'image/*,.png,.jpg,.jpeg,.webp,.bmp,.gif'
            "
            class="hidden"
            @change="handleBrowserFileChange"
        />

        <section
            class="upload-workbench__body"
            :class="{ 'upload-workbench__body--drag-over': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop.prevent="handleDrop"
        >
            <div v-if="!hasVideo" class="upload-workbench__dropzone">
                <div class="upload-workbench__dropzone-icon">
                    <Film class="h-10 w-10" />
                </div>
                <p class="upload-workbench__dropzone-title">
                    拖拽视频到此处，或<em @click.stop="pickVideo">点击上传</em>
                </p>
                <p class="upload-workbench__dropzone-hint">
                    建议 2 到 6 秒，包含单球制出手的完整片段
                </p>
                <Button
                    class="upload-workbench__dropzone-btn"
                    @click="uploadMode === 'video' ? pickVideo() : pickImage()"
                >
                    <UploadIcon class="h-4 w-4" />
                    {{ uploadMode === "video" ? "选择视频" : "选择图片" }}
                </Button>
                <p class="upload-workbench__dropzone-exts">支持 MP4 / MOV / AVI / WEBM</p>
                <p class="upload-workbench__dropzone-size">文件大小不超过 200MB</p>
            </div>

            <template v-else>
                <div class="upload-workbench__preview-area">
                    <div class="upload-workbench__video-thumb" @click="togglePlay">
                        <video
                            v-if="uploadMode === 'video'"
                            ref="videoRef"
                            :src="previewUrl"
                            playsinline
                            @loadedmetadata="onVideoLoadedMetadata"
                            @timeupdate="onVideoTimeUpdate"
                            @play="onVideoPlay"
                            @pause="onVideoPause"
                        />
                        <img v-else :src="previewUrl" alt="预览图" />
                        <div class="upload-workbench__video-thumb-overlay">
                            <button class="upload-workbench__video-thumb-play" type="button">
                                <Play v-if="!isPlaying" class="h-6 w-6" />
                                <Pause v-else class="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                    <video
                        v-if="uploadMode === 'video'"
                        ref="timelineCaptureVideoRef"
                        :src="previewUrl"
                        muted
                        playsinline
                        preload="auto"
                        tabindex="-1"
                        aria-hidden="true"
                        class="upload-workbench__timeline-capture"
                    />

                    <div class="upload-workbench__info-panel">
                        <div class="upload-workbench__info-header">
                            <div class="upload-workbench__info-filename">
                                <span class="upload-workbench__info-filename-text">{{
                                    videoName
                                }}</span>
                            </div>
                        </div>
                        <div class="upload-workbench__info-meta">
                            <span>时长 {{ formatTime(durationMs) }}</span>
                            <span>大小 {{ videoSize }}</span>
                            <span>分辨率 {{ videoResolution }}</span>
                        </div>
                        <div class="upload-workbench__trim-section">
                            <p class="upload-workbench__trim-label">
                                选择需要分析的片段（建议 2 到 6 秒）
                            </p>
                            <div ref="timelineRailEl" class="upload-workbench__trim-rail">
                                <div class="upload-workbench__trim-filmstrip">
                                    <template v-if="timelineFrames.length">
                                        <div
                                            v-for="(frame, idx) in timelineFrames"
                                            :key="`tf-${idx}`"
                                            class="upload-workbench__trim-frame"
                                        >
                                            <img :src="frame" alt="" />
                                        </div>
                                    </template>
                                    <template v-else-if="isGeneratingFrames">
                                        <div
                                            v-for="p in 9"
                                            :key="`pl-${p}`"
                                            class="upload-workbench__trim-frame upload-workbench__trim-frame--placeholder"
                                        ></div>
                                    </template>
                                    <template v-else>
                                        <div
                                            v-for="p in 9"
                                            :key="`pi-${p}`"
                                            class="upload-workbench__trim-frame upload-workbench__trim-frame--placeholder"
                                        ></div>
                                    </template>
                                </div>
                                <div
                                    class="upload-workbench__trim-mask-start"
                                    :style="clipStartMaskStyle"
                                ></div>
                                <div
                                    class="upload-workbench__trim-mask-end"
                                    :style="clipEndMaskStyle"
                                ></div>
                                <div
                                    class="upload-workbench__trim-window"
                                    :style="clipSelectionStyle"
                                ></div>
                                <input
                                    class="upload-workbench__trim-input-start"
                                    type="range"
                                    min="0"
                                    :max="sliderMaxMs"
                                    step="10"
                                    :value="trimStartMs"
                                    @input="updateTrimStart"
                                />
                                <input
                                    class="upload-workbench__trim-input-end"
                                    type="range"
                                    min="0"
                                    :max="sliderMaxMs"
                                    step="10"
                                    :value="trimEndMs"
                                    @input="updateTrimEnd"
                                />
                            </div>
                            <div class="upload-workbench__trim-times">
                                <span>{{ formatPreciseTime(trimStartMs) }}</span>
                                <span>—</span>
                                <span>{{ formatPreciseTime(trimEndMs) }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="upload-workbench__footer">
                    <div class="upload-workbench__tip">
                        <AlertCircle class="h-4 w-4" />
                        <span>建议从举球开始，到球离手为止，可获得更准确的分析结果。</span>
                    </div>
                    <div class="upload-workbench__actions">
                        <Button variant="outline" :disabled="isBusy" @click="resetAll">
                            <Trash2 class="h-4 w-4" />
                            清空
                        </Button>
                        <Button
                            :loading="isBusy"
                            class="upload-workbench__cta"
                            @click="handleStartAnalysis"
                        >
                            <Play v-if="!isBusy" class="h-4 w-4" />
                            开始分析
                        </Button>
                    </div>
                </div>
            </template>
        </section>

        <p v-if="handoffError" class="upload-workbench__error">{{ handoffError }}</p>
    </div>
</template>

<style scoped>
.upload-workbench {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.upload-workbench__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: 20px;
    border: 1px solid var(--surface-border);
    background: var(--bg-solid);
    overflow: hidden;
    transition: border-color 200ms ease;
}

.upload-workbench__body--drag-over {
    border-color: var(--accent-color);
    border-style: dashed;
}

.upload-workbench__dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 40px;
    gap: 16px;
    min-height: 400px;
}

.upload-workbench__dropzone-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-color);
}

.upload-workbench__dropzone-title {
    font-size: 16px;
    color: var(--text-primary);
    text-align: center;
}

.upload-workbench__dropzone-title em {
    color: var(--accent-color);
    cursor: pointer;
    font-style: normal;
    font-weight: 600;
}

.upload-workbench__dropzone-title em:hover {
    text-decoration: underline;
}

.upload-workbench__dropzone-hint {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
}

.upload-workbench__dropzone-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 28px;
    border-radius: 10px;
    background: linear-gradient(135deg, #f5822e, #e06d1f);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 180ms ease;
    box-shadow: 0 4px 12px color-mix(in srgb, #f5822e 24%, transparent);
}

.upload-workbench__dropzone-btn:hover {
    background: linear-gradient(135deg, #e06d1f, #c95a14);
    box-shadow: 0 6px 16px color-mix(in srgb, #f5822e 30%, transparent);
    transform: translateY(-1px);
}

.upload-workbench__dropzone-exts,
.upload-workbench__dropzone-size {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
}

.upload-workbench__preview-area {
    display: grid;
    grid-template-columns: minmax(280px, 420px) 1fr;
    gap: 0;
    min-height: 360px;
}

.upload-workbench__video-thumb {
    position: relative;
    background: #000;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    aspect-ratio: 16 / 10;
    margin: 16px;
}

.upload-workbench__video-thumb video,
.upload-workbench__video-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}

.upload-workbench__video-thumb-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.2);
    opacity: 0;
    transition: opacity 180ms ease;
}

.upload-workbench__video-thumb:hover .upload-workbench__video-thumb-overlay {
    opacity: 1;
}

.upload-workbench__video-thumb-play {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    border: none;
    cursor: pointer;
    transition: transform 160ms ease;
}

.upload-workbench__video-thumb-play:hover {
    transform: scale(1.08);
}

.upload-workbench__timeline-capture {
    position: fixed;
    left: -9999px;
    top: 0;
    width: 240px;
    height: auto;
    opacity: 0;
    pointer-events: none;
}

.upload-workbench__info-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 24px;
}

.upload-workbench__info-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.upload-workbench__info-filename {
    display: flex;
    align-items: center;
    gap: 6px;
}

.upload-workbench__info-filename-text {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
}

.upload-workbench__info-meta {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: var(--text-muted);
}

.upload-workbench__trim-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.upload-workbench__trim-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
}

.upload-workbench__trim-rail {
    position: relative;
    height: 56px;
    border-radius: 12px;
    overflow: hidden;
    background: color-mix(in srgb, var(--bg-solid) 88%, black);
    box-shadow: inset 0 0 0 1px var(--surface-border);
}

.upload-workbench__trim-filmstrip {
    position: absolute;
    inset: 0;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 36px;
    justify-content: start;
    height: 100%;
    overflow: hidden;
}

.upload-workbench__trim-frame {
    position: relative;
    overflow: hidden;
    border-right: 1px solid color-mix(in srgb, var(--surface-border) 62%, transparent);
}

.upload-workbench__trim-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.upload-workbench__trim-frame--placeholder::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent-color) 16%, transparent),
        transparent 40%,
        rgba(24, 29, 38, 0.18)
    );
}

.upload-workbench__trim-mask-start,
.upload-workbench__trim-mask-end {
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
    background: rgba(19, 23, 29, 0.58);
}

.upload-workbench__trim-window {
    position: absolute;
    top: 0;
    bottom: 0;
    pointer-events: none;
    border-top: 1px solid color-mix(in srgb, var(--accent-color) 38%, white);
    border-bottom: 1px solid color-mix(in srgb, var(--accent-color) 24%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 14%, transparent);
}

.upload-workbench__trim-input-start,
.upload-workbench__trim-input-end {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    appearance: none;
    background: transparent;
    outline: none;
}

.upload-workbench__trim-input-start::-webkit-slider-runnable-track {
    height: 56px;
    background: transparent;
}
.upload-workbench__trim-input-start::-webkit-slider-thumb {
    appearance: none;
    width: 1.85rem;
    height: 56px;
    border: none;
    background: transparent;
    cursor: ew-resize;
}
.upload-workbench__trim-input-end::-webkit-slider-runnable-track {
    height: 56px;
    background: transparent;
}
.upload-workbench__trim-input-end::-webkit-slider-thumb {
    appearance: none;
    width: 1.85rem;
    height: 56px;
    border: none;
    background: transparent;
    cursor: ew-resize;
}
.upload-workbench__trim-input-start::-moz-range-track {
    height: 56px;
    background: transparent;
    border: none;
}
.upload-workbench__trim-input-start::-moz-range-thumb {
    width: 1.85rem;
    height: 56px;
    border: none;
    border-radius: 0;
    background: transparent;
    cursor: ew-resize;
}
.upload-workbench__trim-input-end::-moz-range-track {
    height: 56px;
    background: transparent;
    border: none;
}
.upload-workbench__trim-input-end::-moz-range-thumb {
    width: 1.85rem;
    height: 56px;
    border: none;
    border-radius: 0;
    background: transparent;
    cursor: ew-resize;
}

.upload-workbench__trim-times {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
}

.upload-workbench__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-top: 1px solid var(--surface-border);
    gap: 16px;
}

.upload-workbench__tip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    flex: 1;
}

.upload-workbench__tip svg {
    color: var(--color-warning);
    flex-shrink: 0;
    margin-top: 1px;
}

.upload-workbench__actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
}

.upload-workbench__cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 11px 28px;
    border-radius: 10px;
    background: linear-gradient(135deg, #f5822e, #e06d1f);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 180ms ease;
    box-shadow: 0 4px 12px color-mix(in srgb, #f5822e 24%, transparent);
}

.upload-workbench__cta:hover:not(:disabled) {
    background: linear-gradient(135deg, #e06d1f, #c95a14);
    box-shadow: 0 6px 16px color-mix(in srgb, #f5822e 30%, transparent);
    transform: translateY(-1px);
}

.upload-workbench__cta:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.upload-workbench__error {
    color: var(--color-danger);
    font-size: 13px;
    text-align: center;
}

@media (max-width: 900px) {
    .upload-workbench {
        padding: 20px 16px;
    }

    .upload-workbench__preview-area {
        grid-template-columns: 1fr;
    }

    .upload-workbench__video-thumb {
        margin: 12px;
        aspect-ratio: 16 / 9;
    }

    .upload-workbench__footer {
        flex-direction: column;
        align-items: stretch;
    }

    .upload-workbench__actions {
        justify-content: flex-end;
    }
}
</style>
