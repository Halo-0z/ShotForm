<template>
  <div v-if="visible" class="subject-picker">
    <div class="subject-picker__backdrop" @click="$emit('cancel')"></div>
    <div class="subject-picker__dialog">
      <h3 class="subject-picker__title">选择投篮主体</h3>
      <p class="subject-picker__hint">检测到多个人物，请点击选择投篮者。选中后将全程锁定跟踪。</p>

      <div class="subject-picker__canvas-wrap">
        <canvas
          ref="canvasRef"
          class="subject-picker__canvas"
          @click="onCanvasClick"
        ></canvas>
      </div>

      <div class="subject-picker__actions">
        <Button variant="outline" @click="$emit('cancel')">取消分析</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import type { FirstFrameMultiPose } from '@/types'

const UPPER_BODY_IDS = new Set([11, 12, 13, 14, 15, 16, 23, 24])
const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24]
]

const POSE_COLORS = [
  { stroke: '#5D7396', fill: 'rgba(93, 115, 150, 0.15)', label: 'A' },
  { stroke: '#C9823D', fill: 'rgba(201, 130, 61, 0.15)', label: 'B' },
  { stroke: '#6B9E78', fill: 'rgba(107, 158, 120, 0.15)', label: 'C' }
]

const props = defineProps<{
  visible: boolean
  multiPoseData: FirstFrameMultiPose | null
}>()

const emit = defineEmits<{
  (e: 'select', poseIndex: number): void
  (e: 'cancel'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let imageObj: HTMLImageElement | null = null

const drawScene = () => {
  const canvas = canvasRef.value
  const data = props.multiPoseData
  if (!canvas || !data) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const maxCanvasWidth = 560
  const scale = Math.min(1, maxCanvasWidth / data.width)
  canvas.width = Math.round(data.width * scale)
  canvas.height = Math.round(data.height * scale)

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (imageObj && imageObj.complete) {
    ctx.globalAlpha = 0.5
    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height)
    ctx.globalAlpha = 1.0
  }

  data.poses.forEach((pose, poseIdx) => {
    const color = POSE_COLORS[poseIdx % POSE_COLORS.length]
    const kpMap = new Map(pose.keypoints.map(kp => [kp.id, kp]))

    ctx.fillStyle = color.fill
    ctx.strokeStyle = color.stroke
    ctx.lineWidth = 2

    for (const [a, b] of CONNECTIONS) {
      const kpA = kpMap.get(a)
      const kpB = kpMap.get(b)
      if (!kpA || !kpB) continue
      if (kpA.visibility < 0.35 || kpB.visibility < 0.35) continue
      ctx.beginPath()
      ctx.moveTo(kpA.x * scale, kpA.y * scale)
      ctx.lineTo(kpB.x * scale, kpB.y * scale)
      ctx.stroke()
    }

    for (const kp of pose.keypoints) {
      if (kp.visibility < 0.35) continue
      if (!UPPER_BODY_IDS.has(kp.id)) continue
      ctx.beginPath()
      ctx.arc(kp.x * scale, kp.y * scale, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    const labelX = pose.torsoCx * scale
    const labelY = pose.torsoCy * scale - 20
    ctx.fillStyle = color.stroke
    ctx.font = 'bold 18px HarmonyOS Sans SC, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(color.label, labelX, labelY)

    ctx.beginPath()
    ctx.arc(labelX, labelY - 6, 14, 0, Math.PI * 2)
    ctx.strokeStyle = color.stroke
    ctx.lineWidth = 2
    ctx.stroke()
  })
}

const loadImage = () => {
  const data = props.multiPoseData
  if (!data) return

  imageObj = new Image()
  imageObj.onload = () => drawScene()
  imageObj.src = data.imageData
}

const onCanvasClick = (event: MouseEvent) => {
  const canvas = canvasRef.value
  const data = props.multiPoseData
  if (!canvas || !data) return

  const rect = canvas.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top

  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const imgX = clickX * scaleX
  const imgY = clickY * scaleY

  let bestPoseIdx = -1
  let bestDist = Infinity

  data.poses.forEach((pose, poseIdx) => {
    for (const kp of pose.keypoints) {
      if (kp.visibility < 0.35) continue
      if (!UPPER_BODY_IDS.has(kp.id)) continue
      const maxCanvasWidth = 560
      const scale = Math.min(1, maxCanvasWidth / data.width)
      const dx = kp.x * scale - imgX
      const dy = kp.y * scale - imgY
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        bestPoseIdx = poseIdx
      }
    }
  })

  if (bestPoseIdx >= 0 && bestDist < 2500) {
    emit('select', data.poses[bestPoseIdx].poseIndex)
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    setTimeout(loadImage, 50)
  }
})

watch(() => props.multiPoseData, () => {
  if (props.visible) {
    loadImage()
  }
})

onMounted(() => {
  if (props.visible) {
    loadImage()
  }
})

onUnmounted(() => {
  imageObj = null
})
</script>

<style scoped>
.subject-picker {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subject-picker__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.subject-picker__dialog {
  position: relative;
  background: var(--bg-solid, #141922);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 16px;
  padding: 28px 32px;
  max-width: 640px;
  width: 90vw;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
}

.subject-picker__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #e8eaed);
  margin: 0 0 8px;
}

.subject-picker__hint {
  font-size: 13px;
  color: var(--text-secondary, #9aa0a6);
  margin: 0 0 20px;
  line-height: 1.5;
}

.subject-picker__canvas-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.subject-picker__canvas {
  border-radius: 8px;
  cursor: pointer;
  max-width: 100%;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.subject-picker__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
