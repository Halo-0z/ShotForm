<template>
  <div class="pose-viewer">
    <div class="viewer-header">
      <h3 class="viewer-title">姿势分析结果</h3>
      <button class="btn btn-primary" @click="startAnalysis" :disabled="loading">
        <Loader2 v-if="loading" class="h-4 w-4 animate-spin mr-2" />
        {{ hasResult ? '重新分析' : '开始分析' }}
      </button>
    </div>
    
    <div class="viewer-content">
      <div class="image-section glass-panel">
        <div class="image-container">
          <canvas ref="canvasRef" class="pose-canvas"></canvas>
        </div>
      </div>
      
      <div class="result-section" v-if="analysisResult">
        <div class="result-card glass-card">
          <div class="card-header">
            <span class="card-title">投篮类型</span>
          </div>
          <div class="shot-type">
            <span class="quality-indicator" :class="shotTypeQuality">
              {{ shotTypeName }}
            </span>
            <span class="confidence">分型确定度: {{ (analysisResult.shotTypeConfidence * 100).toFixed(1) }}%</span>
          </div>
          <p class="shot-type-hint">{{ shotConfidenceHint }}</p>
          <div class="reasons">
            <p v-for="reason in analysisResult.shotTypeReasons" :key="reason">
              {{ reason }}
            </p>
          </div>
        </div>
        
        <div class="result-card glass-card">
          <div class="card-header">
            <span class="card-title">关节角度数据</span>
          </div>
          <AngleChart :angles="analysisResult.angles" />
        </div>
      </div>
      
      <div class="loading-overlay" v-if="loading">
        <div class="loading-spinner"></div>
        <p>正在分析中...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { SHOT_TYPE_NAMES, normalizeShotType, type ShotAnalysis, type PoseData, type ShotType } from '@/types'
import AngleChart from '@/components/ChartComponents/AngleChart.vue'
import { useAnalysisStore } from '@/stores/analysis'
import { Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  imageData: string
}>()

const analysisStore = useAnalysisStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const analysisResult = ref<ShotAnalysis | null>(null)

const hasResult = computed(() => !!analysisResult.value)
const normalizedShotType = computed<ShotType>(() => normalizeShotType(analysisResult.value?.shotType))

const shotTypeName = computed(() => {
  if (!analysisResult.value) return ''
  return SHOT_TYPE_NAMES[normalizedShotType.value]
})

const shotTypeQuality = computed(() => {
  if (!analysisResult.value) return 'good'
  const types: Record<ShotType, string> = {
    one_motion: 'excellent',
    one_point_five_motion: 'good',
    two_motion: 'average',
    unknown: 'average'
  }
  return types[normalizedShotType.value]
})

const shotConfidenceHint =
  '关键点可靠度代表骨骼点识别是否稳定，分型确定度代表这次分型判断是否足够明确。'

const drawPoseOnCanvas = (imageData: string, poseData: PoseData) => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const img = new Image()
  img.onload = () => {
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    
    const scaleX = img.width / poseData.width
    const scaleY = img.height / poseData.height
    
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
      [24, 26], [26, 28]
    ]
    
    ctx.strokeStyle = '#10B981'
    ctx.lineWidth = 3
    ctx.shadowColor = 'rgba(16, 185, 129, 0.5)'
    ctx.shadowBlur = 8
    connections.forEach(([start, end]) => {
      const startKp = poseData.keypoints.find(kp => kp.id === start)
      const endKp = poseData.keypoints.find(kp => kp.id === end)
      if (startKp && endKp && startKp.visibility > 0.5 && endKp.visibility > 0.5) {
        ctx.beginPath()
        ctx.moveTo(startKp.x * scaleX, startKp.y * scaleY)
        ctx.lineTo(endKp.x * scaleX, endKp.y * scaleY)
        ctx.stroke()
      }
    })
    
    ctx.shadowBlur = 0
    poseData.keypoints.forEach(kp => {
      if (kp.visibility > 0.5) {
        ctx.beginPath()
        ctx.arc(kp.x * scaleX, kp.y * scaleY, 6, 0, 2 * Math.PI)
        ctx.fillStyle = '#6366F1'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })
  }
  img.src = imageData
}

const startAnalysis = async () => {
  if (!props.imageData) return
  
  loading.value = true
  try {
    const result = await invoke<ShotAnalysis>('analyze_shot', {
      imageData: props.imageData
    })
    const normalizedResult: ShotAnalysis = {
      ...result,
      shotType: normalizeShotType(result.shotType)
    }
    analysisResult.value = normalizedResult
    analysisStore.setCurrentAnalysis(normalizedResult)
    
    drawPoseOnCanvas(props.imageData, normalizedResult.poseData)
  } catch (error) {
    console.error('Analysis failed:', error)
  } finally {
    loading.value = false
  }
}

watch(() => props.imageData, (newImage) => {
  if (newImage && canvasRef.value) {
    const ctx = canvasRef.value.getContext('2d')
    if (ctx) {
      const img = new Image()
      img.onload = () => {
        if (canvasRef.value) {
          canvasRef.value.width = img.width
          canvasRef.value.height = img.height
          ctx.drawImage(img, 0, 0)
        }
      }
      img.src = newImage
    }
  }
}, { immediate: true })

onMounted(() => {
  if (analysisStore.currentAnalysis) {
    analysisResult.value = analysisStore.currentAnalysis
  }
})
</script>

<style scoped>
.pose-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.viewer-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.viewer-content {
  flex: 1;
  display: flex;
  gap: var(--spacing-lg);
  overflow: hidden;
  position: relative;
}

.image-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.pose-canvas {
  max-width: 100%;
  max-height: 100%;
}

.result-section {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  overflow-y: auto;
}

.result-card {
  flex-shrink: 0;
  padding: var(--spacing-lg);
}

.card-header {
  margin-bottom: var(--spacing-md);
}

.card-title {
  font-weight: 600;
  font-size: var(--font-size-base);
  color: var(--text-primary);
}

.shot-type {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.confidence {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.shot-type-hint {
  margin-bottom: var(--spacing-md);
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.reasons {
  padding: var(--spacing-md);
  background: var(--glass-xs);
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
}

.reasons p {
  margin: var(--spacing-xs) 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  border-radius: var(--radius-lg);
  z-index: 10;
}

.loading-overlay p {
  color: var(--text-inverse);
  font-size: var(--font-size-base);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--glass-md);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
