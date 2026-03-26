<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { basename } from '@tauri-apps/api/path'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Film, Loader2, Pause, Play, Scissors, Upload, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  loading?: boolean
}>(), {
  loading: false
})

const emit = defineEmits<{
  (e: 'video-loaded', payload: { filePath: string; previewUrl: string; trimStartMs: number; trimEndMs: number; durationMs: number }): void
}>()

const videoPath = ref('')
const videoName = ref('')
const previewUrl = ref('')
const durationMs = ref(0)
const trimStartMs = ref(0)
const trimEndMs = ref(0)
const loadingVideo = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const isClipPreviewing = ref(false)
const minClipMs = 300

const isBusy = computed(() => props.loading || loadingVideo.value)
const hasVideo = computed(() => !!videoPath.value && !!previewUrl.value)
const clipDurationMs = computed(() => Math.max(0, trimEndMs.value - trimStartMs.value))

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
  revokePreviewUrl()
  videoPath.value = ''
  videoName.value = ''
  durationMs.value = 0
  trimStartMs.value = 0
  trimEndMs.value = 0
}

const pickVideo = async () => {
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
    revokePreviewUrl()
    previewUrl.value = URL.createObjectURL(blob)
    videoPath.value = selected
    videoName.value = await basename(selected)
    durationMs.value = 0
    trimStartMs.value = 0
    trimEndMs.value = 0
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

onUnmounted(() => {
  stopClipPreview()
  revokePreviewUrl()
})
</script>

<template>
  <div class="w-full animate-fade-in">
    <div
      v-if="!hasVideo"
      class="relative overflow-hidden rounded-[2rem] border border-[var(--surface-border)] bg-[linear-gradient(180deg,var(--glass-lg),var(--glass-md))] px-6 py-6 shadow-[var(--shadow-lg),var(--inset-highlight)] backdrop-blur-sm"
    >
      <div class="pointer-events-none absolute inset-x-[16%] top-4 h-28 rounded-full bg-[rgba(129,140,248,0.18)] blur-3xl opacity-75"></div>
      <div class="relative grid min-h-[360px] place-items-center rounded-[1.75rem] border border-dashed border-[rgba(129,140,248,0.24)] bg-[linear-gradient(180deg,var(--glass-md),var(--glass-xs))] px-8 py-10 text-center shadow-[inset_0_1px_0_color-mix(in_srgb,var(--border-light)_88%,transparent)]">
        <div class="mx-auto flex max-w-xl flex-col items-center justify-center gap-5">
          <div class="rounded-[1.4rem] bg-[linear-gradient(180deg,var(--glass-lg),color-mix(in_srgb,var(--glass-sm)_92%,transparent))] p-5 shadow-[0_12px_24px_rgba(99,102,241,0.12),var(--inset-highlight)]">
            <Film class="h-10 w-10 text-[var(--primary-color)]" />
          </div>
          <div class="space-y-2 text-center">
            <p class="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-none text-[var(--text-primary)]">选择投篮视频</p>
            <p class="mx-auto max-w-lg text-sm leading-7 text-[var(--text-secondary)]">
              建议 2 到 6 秒，包含举球到出手的完整片段。我们会在后续帮你裁剪分析区间并提取关键帧。
            </p>
          </div>
          <p class="rounded-full border border-[rgba(129,140,248,0.18)] bg-[var(--glass-xs)] px-4 py-2 text-xs text-[var(--text-muted)] shadow-[var(--shadow-sm)]">
            支持 MP4 / MOV / AVI / WEBM
          </p>
          <Button size="lg" class="min-w-44" :disabled="isBusy" @click="pickVideo">
            <Loader2 v-if="loadingVideo" class="mr-2 h-4 w-4 animate-spin" />
            <Upload v-else class="mr-2 h-4 w-4" />
            {{ loadingVideo ? '读取视频中...' : '选择视频' }}
          </Button>
        </div>
      </div>
    </div>

    <div v-else class="space-y-4 animate-slide-up">
      <Card class="overflow-hidden">
        <CardContent class="space-y-5 p-5">
          <div class="grid gap-5 xl:grid-cols-[minmax(360px,520px)_1fr]">
            <div class="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--glass-sm)]">
              <video
                ref="videoRef"
                :src="previewUrl"
                controls
                playsinline
                class="aspect-video w-full bg-black object-contain"
                @loadedmetadata="onLoadedMetadata"
                @timeupdate="onVideoTimeUpdate"
                @pause="onVideoPause"
              ></video>
            </div>

            <div class="space-y-4">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <h3 class="truncate text-lg font-semibold text-[var(--text-primary)]">{{ videoName }}</h3>
                  <p class="mt-1 text-sm text-[var(--text-secondary)]">先裁剪分析范围，再交给 MediaPipe 做动态骨骼点分析</p>
                </div>
                <Button variant="outline" size="icon" @click="clearVideo">
                  <X class="h-4 w-4" />
                </Button>
              </div>

              <div class="rounded-2xl border border-[var(--surface-border)] bg-[var(--glass-xs)] p-4">
                <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
                  <span>视频总时长: {{ formatTime(durationMs) }}</span>
                  <span>当前片段: {{ formatTime(trimStartMs) }} - {{ formatTime(trimEndMs) }}</span>
                  <span>片段长度: {{ formatTime(clipDurationMs) }}</span>
                </div>

                <div class="mt-4 space-y-4">
                  <label class="block text-sm font-medium text-[var(--text-primary)]">
                    开始时间
                    <input
                      class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--glass-md)]"
                      type="range"
                      min="0"
                      :max="Math.max(minClipMs, durationMs)"
                      step="50"
                      :value="trimStartMs"
                      @input="updateTrimStart"
                    />
                  </label>

                  <label class="block text-sm font-medium text-[var(--text-primary)]">
                    结束时间
                    <input
                      class="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--glass-md)]"
                      type="range"
                      min="0"
                      :max="Math.max(minClipMs, durationMs)"
                      step="50"
                      :value="trimEndMs"
                      @input="updateTrimEnd"
                    />
                  </label>
                </div>

                <div class="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--glass-sm)] p-4">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-sm font-medium text-[var(--text-primary)]">预览当前裁剪片段</p>
                      <p class="mt-1 text-xs text-[var(--text-secondary)]">
                        会从 {{ formatTime(trimStartMs) }} 循环播放到 {{ formatTime(trimEndMs) }}，方便先确认分析区间。
                      </p>
                    </div>
                    <Button variant="outline" :disabled="isBusy || durationMs <= 0" @click="toggleClipPreview">
                      <Pause v-if="isClipPreviewing" class="mr-2 h-4 w-4" />
                      <Play v-else class="mr-2 h-4 w-4" />
                      {{ isClipPreviewing ? '停止预览' : '预览裁剪片段' }}
                    </Button>
                  </div>
                </div>
              </div>

              <div class="rounded-2xl bg-[var(--glass-xs)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                这一步不会修改原视频，只是限定分析区间。我们会从你选中的片段里抽关键帧，做逐帧骨骼点和投篮分型判断。
              </div>

              <div class="flex flex-wrap gap-3">
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

