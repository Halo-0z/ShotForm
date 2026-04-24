<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pause, Play, RotateCcw } from 'lucide-vue-next'
import type { VideoAnalysisFrame } from '@/types'
import { formatTime } from '@/lib/analysis-utils'

const props = withDefaults(defineProps<{
  frames: VideoAnalysisFrame[]
  selectedFrameIndex?: number
  variant?: 'default' | 'hero'
}>(), {
  selectedFrameIndex: 0,
  variant: 'default'
})

const emit = defineEmits<{
  'update:selectedFrameIndex': [index: number]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const currentFrameIndex = ref(0)
const isPlaying = ref(false)
const playbackSpeed = ref<0.75 | 1 | 1.5>(1)
const playbackSpeeds: Array<0.75 | 1 | 1.5> = [0.75, 1, 1.5]
const isDark = ref(false)
const imageCache = new Map<string, HTMLImageElement>()
let playbackTimer: number | null = null
let observer: MutationObserver | null = null
let drawRequestId = 0

const connections: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32]
]

const leftJointIds = new Set([11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31])
const rightJointIds = new Set([12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32])

const currentFrame = computed(() => props.frames[currentFrameIndex.value] ?? null)
const hasFrames = computed(() => props.frames.length > 0)
const canAnimate = computed(() => props.frames.length > 1)
const isHeroVariant = computed(() => props.variant === 'hero')
const canAutoplay = computed(() => canAnimate.value)

const clampFrameIndex = (index: number) => {
  if (!props.frames.length) return 0
  return Math.min(Math.max(index, 0), props.frames.length - 1)
}

const clearPlaybackTimer = () => {
  if (playbackTimer !== null) {
    window.clearTimeout(playbackTimer)
    playbackTimer = null
  }
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
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
  image.onerror = () => reject(new Error('图像加载失败'))
  image.src = src
})

const preloadImages = async () => {
  const uniqueSources = [...new Set(props.frames.map(frame => frame.imageData).filter(Boolean))]
  await Promise.allSettled(uniqueSources.map(src => loadImage(src)))
}

const getPointColor = (jointId: number) => {
  if (leftJointIds.has(jointId)) return '#38bdf8'
  if (rightJointIds.has(jointId)) return '#f59e0b'
  return '#34d399'
}

const getLineColor = (startId: number, endId: number) => {
  if (leftJointIds.has(startId) && leftJointIds.has(endId)) return 'rgba(56, 189, 248, 0.92)'
  if (rightJointIds.has(startId) && rightJointIds.has(endId)) return 'rgba(245, 158, 11, 0.92)'
  return 'rgba(52, 211, 153, 0.92)'
}

const syncTheme = () => {
  if (typeof document === 'undefined') return
  isDark.value = document.documentElement.classList.contains('dark')
}

const handleWindowResize = () => {
  void drawFrame()
}

const drawFrame = async () => {
  const frame = currentFrame.value
  const canvas = canvasRef.value
  if (!frame || !canvas) return
  const requestId = ++drawRequestId
  const frameIndex = currentFrameIndex.value

  const poseData = frame.analysis.poseData
  const context = canvas.getContext('2d')
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
  const maxDisplayWidth = isHeroVariant.value ? 760 : 960
  const maxDisplayHeight = isHeroVariant.value
    ? Math.min(460, Math.max(280, Math.round(window.innerHeight * 0.42)))
    : 720
  let displayWidth = Math.min(baseWidth, maxDisplayWidth)
  let displayHeight = Math.max(240, Math.round(displayWidth / Math.max(aspectRatio, 0.1)))

  if (displayHeight > maxDisplayHeight) {
    displayHeight = maxDisplayHeight
    displayWidth = Math.max(240, Math.round(displayHeight * Math.max(aspectRatio, 0.1)))
  }

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(displayWidth * dpr)
  canvas.height = Math.round(displayHeight * dpr)
  canvas.style.width = isHeroVariant.value ? `min(100%, ${displayWidth}px)` : '100%'
  canvas.style.height = 'auto'

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, displayWidth, displayHeight)

  const background = context.createLinearGradient(0, 0, displayWidth, displayHeight)
  background.addColorStop(0, '#08111f')
  background.addColorStop(1, '#0f1f2f')
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
  const keypointMap = new Map(poseData.keypoints.map(keypoint => [keypoint.id, keypoint]))

  context.lineCap = 'round'
  context.lineJoin = 'round'

  connections.forEach(([startId, endId]) => {
    const startPoint = keypointMap.get(startId)
    const endPoint = keypointMap.get(endId)

    if (!startPoint || !endPoint || startPoint.visibility < 0.45 || endPoint.visibility < 0.45) {
      return
    }

    context.beginPath()
    context.moveTo(startPoint.x * scaleX, startPoint.y * scaleY)
    context.lineTo(endPoint.x * scaleX, endPoint.y * scaleY)
    context.strokeStyle = getLineColor(startId, endId)
    context.shadowColor = context.strokeStyle
    context.shadowBlur = 10
    context.lineWidth = 3.5
    context.stroke()
  })

  context.shadowBlur = 0

  poseData.keypoints.forEach(keypoint => {
    if (keypoint.visibility < 0.45) return

    const x = keypoint.x * scaleX
    const y = keypoint.y * scaleY
    const radius = 4.5 + keypoint.visibility * 2.5

    context.beginPath()
    context.arc(x, y, radius + 1.5, 0, Math.PI * 2)
    context.fillStyle = 'rgba(255, 255, 255, 0.9)'
    context.fill()

    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fillStyle = getPointColor(keypoint.id)
    context.shadowColor = getPointColor(keypoint.id)
    context.shadowBlur = 12
    context.fill()
  })

  context.shadowBlur = 0
  context.fillStyle = 'rgba(5, 10, 20, 0.72)'
  context.fillRect(16, 16, 176, 54)
  context.fillStyle = '#f8fafc'
  context.font = '600 15px HarmonyOS Sans SC, sans-serif'
  context.fillText(`关键帧 ${frameIndex + 1}/${props.frames.length}`, 28, 38)
  context.font = '400 13px HarmonyOS Sans SC, sans-serif'
  context.fillStyle = 'rgba(226, 232, 240, 0.92)'
  context.fillText(`时间点 ${formatTime(frame.timestampMs)}`, 28, 58)
}

const schedulePlayback = () => {
  clearPlaybackTimer()

  if (!isPlaying.value || !canAutoplay.value) {
    return
  }

  const activeFrame = props.frames[currentFrameIndex.value]
  const nextIndex = (currentFrameIndex.value + 1) % props.frames.length
  const nextFrame = props.frames[nextIndex]
  const rawDelay = nextFrame && activeFrame
    ? Math.abs(nextFrame.timestampMs - activeFrame.timestampMs)
    : 480
  const boundedDelay = Math.min(Math.max(rawDelay, 180), 850)
  const delay = boundedDelay / playbackSpeed.value

  playbackTimer = window.setTimeout(() => {
    currentFrameIndex.value = nextIndex
  }, delay)
}

const togglePlayback = () => {
  if (!canAnimate.value) return

  isPlaying.value = !isPlaying.value
  if (!isPlaying.value) {
    clearPlaybackTimer()
  }
}

const restartPlayback = () => {
  currentFrameIndex.value = clampFrameIndex(props.selectedFrameIndex ?? 0)
  if (canAutoplay.value) {
    isPlaying.value = true
  }
}

const setPlaybackSpeed = (speed: 0.75 | 1 | 1.5) => {
  playbackSpeed.value = speed
}

watch(
  () => props.selectedFrameIndex,
  index => {
    currentFrameIndex.value = clampFrameIndex(index ?? 0)
  }
)

watch(
  () => props.variant,
  async () => {
    isPlaying.value = canAutoplay.value
    await drawFrame()
    schedulePlayback()
  }
)

watch(
  () => props.frames,
  async () => {
    currentFrameIndex.value = clampFrameIndex(props.selectedFrameIndex ?? 0)
    await preloadImages()
    isPlaying.value = canAutoplay.value
    await drawFrame()
    schedulePlayback()
  },
  { deep: true, immediate: true }
)

watch(currentFrameIndex, async (index) => {
  if (!isHeroVariant.value && index !== (props.selectedFrameIndex ?? 0)) {
    emit('update:selectedFrameIndex', index)
  }
  await drawFrame()
  schedulePlayback()
})

watch(playbackSpeed, () => {
  schedulePlayback()
})

watch(isPlaying, playing => {
  if (!playing) {
    clearPlaybackTimer()
    return
  }

  schedulePlayback()
})

onMounted(() => {
  syncTheme()
  observer = new MutationObserver(syncTheme)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
  window.addEventListener('resize', handleWindowResize)
  void drawFrame()
  schedulePlayback()
})

onBeforeUnmount(() => {
  observer?.disconnect()
  clearPlaybackTimer()
  window.removeEventListener('resize', handleWindowResize)
})
</script>

<template>
  <Card
    v-if="hasFrames"
    class="playback-card"
    :class="{ 'dark-mode': isDark, 'playback-card--hero': isHeroVariant }"
  >
    <CardHeader v-if="!isHeroVariant" class="playback-header">
      <div class="playback-title-row">
        <CardTitle class="playback-title">动态骨骼点回放</CardTitle>
        <Badge variant="secondary">关键帧串联预览</Badge>
      </div>
      <p class="playback-description">
        用关键帧把整段动作的骨骼变化串起来，方便看举球到出手的连贯性。
      </p>
    </CardHeader>

    <CardContent class="playback-body" :class="{ 'playback-body--hero': isHeroVariant }">
      <div class="playback-canvas-wrap" :class="{ 'playback-canvas-wrap--hero': isHeroVariant }">
        <canvas ref="canvasRef" class="playback-canvas"></canvas>
      </div>

      <div class="playback-toolbar" :class="{ 'playback-toolbar--hero': isHeroVariant }">
        <div class="playback-main-controls">
          <Button variant="outline" size="sm" :disabled="!canAnimate" @click="togglePlayback">
            <Pause v-if="isPlaying" class="mr-2 h-4 w-4" />
            <Play v-else class="mr-2 h-4 w-4" />
            {{ isPlaying ? '暂停回放' : '播放回放' }}
          </Button>
          <Button v-if="!isHeroVariant" variant="outline" size="sm" @click="restartPlayback">
            <RotateCcw class="mr-2 h-4 w-4" />
            回到当前关键帧
          </Button>
        </div>

        <div class="speed-switch">
          <button
            v-for="speed in playbackSpeeds"
            :key="speed"
            class="speed-btn"
            :class="{ active: playbackSpeed === speed }"
            @click="setPlaybackSpeed(speed)"
          >
            {{ speed }}x
          </button>
        </div>
      </div>

      <div v-if="!isHeroVariant" class="playback-status">
        <span>当前时间点 {{ formatTime(currentFrame?.timestampMs ?? 0) }}</span>
        <span>已分析 {{ frames.length }} 个关键帧</span>
      </div>

      <input
        v-if="frames.length > 1"
        v-model.number="currentFrameIndex"
        class="playback-range"
        type="range"
        min="0"
        :max="frames.length - 1"
        step="1"
      />
    </CardContent>
  </Card>
</template>

<style scoped>
.playback-card {
  overflow: hidden;
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 248, 255, 0.9)),
    linear-gradient(135deg, rgba(99, 102, 241, 0.05), transparent 60%);
  box-shadow:
    0 18px 36px rgba(148, 163, 184, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.94);
}

.playback-card.dark-mode {
  border-color: color-mix(in srgb, var(--primary-color) 16%, rgba(255, 255, 255, 0.06));
  background:
    linear-gradient(180deg, rgba(28, 25, 45, 0.96), rgba(18, 16, 31, 0.94)),
    radial-gradient(circle at top, color-mix(in srgb, var(--primary-color) 14%, transparent), transparent 56%);
  box-shadow:
    0 22px 46px rgba(5, 4, 16, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28);
}

.playback-card--hero {
  border-radius: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-lg) 92%, var(--background)), color-mix(in srgb, var(--glass-md) 94%, var(--background)));
  box-shadow: var(--shadow-md);
}

.playback-card--hero.dark-mode {
  background:
    linear-gradient(180deg, rgba(17, 21, 30, 0.98), rgba(10, 14, 22, 0.96)),
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-color) 8%, transparent), transparent 58%);
  box-shadow:
    0 18px 34px rgba(5, 8, 16, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.playback-header {
  gap: 8px;
  padding-bottom: 10px;
}

.playback-card.dark-mode .playback-header {
  border-bottom: 1px solid rgba(129, 140, 248, 0.1);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
}

.playback-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.playback-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
}

.playback-description {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-secondary);
  max-width: 70ch;
}

.playback-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.playback-body--hero {
  gap: 12px;
  padding-top: 18px;
}

.playback-canvas-wrap {
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, var(--surface-border));
  background: radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 42%), #08111f;
  box-shadow:
    0 20px 40px rgba(8, 17, 31, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.playback-canvas-wrap--hero {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border-radius: 20px;
  background: radial-gradient(circle at top, rgba(56, 189, 248, 0.06), transparent 42%), #08111f;
  box-shadow:
    0 14px 28px rgba(8, 17, 31, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.playback-canvas {
  display: block;
  width: 100%;
  height: auto;
}

.playback-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.playback-toolbar--hero {
  padding-top: 0;
}

.playback-main-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.speed-switch {
  display: inline-flex;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
}

.playback-card.dark-mode .speed-switch {
  border-color: rgba(129, 140, 248, 0.16);
  background: color-mix(in srgb, var(--glass-sm) 88%, rgba(12, 11, 24, 0.74));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.speed-btn {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 7px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
}

.speed-btn.active {
  background: var(--primary-color);
  color: #fff;
}

.playback-card.dark-mode .speed-btn.active {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color) 84%, white 16%),
    color-mix(in srgb, var(--primary-hover) 90%, rgba(255, 255, 255, 0.08))
  );
  color: var(--text-inverse);
  box-shadow:
    0 8px 18px rgba(99, 102, 241, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.playback-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);
  padding: 0 2px;
}

.playback-range {
  width: 100%;
  height: 6px;
  cursor: pointer;
  appearance: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary-color) 18%, var(--glass-xs));
  margin-top: 2px;
}

.playback-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
}

@media (max-width: 720px) {
  .playback-toolbar {
    align-items: stretch;
  }

  .playback-main-controls,
  .speed-switch {
    width: 100%;
  }

  .speed-switch {
    justify-content: space-between;
  }

  .speed-btn {
    flex: 1;
    text-align: center;
  }
}
</style>
