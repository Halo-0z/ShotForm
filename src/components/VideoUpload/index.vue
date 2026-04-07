<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { basename } from '@tauri-apps/api/path'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Film, Loader2, Pause, Play, Scissors, Upload, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  loading?: boolean
  compact?: boolean
}>(), {
  loading: false,
  compact: false
})

const emit = defineEmits<{
  (e: 'video-loaded', payload: { filePath: string; previewUrl: string; trimStartMs: number; trimEndMs: number; durationMs: number }): void
}>()

const videoPath = ref('')
const videoName = ref('')
const previewUrl = ref('')
const browserFileInputRef = ref<HTMLInputElement | null>(null)
const durationMs = ref(0)
const trimStartMs = ref(0)
const trimEndMs = ref(0)
const loadingVideo = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const timelineCaptureVideoRef = ref<HTMLVideoElement | null>(null)
const timelineFilmstripRef = ref<HTMLElement | null>(null)
const isClipPreviewing = ref(false)
const timelineFrames = ref<string[]>([])
const isGeneratingTimelineFrames = ref(false)
const timelineGenerationError = ref('')
const timelineRailWidth = ref(0)
const minClipMs = 300
const targetTimelineFrameWidth = 36
const targetTimelineFrameHeight = 68
const videoEventTimeoutMs = 5000
let timelineGenerationId = 0
let timelineResizeObserver: ResizeObserver | null = null

const hasTauriRuntime = () => {
  if (typeof window === 'undefined') return false

  return typeof (window as Window & {
    __TAURI_INTERNALS__?: { invoke?: unknown }
  }).__TAURI_INTERNALS__?.invoke === 'function'
}

const isBusy = computed(() => props.loading || loadingVideo.value)
const hasVideo = computed(() => !!videoPath.value && !!previewUrl.value)
const clipDurationMs = computed(() => Math.max(0, trimEndMs.value - trimStartMs.value))
const sliderMaxMs = computed(() => Math.max(minClipMs, durationMs.value))
const trimStartPercent = computed(() => (sliderMaxMs.value <= 0 ? 0 : (trimStartMs.value / sliderMaxMs.value) * 100))
const trimEndPercent = computed(() => (sliderMaxMs.value <= 0 ? 100 : (trimEndMs.value / sliderMaxMs.value) * 100))
const trimMidpointPercent = computed(() => (trimStartPercent.value + trimEndPercent.value) / 2)
const timelinePlaceholderFrames = computed(() => Array.from({ length: 9 }, (_, index) => index))
const clipSelectionStyle = computed(() => ({
  left: `${trimStartPercent.value}%`,
  width: `${Math.max(0.75, trimEndPercent.value - trimStartPercent.value)}%`
}))
const clipStartHandleStyle = computed(() => ({
  left: `${trimStartPercent.value}%`
}))
const clipEndHandleStyle = computed(() => ({
  left: `${trimEndPercent.value}%`
}))
const clipStartMaskStyle = computed(() => ({
  width: `${Math.max(0, trimStartPercent.value)}%`
}))
const clipEndMaskStyle = computed(() => ({
  left: `${trimEndPercent.value}%`,
  width: `${Math.max(0, 100 - trimEndPercent.value)}%`
}))
const clipStartInputStyle = computed(() => ({
  clipPath: `inset(0 ${Math.max(0, 100 - trimMidpointPercent.value)}% 0 0 round 1.35rem)`
}))
const clipEndInputStyle = computed(() => ({
  clipPath: `inset(0 0 0 ${Math.max(0, trimMidpointPercent.value)}% round 1.35rem)`
}))
const uploadWorkspaceClass = computed(() => props.compact ? 'space-y-3 animate-slide-up' : 'space-y-4 animate-slide-up')
const cardContentClass = computed(() => props.compact ? 'space-y-4 p-4' : 'space-y-5 p-5')
const workspaceGridClass = computed(() => props.compact ? 'grid gap-4 xl:grid-cols-[minmax(320px,480px)_1fr]' : 'grid gap-5 xl:grid-cols-[minmax(360px,520px)_1fr]')
const detailColumnClass = computed(() => props.compact ? 'flex min-h-full flex-col gap-3' : 'space-y-4')
const videoPreviewClass = computed(() => props.compact ? 'aspect-[16/8.1] max-h-[320px] w-full bg-black object-contain' : 'aspect-video w-full bg-black object-contain')
const summaryPanelClass = computed(() => props.compact ? 'rounded-2xl border border-[color-mix(in_srgb,var(--surface-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-color)_90%,transparent),color-mix(in_srgb,var(--bg-solid)_94%,transparent))] p-3.5 shadow-[0_10px_22px_rgba(24,29,38,0.06),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_52%,transparent)]' : 'rounded-2xl border border-[color-mix(in_srgb,var(--surface-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-color)_88%,transparent),color-mix(in_srgb,var(--bg-solid)_92%,transparent))] p-4 shadow-[0_12px_26px_rgba(24,29,38,0.07),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_54%,transparent)]')
const previewPanelClass = computed(() => props.compact ? 'rounded-2xl border border-[color-mix(in_srgb,var(--surface-border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--glass-sm)_88%,transparent),color-mix(in_srgb,var(--surface-color)_88%,transparent))] p-3.5 shadow-[0_10px_22px_rgba(24,29,38,0.05),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_48%,transparent)]' : 'rounded-2xl border border-[color-mix(in_srgb,var(--surface-border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--glass-sm)_86%,transparent),color-mix(in_srgb,var(--surface-color)_86%,transparent))] p-4 shadow-[0_12px_26px_rgba(24,29,38,0.06),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_50%,transparent)]')
const helperNoteClass = computed(() => props.compact ? 'rounded-2xl border border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-color)_88%,transparent),color-mix(in_srgb,var(--bg-solid)_92%,transparent))] px-4 py-2.5 text-sm leading-6 text-[var(--text-muted)] shadow-[0_10px_22px_rgba(24,29,38,0.05)]' : 'rounded-2xl border border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-color)_88%,transparent),color-mix(in_srgb,var(--bg-solid)_92%,transparent))] px-4 py-3 text-sm leading-6 text-[var(--text-muted)] shadow-[0_10px_22px_rgba(24,29,38,0.05)]')
const compactHelperText = computed(() => props.compact
  ? '不修改原视频，只分析当前选中的动作区间。'
  : '这一步不会修改原视频，只是限定分析区间。我们会从你选中的片段里抽关键帧，做逐帧骨骼点和投篮分型判断。')
const actionRowClass = computed(() => props.compact ? 'mt-auto flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] pt-3' : 'flex flex-wrap gap-3')

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const formatPreciseTime = (milliseconds: number) => {
  const safeMilliseconds = Math.max(0, Number(milliseconds) || 0)
  const totalCentiseconds = Math.round(safeMilliseconds / 10)
  const minutes = Math.floor(totalCentiseconds / 6000)
  const seconds = Math.floor((totalCentiseconds % 6000) / 100)
  const centiseconds = totalCentiseconds % 100
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}

const mimeTypeFromPath = (path: string) => {
  const lower = path.toLowerCase()
  if (lower.endsWith('.mov')) return 'video/quicktime'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.avi')) return 'video/x-msvideo'
  return 'video/mp4'
}

const revokePreviewUrl = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

const resetTimelineFrames = () => {
  timelineGenerationId += 1
  isGeneratingTimelineFrames.value = false
  timelineGenerationError.value = ''
  timelineFrames.value = []
}

const syncTimelineRailWidth = () => {
  timelineRailWidth.value = Math.round(timelineFilmstripRef.value?.clientWidth || 0)
}

const bindTimelineFilmstrip = (element: Element | ComponentPublicInstance | null) => {
  const nextElement = element instanceof HTMLElement ? element : null
  if (timelineResizeObserver) {
    timelineResizeObserver.disconnect()
    timelineResizeObserver = null
  }

  timelineFilmstripRef.value = nextElement
  syncTimelineRailWidth()

  if (nextElement && typeof ResizeObserver !== 'undefined') {
    timelineResizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.round(nextElement.clientWidth || 0)
      if (nextWidth !== timelineRailWidth.value) {
        timelineRailWidth.value = nextWidth
      }
    })
    timelineResizeObserver.observe(nextElement)
  }
}

const waitForVideoEvent = (video: HTMLVideoElement, eventName: 'loadeddata' | 'seeked') => new Promise<void>((resolve, reject) => {
  const timeoutId = window.setTimeout(() => {
    cleanup()
    reject(new Error(`video ${eventName} timed out`))
  }, videoEventTimeoutMs)

  const cleanup = () => {
    window.clearTimeout(timeoutId)
    video.removeEventListener(eventName, handleResolve)
    video.removeEventListener('error', handleError)
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
  video.addEventListener('error', handleError, { once: true })
})

const waitForRenderedVideoFrame = (video: HTMLVideoElement) => new Promise<void>((resolve) => {
  if (typeof video.requestVideoFrameCallback === 'function') {
    video.requestVideoFrameCallback(() => resolve())
    return
  }

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
    return
  }

  window.setTimeout(resolve, 34)
})

const seekOffscreenVideo = async (video: HTMLVideoElement, timeInSeconds: number) => {
  if (Math.abs(video.currentTime - timeInSeconds) < 0.01) {
    await waitForRenderedVideoFrame(video)
    return
  }

  const seeked = waitForVideoEvent(video, 'seeked')
  video.currentTime = timeInSeconds
  await seeked
  await waitForRenderedVideoFrame(video)
}

const generateTimelineFrames = async () => {
  if (!previewUrl.value || durationMs.value <= 0 || timelineRailWidth.value <= 0 || typeof document === 'undefined') {
    timelineGenerationError.value = ''
    timelineFrames.value = []
    return
  }

  const generationId = ++timelineGenerationId
  isGeneratingTimelineFrames.value = true
  timelineGenerationError.value = ''

  const captureVideo = timelineCaptureVideoRef.value

  if (!captureVideo) {
    timelineFrames.value = []
    timelineGenerationError.value = 'timeline capture video unavailable'
    isGeneratingTimelineFrames.value = false
    return
  }

  try {
    if (!captureVideo.src) {
      captureVideo.src = previewUrl.value
    }

    if (captureVideo.readyState < 2) {
      const loaded = waitForVideoEvent(captureVideo, 'loadeddata')
      captureVideo.load()
      await loaded
    }

    await waitForRenderedVideoFrame(captureVideo)

    const captureCount = Math.min(48, Math.max(18, Math.ceil(timelineRailWidth.value / targetTimelineFrameWidth) + 4))
    const durationSeconds = durationMs.value / 1000
    const safeDuration = Math.max(durationSeconds, 0.1)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      timelineFrames.value = []
      return
    }

    const renderScale = Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    canvas.width = Math.max(48, Math.round(targetTimelineFrameWidth * renderScale))
    canvas.height = Math.max(68, Math.round(targetTimelineFrameHeight * renderScale))
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    const videoWidth = captureVideo.videoWidth || 16
    const videoHeight = captureVideo.videoHeight || 9
    const timelineAspectRatio = canvas.width / canvas.height
    const videoAspectRatio = videoWidth / videoHeight
    let sourceWidth = videoWidth
    let sourceHeight = videoHeight
    let sourceX = 0
    let sourceY = 0

    if (videoAspectRatio > timelineAspectRatio) {
      sourceWidth = videoHeight * timelineAspectRatio
      sourceX = (videoWidth - sourceWidth) / 2
    } else {
      sourceHeight = videoWidth / timelineAspectRatio
      sourceY = (videoHeight - sourceHeight) / 2
    }

    const frames: string[] = []

    for (let index = 0; index < captureCount; index += 1) {
      const progress = captureCount === 1 ? 0.5 : index / (captureCount - 1)
      const targetTime = Math.min(Math.max(progress * safeDuration, 0), Math.max(0, safeDuration - 0.05))
      await seekOffscreenVideo(captureVideo, targetTime)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = 'rgba(15, 23, 42, 1)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(captureVideo, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
      frames.push(canvas.toDataURL('image/png'))
    }

    if (generationId === timelineGenerationId) {
      timelineFrames.value = frames
    }
  } catch (error) {
    if (generationId === timelineGenerationId) {
      const message = error instanceof Error ? error.message : 'timeline frame generation failed'
      timelineFrames.value = []
      timelineGenerationError.value = message
    }
  } finally {
    captureVideo.pause()

    if (generationId === timelineGenerationId) {
      isGeneratingTimelineFrames.value = false
    }
  }
}

const seekToTrimStart = () => {
  if (!videoRef.value) return
  videoRef.value.currentTime = trimStartMs.value / 1000
}

const stopClipPreview = (pauseVideo = true) => {
  isClipPreviewing.value = false
  if (pauseVideo) {
    videoRef.value?.pause()
  }
}

const clearVideo = () => {
  stopClipPreview()
  resetTimelineFrames()
  revokePreviewUrl()
  videoPath.value = ''
  videoName.value = ''
  durationMs.value = 0
  trimStartMs.value = 0
  trimEndMs.value = 0
}

const applySelectedVideoFile = (file: File, path = '') => {
  revokePreviewUrl()
  previewUrl.value = URL.createObjectURL(file)
  videoPath.value = path
  videoName.value = file.name
  resetTimelineFrames()
  durationMs.value = 0
  trimStartMs.value = 0
  trimEndMs.value = 0
}

const handleBrowserVideoChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  applySelectedVideoFile(file)
  target.value = ''
}

const pickVideo = async () => {
  if (!hasTauriRuntime()) {
    browserFileInputRef.value?.click()
    return
  }

  loadingVideo.value = true
  stopClipPreview()

  try {
    const selected = await open({
      title: '选择投篮视频',
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'Video',
          extensions: ['mp4', 'mov', 'avi', 'webm', 'm4v']
        }
      ]
    })

    if (!selected || Array.isArray(selected)) {
      return
    }

    const bytes = await readFile(selected)
    const blob = new Blob([bytes], { type: mimeTypeFromPath(selected) })
    const filename = await basename(selected)
    applySelectedVideoFile(new File([blob], filename, { type: mimeTypeFromPath(selected) }), selected)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`视频读取失败: ${message}`)
  } finally {
    loadingVideo.value = false
  }
}

const onLoadedMetadata = () => {
  const duration = Math.max(0, Math.round((videoRef.value?.duration || 0) * 1000))
  durationMs.value = duration
  trimStartMs.value = 0
  trimEndMs.value = duration
  seekToTrimStart()
  void generateTimelineFrames()
}

const updateTrimStart = (event: Event) => {
  const nextValue = Number((event.target as HTMLInputElement).value)
  trimStartMs.value = Math.min(nextValue, Math.max(0, trimEndMs.value - minClipMs))
}

const updateTrimEnd = (event: Event) => {
  const nextValue = Number((event.target as HTMLInputElement).value)
  trimEndMs.value = Math.max(nextValue, trimStartMs.value + minClipMs)
}

const toggleClipPreview = async () => {
  if (!videoRef.value) return

  if (isClipPreviewing.value) {
    stopClipPreview()
    return
  }

  try {
    seekToTrimStart()
    isClipPreviewing.value = true
    await videoRef.value.play()
  } catch (error) {
    stopClipPreview()
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`片段预览失败: ${message}`)
  }
}

const onVideoTimeUpdate = () => {
  if (!videoRef.value || !isClipPreviewing.value) return

  const clipEndSeconds = trimEndMs.value / 1000
  if (videoRef.value.currentTime >= clipEndSeconds) {
    videoRef.value.currentTime = trimStartMs.value / 1000
  }
}

const onVideoPause = () => {
  if (isClipPreviewing.value) {
    isClipPreviewing.value = false
  }
}

const confirmVideo = () => {
  if (!videoPath.value || !previewUrl.value || durationMs.value <= 0 || isBusy.value) return

  stopClipPreview()
  emit('video-loaded', {
    filePath: videoPath.value,
    previewUrl: previewUrl.value,
    trimStartMs: trimStartMs.value,
    trimEndMs: trimEndMs.value,
    durationMs: durationMs.value
  })
}

watch(timelineRailWidth, (nextWidth, previousWidth) => {
  if (!previewUrl.value || durationMs.value <= 0 || nextWidth <= 0 || nextWidth === previousWidth) return
  void generateTimelineFrames()
})

watch([trimStartMs, trimEndMs], () => {
  if (!videoRef.value || durationMs.value <= 0) return

  const clipStartSeconds = trimStartMs.value / 1000
  const clipEndSeconds = trimEndMs.value / 1000

  if (isClipPreviewing.value) {
    videoRef.value.currentTime = clipStartSeconds
    return
  }

  if (videoRef.value.currentTime < clipStartSeconds || videoRef.value.currentTime > clipEndSeconds) {
    videoRef.value.currentTime = clipStartSeconds
  }
})

onMounted(() => {
  syncTimelineRailWidth()
})

onUnmounted(() => {
  timelineResizeObserver?.disconnect()
  timelineResizeObserver = null
  stopClipPreview()
  resetTimelineFrames()
  revokePreviewUrl()
})
</script>

<template>
  <div class="w-full animate-fade-in">
    <input
      ref="browserFileInputRef"
      type="file"
      accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm,.m4v"
      class="hidden"
      @change="handleBrowserVideoChange"
    />

    <div
      v-if="!hasVideo"
      class="relative overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--surface-border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--glass-lg)_94%,var(--surface-color)),color-mix(in_srgb,var(--glass-sm)_90%,transparent))] px-6 py-6 shadow-[0_24px_60px_rgba(24,29,38,0.16),var(--inset-highlight)]"
    >
      <div class="pointer-events-none absolute inset-x-[18%] top-5 h-24 rounded-full bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] blur-3xl opacity-65"></div>
      <div class="relative grid min-h-[360px] place-items-center rounded-[1.75rem] border border-dashed border-[color-mix(in_srgb,var(--surface-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--glass-md)_94%,var(--surface-color)),color-mix(in_srgb,var(--glass-xs)_90%,transparent))] px-8 py-10 text-center shadow-[0_18px_42px_rgba(24,29,38,0.1),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_64%,transparent)]">
        <div class="mx-auto flex max-w-xl flex-col items-center justify-center gap-5">
          <div class="rounded-[1.4rem] border border-[color-mix(in_srgb,var(--surface-border)_76%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--glass-lg)_94%,var(--surface-color)),color-mix(in_srgb,var(--glass-sm)_86%,transparent))] p-5 shadow-[0_14px_28px_rgba(24,29,38,0.12),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_54%,transparent)]">
            <Film class="h-10 w-10 text-[var(--primary-color)]" />
          </div>
          <div class="space-y-2 text-center">
            <p class="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-none text-[var(--text-primary)]">选择投篮视频</p>
            <p class="mx-auto max-w-lg text-sm leading-7 text-[var(--text-secondary)]">
              建议 2 到 6 秒，包含举球到出手的完整片段。我们会在后续帮你裁剪分析区间并提取关键帧。
            </p>
          </div>
          <p class="rounded-full border border-[var(--surface-border)] bg-[var(--glass-xs)] px-4 py-2 text-xs text-[var(--text-muted)] shadow-[var(--shadow-sm)]">
            支持 MP4 / MOV / AVI / WEBM
          </p>
          <Button variant="upload-cta" size="lg" class="min-w-44" :disabled="isBusy" @click="pickVideo">
            <Loader2 v-if="loadingVideo" class="mr-2 h-4 w-4 animate-spin" />
            <Upload v-else class="mr-2 h-4 w-4" />
            {{ loadingVideo ? '读取视频中...' : '选择视频' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-else :class="uploadWorkspaceClass">
      <Card class="overflow-hidden">
        <CardContent :class="cardContentClass">
          <div :class="workspaceGridClass">
            <div class="relative overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--glass-sm)]">
              <video
                ref="videoRef"
                :src="previewUrl"
                controls
                playsinline
                :class="videoPreviewClass"
                @loadedmetadata="onLoadedMetadata"
                @timeupdate="onVideoTimeUpdate"
                @pause="onVideoPause"
              ></video>
              <video
                ref="timelineCaptureVideoRef"
                :src="previewUrl"
                muted
                playsinline
                preload="auto"
                tabindex="-1"
                aria-hidden="true"
                class="pointer-events-none fixed -left-[9999px] top-0 h-auto w-[240px] max-w-none opacity-0"
              ></video>
            </div>

            <div :class="detailColumnClass">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <h3 class="truncate text-lg font-semibold text-[var(--text-primary)]">{{ videoName }}</h3>
                    <p class="mt-1 text-sm text-[var(--text-secondary)]">{{ props.compact ? '先裁剪，再开始分析。' : '先裁剪分析范围，再交给 MediaPipe 做动态骨骼点分析' }}</p>
                  </div>
                  <Button variant="outline" size="icon" @click="clearVideo">
                    <X class="h-4 w-4" />
                  </Button>
                </div>

              <div :class="summaryPanelClass">
                <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
                  <span>视频总时长: {{ formatTime(durationMs) }}</span>
                  <span>当前片段: {{ formatPreciseTime(trimStartMs) }} - {{ formatPreciseTime(trimEndMs) }}</span>
                  <span>片段长度: {{ formatPreciseTime(clipDurationMs) }}</span>
                </div>

                <div :class="props.compact ? 'mt-3' : 'mt-4'">
                  <div class="clip-range-shell">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p class="text-sm font-medium text-[var(--text-primary)]">裁剪分析区间</p>
                        <p class="mt-1 text-xs text-[var(--text-secondary)]">拖动两端控制点，只保留真正要分析的那段动作。</p>
                      </div>
                      <p class="rounded-full border border-[color-mix(in_srgb,var(--accent-color)_26%,transparent)] bg-[color-mix(in_srgb,var(--accent-color)_10%,transparent)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]">
                        {{ formatPreciseTime(trimStartMs) }} - {{ formatPreciseTime(trimEndMs) }}
                      </p>
                    </div>

                    <div class="clip-range-rail mt-5">
                      <div class="clip-range-stage">
                        <div class="clip-range-filmstrip" :ref="bindTimelineFilmstrip">
                          <div class="clip-range-thumbnails" :class="{ 'clip-range-thumbnails-loading': isGeneratingTimelineFrames }">
                            <template v-if="timelineFrames.length">
                              <div
                                v-for="(frame, index) in timelineFrames"
                                :key="`${frame}-${index}`"
                                class="clip-range-frame"
                              >
                                <img :src="frame" alt="" class="clip-range-frame-image" />
                              </div>
                            </template>
                            <template v-else-if="isGeneratingTimelineFrames">
                              <div
                                v-for="placeholder in timelinePlaceholderFrames"
                                :key="`placeholder-${placeholder}`"
                                class="clip-range-frame clip-range-frame-placeholder"
                              ></div>
                            </template>
                            <template v-else-if="timelineGenerationError">
                              <div class="clip-range-error">
                                <p class="clip-range-error-title">缩略帧生成失败</p>
                                <button type="button" class="clip-range-error-retry" @click="generateTimelineFrames">
                                  重新生成时间轴
                                </button>
                              </div>
                            </template>
                            <template v-else>
                              <div
                                v-for="placeholder in timelinePlaceholderFrames"
                                :key="`placeholder-idle-${placeholder}`"
                                class="clip-range-frame clip-range-frame-placeholder"
                              ></div>
                            </template>
                          </div>
                          <div class="clip-range-mask clip-range-mask-start" :style="clipStartMaskStyle"></div>
                          <div class="clip-range-mask clip-range-mask-end" :style="clipEndMaskStyle"></div>
                          <div class="clip-range-window" :style="clipSelectionStyle"></div>
                        </div>

                        <div class="clip-range-grip clip-range-grip-start" :style="clipStartHandleStyle"></div>
                        <div class="clip-range-grip clip-range-grip-end" :style="clipEndHandleStyle"></div>

                        <input
                          aria-label="开始时间"
                          class="clip-range-input clip-range-input-start"
                          :style="clipStartInputStyle"
                          type="range"
                          min="0"
                          :max="sliderMaxMs"
                          step="10"
                          :value="trimStartMs"
                          @input="updateTrimStart"
                        />

                        <input
                          aria-label="结束时间"
                          class="clip-range-input clip-range-input-end"
                          :style="clipEndInputStyle"
                          type="range"
                          min="0"
                          :max="sliderMaxMs"
                          step="10"
                          :value="trimEndMs"
                          @input="updateTrimEnd"
                        />
                      </div>
                    </div>

                    <div :class="props.compact ? 'mt-3 flex items-center justify-between gap-4 text-xs text-[var(--text-secondary)]' : 'mt-4 flex items-center justify-between gap-4 text-xs text-[var(--text-secondary)]'">
                      <div class="space-y-1">
                        <p class="uppercase tracking-[0.22em] text-[var(--text-muted)]">起点</p>
                        <p class="text-sm font-semibold text-[var(--text-primary)]">{{ formatPreciseTime(trimStartMs) }}</p>
                      </div>
                      <div class="text-center">
                        <p class="uppercase tracking-[0.22em] text-[var(--text-muted)]">片段</p>
                        <p class="text-sm font-semibold text-[var(--text-primary)]">{{ formatPreciseTime(clipDurationMs) }}</p>
                      </div>
                      <div class="space-y-1 text-right">
                        <p class="uppercase tracking-[0.22em] text-[var(--text-muted)]">终点</p>
                        <p class="text-sm font-semibold text-[var(--text-primary)]">{{ formatPreciseTime(trimEndMs) }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <template v-if="!props.compact">
                  <div :class="[previewPanelClass, props.compact ? 'mt-3' : 'mt-4']">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p class="text-sm font-medium text-[var(--text-primary)]">预览当前裁剪片段</p>
                        <p class="mt-1 text-xs text-[var(--text-secondary)]">
                          会在 {{ formatPreciseTime(trimStartMs) }} 到 {{ formatPreciseTime(trimEndMs) }} 之间循环播放，方便先确认分析区间。
                        </p>
                      </div>
                      <Button variant="outline" :disabled="isBusy || durationMs <= 0" @click="toggleClipPreview">
                        <Pause v-if="isClipPreviewing" class="mr-2 h-4 w-4" />
                        <Play v-else class="mr-2 h-4 w-4" />
                        {{ isClipPreviewing ? '停止预览' : '预览裁剪片段' }}
                      </Button>
                    </div>
                  </div>
                </template>
              </div>

              <div v-if="!props.compact" :class="helperNoteClass">
                {{ compactHelperText }}
              </div>
              <p v-else class="text-xs leading-5 text-[var(--text-muted)]">
                {{ compactHelperText }}
              </p>

              <div :class="actionRowClass">
                <Button
                  v-if="props.compact"
                  variant="outline"
                  :disabled="isBusy || durationMs <= 0"
                  @click="toggleClipPreview"
                >
                  <Pause v-if="isClipPreviewing" class="mr-2 h-4 w-4" />
                  <Play v-else class="mr-2 h-4 w-4" />
                  {{ props.compact ? '预览片段' : '预览裁剪片段' }}
                </Button>
                <Button :disabled="isBusy || durationMs <= 0" size="lg" @click="confirmVideo">
                  <Loader2 v-if="props.loading" class="mr-2 h-4 w-4 animate-spin" />
                  <Upload v-else class="mr-2 h-4 w-4" />
                  {{ props.loading ? '分析中...' : '开始视频分析' }}
                </Button>
                <Button variant="outline" size="lg" @click="pickVideo" :disabled="isBusy">
                  <Film class="mr-2 h-4 w-4" />
                  重新选择视频
                </Button>
                <Button variant="outline" size="lg" @click="clearVideo" :disabled="isBusy">
                  <Scissors class="mr-2 h-4 w-4" />
                  清空
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.clip-range-shell {
  --clip-range-gutter: 0.9rem;
  --clip-range-vertical-gutter: 0.42rem;
  --clip-frame-width: 2.25rem;
  border: 1px solid color-mix(in srgb, var(--surface-border) 80%, transparent);
  border-radius: 1.5rem;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-color) 88%, transparent), color-mix(in srgb, var(--bg-solid) 94%, transparent));
  padding: 1rem 1rem 0.9rem;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 72%, transparent),
    0 18px 34px rgba(24, 29, 38, 0.13);
}

.clip-range-rail {
  position: relative;
  height: 5rem;
  border-radius: 1.35rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg-solid) 84%, black);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--surface-border) 70%, transparent),
    0 10px 22px rgba(24, 29, 38, 0.08);
}

.clip-range-stage {
  position: absolute;
  inset: var(--clip-range-vertical-gutter) var(--clip-range-gutter);
}

.clip-range-filmstrip {
  position: absolute;
  inset: 0;
  border-radius: 1rem;
  overflow: hidden;
  background: color-mix(in srgb, var(--bg-solid) 88%, black);
}

.clip-range-thumbnails {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--clip-frame-width);
  justify-content: start;
  height: 100%;
}

.clip-range-thumbnails-loading {
  opacity: 1;
}

.clip-range-frame {
  position: relative;
  overflow: hidden;
  border-inline-end: 1px solid color-mix(in srgb, var(--surface-border) 62%, transparent);
  background: color-mix(in srgb, var(--bg-solid) 92%, black);
}

.clip-range-frame-placeholder::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 16%, transparent), transparent 40%, rgba(24, 29, 38, 0.22)),
    linear-gradient(180deg, color-mix(in srgb, var(--border-light) 28%, transparent), transparent 58%);
}

.clip-range-frame-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.clip-range-error {
  display: grid;
  height: 100%;
  place-items: center;
  gap: 0.45rem;
  padding: 0.9rem;
  text-align: center;
  background: color-mix(in srgb, var(--bg-solid) 90%, black);
}

.clip-range-error-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
}

.clip-range-error-retry {
  border: 1px solid color-mix(in srgb, var(--accent-color) 26%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  color: var(--text-primary);
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.5rem 0.9rem;
}

.clip-range-mask,
.clip-range-window {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
}

.clip-range-mask {
  background:
    linear-gradient(180deg, rgba(19, 23, 29, 0.62), rgba(19, 23, 29, 0.54));
}

.clip-range-window {
  border-top: 1px solid color-mix(in srgb, var(--accent-color) 38%, white);
  border-bottom: 1px solid color-mix(in srgb, var(--accent-color) 24%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 14%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-color) 8%, transparent);
}

.clip-range-grip {
  position: absolute;
  top: 50%;
  width: 0.62rem;
  height: calc(100% - 0.3rem);
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 36%, white);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-lg) 94%, white), color-mix(in srgb, var(--glass-sm) 84%, var(--accent-color)));
  box-shadow:
    0 12px 26px rgba(24, 29, 38, 0.2),
    0 0 0 6px color-mix(in srgb, var(--accent-color) 8%, transparent);
  pointer-events: none;
}

.clip-range-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  background: transparent;
  outline: none;
}

.clip-range-input::-webkit-slider-runnable-track {
  height: calc(5rem - (var(--clip-range-vertical-gutter) * 2));
  background: transparent;
}

.clip-range-input::-webkit-slider-thumb {
  appearance: none;
  width: 1.85rem;
  height: calc(5rem - (var(--clip-range-vertical-gutter) * 2));
  border: none;
  background: transparent;
  cursor: ew-resize;
}

.clip-range-input::-moz-range-track {
  height: calc(5rem - (var(--clip-range-vertical-gutter) * 2));
  background: transparent;
  border: none;
}

.clip-range-input::-moz-range-thumb {
  width: 1.85rem;
  height: calc(5rem - (var(--clip-range-vertical-gutter) * 2));
  border: none;
  border-radius: 0;
  background: transparent;
  cursor: ew-resize;
}

.clip-range-input-start {
  z-index: 3;
}

.clip-range-input-end {
  z-index: 4;
}

@media (max-width: 640px) {
  .clip-range-shell {
    --clip-range-gutter: 0.75rem;
    --clip-range-vertical-gutter: 0.36rem;
    --clip-frame-width: 2rem;
    padding-inline: 0.85rem;
  }

  .clip-range-rail {
    height: 4.4rem;
  }
}
</style>
