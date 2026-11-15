<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { open } from "@tauri-apps/plugin-dialog"
import { readFile } from "@tauri-apps/plugin-fs"
import { basename } from "@tauri-apps/api/path"
import { Film, Upload as UploadIcon, Play, Pause, AlertCircle, Trash2 } from "lucide-vue-next"
import { Button } from "@/components/ui/button"
import { navigateWithFogTransition } from "@/composables/useFogRouteTransition"
import { useAnalysisStore } from "@/stores/analysis"
import { formatTime } from "@/lib/analysis-utils"
import { hasTauriRuntime } from "@/lib/tauri-runtime"
import VideoTrimFilmstrip from "@/components/VideoUpload/VideoTrimFilmstrip.vue"

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
    handoffError.value = ""
    uploadState.value = "empty"
}

const selectUploadMode = (mode: "image" | "video") => {
    if (isBusy.value || uploadMode.value === mode) return
    resetAll()
    uploadMode.value = mode
}

const getFileExtension = (name: string) => name.split(".").pop()?.toLowerCase() ?? ""

const readAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("读取文件失败"))
        reader.readAsDataURL(file)
    })

const validateFile = (file: File, kind: "image" | "video") => {
    const extensions = kind === "image" ? IMAGE_EXTS : VIDEO_EXTS
    if (!extensions.includes(getFileExtension(file.name))) {
        handoffError.value = "不支持此文件格式"
        return false
    }
    if (file.size > 200 * 1024 * 1024) {
        handoffError.value = "文件不能超过 200MB"
        return false
    }
    if (!file.size) {
        handoffError.value = "文件为空，请重新选择"
        return false
    }
    handoffError.value = ""
    return true
}
const applyVideoFile = async (file: File, path = "") => {
    if (!validateFile(file, "video")) return
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
    if (!validateFile(file, "image")) return
    revokePreviewUrl()
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
    if (!file || isBusy.value) return
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
        browserFileInputRef.value?.click()
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
        const ext = getFileExtension(selected)
        const mime = `image/${ext === "jpg" ? "jpeg" : ext}`
        const blob = new Blob([bytes], { type: mime })
        const filename = await basename(selected)
        await applyImageFile(new File([blob], filename, { type: mime }))
    } catch (error) {
        handoffError.value = error instanceof Error ? error.message : String(error)
    }
}

const handleDrop = async (event: DragEvent) => {
    isDragOver.value = false
    if (isBusy.value) return
    const files = event.dataTransfer?.files
    if (!files?.length) return
    const first = files[0]
    const ext = getFileExtension(first.name)
    if (IMAGE_EXTS.includes(ext)) {
        uploadMode.value = "image"
        await applyImageFile(first)
    } else if (VIDEO_EXTS.includes(ext)) {
        uploadMode.value = "video"
        if (hasTauriRuntime()) {
            handoffError.value = "请点击选择视频，以获得桌面端可读取的文件路径。"
            return
        }
        await applyVideoFile(first)
    } else {
        handoffError.value = `不支持的文件类型：.${ext}`
    }
}

const onVideoError = () => {
    handoffError.value = "无法播放此视频，请重新选择可播放的文件。"
    uploadState.value = "ready"
}
const onVideoLoadedMetadata = () => {
    const duration = Math.max(0, Math.round((videoRef.value?.duration || 0) * 1000))
    durationMs.value = duration
    trimStartMs.value = 0
    trimEndMs.value = duration
    videoResolution.value = `${videoRef.value?.videoWidth || 0}x${videoRef.value?.videoHeight || 0}`
    uploadState.value = "ready"
}

const onVideoTimeUpdate = () => {
    if (!videoRef.value) return
    currentTimeMs.value = Math.round(videoRef.value.currentTime * 1000)

    const clipEndSec = trimEndMs.value / 1000
    if (videoRef.value.currentTime >= clipEndSec && isPlaying.value) {
        videoRef.value.currentTime = trimStartMs.value / 1000
    }
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
        const clipStartSec = trimStartMs.value / 1000
        const clipEndSec = trimEndMs.value / 1000
        if (videoRef.value.currentTime < clipStartSec || videoRef.value.currentTime > clipEndSec) {
            videoRef.value.currentTime = clipStartSec
        }
        void videoRef.value.play()
    } else {
        videoRef.value.pause()
    }
}

const handleImageLoaded = async (imageData: string) => {
    handoffError.value = ""
    try {
        if (!hasTauriRuntime()) {
            handoffError.value = "当前为浏览器预览模式，分析需在桌面端完成。"

            return
        }
        await analysisStore.analyzeImage(imageData)
        await navigateWithFogTransition(router, "/analysis")
    } catch (error) {
        handoffError.value = error instanceof Error ? error.message : String(error)
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

            return
        }
        if (!payload.filePath) {
            handoffError.value = "请通过选择视频按钮重新选择文件"
            return
        }
        await analysisStore.analyzeVideo(payload.filePath, payload.trimStartMs, payload.trimEndMs)
        await navigateWithFogTransition(router, "/analysis")
    } catch (error) {
        handoffError.value = error instanceof Error ? error.message : String(error)
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

watch([trimStartMs, trimEndMs], () => {
    if (!videoRef.value || durationMs.value <= 0) return
    const clipStart = trimStartMs.value / 1000
    const clipEnd = trimEndMs.value / 1000
    if (videoRef.value.currentTime < clipStart || videoRef.value.currentTime > clipEnd) {
        videoRef.value.currentTime = clipStart
    }
})

onUnmounted(() => {
    revokePreviewUrl()
})
</script>

<template>
    <div class="upload-workbench">
        <div class="flex gap-3" role="group" aria-label="素材类型">
            <Button
                :variant="uploadMode === 'image' ? 'default' : 'outline'"
                :disabled="isBusy"
                :aria-pressed="uploadMode === 'image'"
                @click="selectUploadMode('image')"
                >图片分析</Button
            >
            <Button
                :variant="uploadMode === 'video' ? 'default' : 'outline'"
                :disabled="isBusy"
                :aria-pressed="uploadMode === 'video'"
                @click="selectUploadMode('video')"
                >视频分析</Button
            >
        </div>
        <p v-if="!hasTauriRuntime()" data-browser-preview-note>
            浏览器仅供预览与片段裁剪，姿态分析请使用桌面端。
        </p>
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
                    {{ uploadMode === "video" ? "选择一次完整的投篮动作" : "拖拽投篮图片到此处" }}
                </p>
                <p class="upload-workbench__dropzone-hint">
                    {{
                        uploadMode === "video"
                            ? "建议 2 到 6 秒，包含一次投篮的完整动作"
                            : "建议单人、全身可见、拍摄角度固定"
                    }}
                </p>
                <Button
                    class="upload-workbench__dropzone-btn"
                    :disabled="isBusy"
                    @click="uploadMode === 'video' ? pickVideo() : pickImage()"
                >
                    <UploadIcon class="h-4 w-4" />
                    {{ uploadMode === "video" ? "选择视频" : "选择图片" }}
                </Button>
                <p class="upload-workbench__dropzone-exts">
                    {{
                        uploadMode === "video"
                            ? "支持 MP4 / MOV / AVI / WEBM"
                            : "支持 JPG / PNG / WEBP / BMP / GIF"
                    }}
                </p>
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
                            @error="onVideoError"
                            @timeupdate="onVideoTimeUpdate"
                            @play="onVideoPlay"
                            @pause="onVideoPause"
                        />
                        <img
                            v-else
                            :src="previewUrl"
                            alt="预览图"
                            @error="handoffError = '图片无法解码，请重新选择。'"
                        />
                        <div
                            v-if="uploadMode === 'video'"
                            class="upload-workbench__video-thumb-overlay"
                        >
                            <button
                                class="upload-workbench__video-thumb-play"
                                type="button"
                                :aria-label="isPlaying ? '暂停预览' : '播放预览'"
                            >
                                <Play v-if="!isPlaying" class="h-6 w-6" />
                                <Pause v-else class="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                    <div class="upload-workbench__info-panel">
                        <div class="upload-workbench__info-header">
                            <div class="upload-workbench__info-filename">
                                <span class="upload-workbench__info-filename-text">{{
                                    videoName
                                }}</span>
                            </div>
                        </div>
                        <div class="upload-workbench__info-meta">
                            <span v-if="uploadMode === 'video'"
                                >时长 {{ formatTime(durationMs) }}</span
                            >
                            <span>大小 {{ videoSize }}</span>
                            <span v-if="videoResolution">分辨率 {{ videoResolution }}</span>
                        </div>
                        <div v-if="uploadMode === 'video'" class="upload-workbench__trim-section">
                            <p class="upload-workbench__trim-label">
                                选择需要分析的片段（建议 2 到 6 秒）
                            </p>
                            <VideoTrimFilmstrip
                                v-if="uploadMode === 'video'"
                                v-model:trim-start-ms="trimStartMs"
                                v-model:trim-end-ms="trimEndMs"
                                :preview-url="previewUrl"
                                :duration-ms="durationMs"
                                :min-clip-ms="minClipMs"
                                :disabled="isBusy"
                                :is-previewing="isPlaying"
                                :current-time-ms="currentTimeMs"
                                @preview="togglePlay"
                            />
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
                            :disabled="isBusy || !hasTauriRuntime()"
                            :data-analysis-cta="uploadMode"
                            class="upload-workbench__cta"
                            @click="handleStartAnalysis"
                        >
                            <Play v-if="!isBusy" class="h-4 w-4" />
                            {{ hasTauriRuntime() ? "开始分析" : "请在桌面端分析" }}
                        </Button>
                    </div>
                </div>
            </template>
        </section>

        <section
            v-if="analysisStore.isLoading"
            class="upload-progress"
            aria-label="分析进度"
            role="status"
        >
            <p>{{ analysisStore.progress?.message || "正在分析素材…" }}</p>
            <progress
                :value="analysisStore.progress?.progress || 0"
                max="100"
                aria-label="分析进度"
            />
        </section>
        <p
            v-if="handoffError"
            class="upload-workbench__error ui-notice ui-notice--error"
            role="alert"
        >
            {{ handoffError }}
        </p>
    </div>
</template>

<style scoped>
.upload-workbench {
    display: flex;
    flex-direction: column;
    gap: 20px;
}
[data-browser-preview-note] {
    color: var(--text-muted);
    font-size: 13px;
}
.upload-workbench__body {
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--card-bg);
    overflow: hidden;
    transition: border-color 140ms;
}
.upload-workbench__body--drag-over {
    border-color: var(--primary-color);
    outline: 2px solid var(--primary-color);
    outline-offset: 3px;
}
.upload-workbench__dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 450px;
    padding: 40px 24px;
}
.upload-workbench__dropzone-icon {
    color: var(--text-secondary);
    margin-bottom: 12px;
}
.upload-workbench__dropzone-title {
    font-size: 22px;
    font-weight: 600;
    text-align: center;
}
.upload-workbench__dropzone-hint {
    color: var(--text-secondary);
    font-size: 15px;
    text-align: center;
}
.upload-workbench__dropzone-btn {
    margin: 8px 0;
}
.upload-workbench__dropzone-exts,
.upload-workbench__dropzone-size {
    color: var(--text-muted);
    font-size: 13px;
    text-align: center;
}
.upload-workbench__dropzone-size {
    margin-top: -12px;
}
.upload-workbench__preview-area {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
}
.upload-workbench__video-thumb {
    position: relative;
    background: var(--stage-bg);
    height: clamp(300px, 52vh, 560px);
    overflow: hidden;
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
    display: grid;
    place-items: center;
    pointer-events: none;
}
.upload-workbench__video-thumb-play {
    pointer-events: auto;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    background: #faf7f2;
    color: #1c2128;
    border-radius: 50%;
    opacity: 0.9;
}
.upload-workbench__info-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
    padding: 24px;
}
.upload-workbench__info-filename-text {
    font-size: 18px;
    font-weight: 600;
    overflow-wrap: anywhere;
}
.upload-workbench__info-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    font-size: 13px;
    color: var(--text-muted);
}
.upload-workbench__trim-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
}
.upload-workbench__trim-label {
    font-size: 14px;
    font-weight: 600;
}
.upload-workbench__footer {
    border-top: 1px solid var(--surface-border);
    padding: 18px 24px;
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
}
.upload-workbench__tip {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    color: var(--text-secondary);
    font-size: 13px;
    flex: 1;
    min-width: 200px;
}
.upload-workbench__tip svg {
    flex-shrink: 0;
    margin-top: 3px;
}
.upload-workbench__actions {
    display: flex;
    gap: 12px;
}
@media (max-width: 950px) {
    .upload-workbench__preview-area {
        grid-template-columns: 1fr;
    }
    .upload-workbench__video-thumb {
        height: 340px;
    }
}
@media (max-width: 600px) {
    .upload-workbench__info-panel {
        padding: 16px;
    }
    .upload-workbench__dropzone {
        min-height: 350px;
    }
    .upload-workbench__footer {
        padding: 16px;
    }
    .upload-workbench__actions {
        flex-wrap: wrap;
    }
}

.upload-progress {
    padding: 18px 0;
    color: var(--text-secondary);
}
.upload-progress progress {
    width: 100%;
    height: 8px;
    margin-top: 12px;
    accent-color: var(--primary-color);
}
@media (max-height: 650px) {
    .upload-workbench__dropzone {
        min-height: 0;
        padding: 20px;
        gap: 10px;
    }
    .upload-workbench__dropzone-icon {
        display: none;
    }
    .upload-workbench__dropzone-title {
        font-size: 18px;
    }
    .upload-workbench__dropzone-btn {
        margin: 0;
    }
    .upload-workbench__dropzone-size {
        margin-top: 0;
    }
    .upload-workbench {
        gap: 12px;
    }
}
</style>
