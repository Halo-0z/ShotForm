<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PoseData } from '@/types'

const props = defineProps<{
  poseData: PoseData
  imageSrc?: string
  continuousAnimation?: boolean
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animFrameId = 0
let observer: MutationObserver | null = null
let imageEl: HTMLImageElement | null = null

const connections: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32]
]

const leftJointIds = new Set([11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31])
const rightJointIds = new Set([12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32])

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

const ENTRANCE_DURATION = 1200
const BREATH_AMPLITUDE = 0.12
const BREATH_PERIOD = 3200

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

let canvasWidth = 0
let canvasHeight = 0

const resizeCanvas = () => {
  const canvas = canvasRef.value
  const poseData = props.poseData
  if (!canvas || !poseData) return

  const baseWidth = imageEl?.naturalWidth || poseData.width || 960
  const baseHeight = imageEl?.naturalHeight || poseData.height || 720
  const aspectRatio = baseWidth / Math.max(baseHeight, 1)
  const maxDisplayWidth = 760
  const maxDisplayHeight = Math.min(460, Math.max(280, Math.round(window.innerHeight * 0.42)))
  let displayWidth = Math.min(baseWidth, maxDisplayWidth)
  let displayHeight = Math.max(240, Math.round(displayWidth / Math.max(aspectRatio, 0.1)))

  if (displayHeight > maxDisplayHeight) {
    displayHeight = maxDisplayHeight
    displayWidth = Math.max(240, Math.round(displayHeight * Math.max(aspectRatio, 0.1)))
  }

  const dpr = window.devicePixelRatio || 1
  canvasWidth = Math.round(displayWidth * dpr)
  canvasHeight = Math.round(displayHeight * dpr)

  if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
    canvas.width = canvasWidth
    canvas.height = canvasHeight
  }
  canvas.style.width = `min(100%, ${displayWidth}px)`
  canvas.style.height = 'auto'
}

const drawSkeleton = (context: CanvasRenderingContext2D, poseData: PoseData, progress: number, breathScale: number) => {
  const displayWidth = canvasWidth / (window.devicePixelRatio || 1)
  const displayHeight = canvasHeight / (window.devicePixelRatio || 1)

  const background = context.createLinearGradient(0, 0, displayWidth, displayHeight)
  background.addColorStop(0, '#08111f')
  background.addColorStop(1, '#0f1f2f')
  context.fillStyle = background
  context.fillRect(0, 0, displayWidth, displayHeight)

  if (imageEl) {
    context.save()
    context.globalAlpha = 0.22
    context.drawImage(imageEl, 0, 0, displayWidth, displayHeight)
    context.restore()
  }

  const scaleX = displayWidth / Math.max(poseData.width || (imageEl?.naturalWidth ?? 960), 1)
  const scaleY = displayHeight / Math.max(poseData.height || (imageEl?.naturalHeight ?? 720), 1)
  const keypointMap = new Map(poseData.keypoints.map(kp => [kp.id, kp]))

  const centerX = displayWidth / 2
  const centerY = displayHeight / 2

  const visibleKeypoints = poseData.keypoints.filter(kp => kp.visibility >= 0.45)
  const totalPoints = visibleKeypoints.length
  const pointStagger = 0.6 / Math.max(totalPoints, 1)

  const pointProgressMap = new Map<number, number>()
  visibleKeypoints.forEach((kp, i) => {
    const pointStart = i * pointStagger
    const rawProgress = Math.max(0, Math.min((progress - pointStart) / 0.4, 1))
    pointProgressMap.set(kp.id, easeOutCubic(rawProgress))
  })

  context.lineCap = 'round'
  context.lineJoin = 'round'

  connections.forEach(([startId, endId]) => {
    const startPoint = keypointMap.get(startId)
    const endPoint = keypointMap.get(endId)
    if (!startPoint || !endPoint || startPoint.visibility < 0.45 || endPoint.visibility < 0.45) return

    const startProg = pointProgressMap.get(startId) ?? 0
    const endProg = pointProgressMap.get(endId) ?? 0
    const lineProgress = Math.min(startProg, endProg)
    if (lineProgress <= 0) return

    const sx = centerX + (startPoint.x * scaleX - centerX) * lineProgress
    const sy = centerY + (startPoint.y * scaleY - centerY) * lineProgress
    const ex = centerX + (endPoint.x * scaleX - centerX) * lineProgress
    const ey = centerY + (endPoint.y * scaleY - centerY) * lineProgress

    const alpha = lineProgress
    const lineWidth = 3.5 * lineProgress

    context.beginPath()
    context.moveTo(sx, sy)
    context.lineTo(ex, ey)
    context.strokeStyle = getLineColor(startId, endId)
    context.lineWidth = lineWidth
    context.globalAlpha = alpha
    context.stroke()

    if (lineWidth > 1.5) {
      context.save()
      context.beginPath()
      context.moveTo(sx, sy)
      context.lineTo(ex, ey)
      context.strokeStyle = getLineColor(startId, endId)
      context.lineWidth = lineWidth + 3
      context.globalAlpha = alpha * 0.25
      context.stroke()
      context.restore()
    }

    context.globalAlpha = 1
  })

  visibleKeypoints.forEach((keypoint) => {
    const prog = pointProgressMap.get(keypoint.id) ?? 0
    if (prog <= 0) return

    const targetX = keypoint.x * scaleX
    const targetY = keypoint.y * scaleY
    const x = centerX + (targetX - centerX) * prog
    const y = centerY + (targetY - centerY) * prog

    const baseRadius = 4.5 + keypoint.visibility * 2.5
    const radius = baseRadius * prog * breathScale
    const alpha = prog

    context.beginPath()
    context.arc(x, y, radius + 3, 0, Math.PI * 2)
    context.fillStyle = `rgba(255, 255, 255, ${alpha * 0.2})`
    context.fill()

    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fillStyle = getPointColor(keypoint.id)
    context.globalAlpha = alpha
    context.fill()
    context.globalAlpha = 1
  })
}

const loadBackgroundImage = () => {
  if (!props.imageSrc) {
    imageEl = null
    return
  }
  const img = new Image()
  img.onload = () => {
    imageEl = img
    resizeCanvas()
  }
  img.src = props.imageSrc
}

let animStartTime = 0
let prefersReducedMotion = false
let animationStarted = false

const startAnimation = () => {
  cancelAnimationFrame(animFrameId)
  animStartTime = performance.now()
  animFrameId = requestAnimationFrame(animate)
  animationStarted = true
}

const animate = (timestamp: number) => {
  const canvas = canvasRef.value
  const poseData = props.poseData
  if (!canvas || !poseData) return

  const context = canvas.getContext('2d')
  if (!context) return

  const elapsed = timestamp - animStartTime
  const entranceProgress = Math.min(elapsed / ENTRANCE_DURATION, 1)

  let breathScale = 1
  if (entranceProgress >= 1 && props.continuousAnimation) {
    const breathPhase = (elapsed % BREATH_PERIOD) / BREATH_PERIOD
    breathScale = 1 + BREATH_AMPLITUDE * Math.sin(breathPhase * Math.PI * 2)
  }

  drawSkeleton(context, poseData, entranceProgress, breathScale)

  if (entranceProgress < 1 || (props.continuousAnimation && !prefersReducedMotion)) {
    animFrameId = requestAnimationFrame(animate)
  }
}

const handleResize = () => {
  resizeCanvas()
  if (animationStarted && props.poseData) {
    const canvas = canvasRef.value
    const context = canvas?.getContext('2d')
    if (context && canvasWidth > 0) {
      drawSkeleton(context, props.poseData, 1, 1)
    }
  }
}

watch(() => props.poseData, () => {
  startAnimation()
})

watch(() => props.imageSrc, () => {
  loadBackgroundImage()
})

onMounted(() => {
  prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  loadBackgroundImage()
  resizeCanvas()
  startAnimation()
  observer = new MutationObserver(() => {})
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animFrameId)
  observer?.disconnect()
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="skeleton-stage">
    <canvas ref="canvasRef" class="skeleton-stage__canvas"></canvas>
  </div>
</template>

<style scoped>
.skeleton-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 20%, var(--surface-border));
  background: radial-gradient(circle at top, rgba(56, 189, 248, 0.06), transparent 42%), #08111f;
  box-shadow:
    0 14px 28px rgba(8, 17, 31, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  padding: 10px;
}

.skeleton-stage__canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 14px;
}
</style>
