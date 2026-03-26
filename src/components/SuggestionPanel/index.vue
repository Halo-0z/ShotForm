<template>
  <div class="suggestion-panel">
    <div class="panel-header">
      <h3>姿势纠正建议</h3>
      <div v-if="analysis" class="panel-actions">
        <Button
          size="sm"
          variant="outline"
          class="ai-action-button"
          :disabled="loading"
          @click="generateAiSuggestions"
        >
          {{ actionLabel }}
        </Button>
        <span class="source-pill" :class="sourceClass">
          {{ sourceLabel }}
        </span>
      </div>
    </div>

    <p v-if="successMessage" class="success-hint">
      {{ successMessage }}
    </p>

    <div v-if="loading" class="loading-state">
      正在生成 AI 建议...
    </div>

    <div v-else-if="aiError" class="error-state">
      <p class="error-title">AI 建议暂时不可用，已回退到本地规则。</p>
      <p class="error-message">{{ aiError }}</p>
      <div v-if="canRetryAi" class="error-actions">
        <Button
          size="sm"
          variant="outline"
          class="retry-ai-button"
          :disabled="retryCooldownSeconds > 0 || loading"
          @click="generateAiSuggestions"
        >
          {{ retryButtonLabel }}
        </Button>
        <span v-if="retryCooldownSeconds > 0" class="retry-hint">
          {{ retryCooldownSeconds }}s 后可重试
        </span>
      </div>
    </div>

    <div v-if="!loading && summary" class="summary-card">
      <p class="summary-label">整体动作总结</p>
      <p class="summary-text">{{ summary }}</p>
    </div>

    <div v-if="!loading && suggestions.length > 0" class="suggestions">
      <el-card
        v-for="(suggestion, index) in suggestions"
        :key="`${suggestion.bodyPart}-${index}`"
        class="suggestion-card"
        :class="`priority-${suggestion.priority}`"
      >
        <div class="suggestion-header">
          <el-icon :size="24" :color="getPriorityColor(suggestion.priority)">
            <component :is="getPriorityIcon(suggestion.priority)" />
          </el-icon>
          <span class="body-part">{{ suggestion.bodyPart }}</span>
          <el-tag :type="getPriorityTag(suggestion.priority)" size="small">
            {{ getPriorityLabel(suggestion.priority) }}
          </el-tag>
        </div>
        <div class="suggestion-content">
          <p class="issue">
            <el-icon><Warning /></el-icon>
            问题：{{ suggestion.issue }}
          </p>
          <p class="advice">
            <el-icon><CircleCheck /></el-icon>
            建议：{{ suggestion.suggestion }}
          </p>
        </div>
      </el-card>
    </div>

    <el-empty
      v-else-if="!loading && !analysis"
      description="请先完成姿势分析"
    />
    <el-result
      v-else-if="!loading && !suggestions.length"
      icon="success"
      title="暂无明显纠正项"
      sub-title="当前姿态没有命中明显异常角度，建议继续结合视频节奏与连续帧观察。"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { CircleCheck, InfoFilled, Warning, WarningFilled } from '@element-plus/icons-vue'
import { Button } from '@/components/ui/button'
import type {
  AiCoachingResponse,
  CorrectionSuggestion,
  ShotAnalysis
} from '@/types'
import { useAnalysisStore } from '@/stores/analysis'
import { getRetryCooldownSeconds, isRetryableAiError } from '@/lib/ai-retry-policy.js'
import { resolveAiImageSource } from '@/lib/ai-coaching-image.js'

const props = defineProps<{
  analysis: ShotAnalysis | null
}>()

const analysisStore = useAnalysisStore()
const suggestions = ref<CorrectionSuggestion[]>([])
const summary = ref('')
const loading = ref(false)
const aiError = ref('')
const successMessage = ref('')
const retryCooldownSeconds = ref(0)

let retryCooldownTimer: number | null = null

const sourceLabel = computed(() => {
  if (analysisStore.currentAiCoachingSource === 'ai') return 'AI 建议'
  if (analysisStore.currentAiCoachingSource === 'cache') return '本地缓存'
  return '本地规则'
})

const sourceClass = computed(() => {
  if (analysisStore.currentAiCoachingSource === 'ai') return 'source-ai'
  if (analysisStore.currentAiCoachingSource === 'cache') return 'source-cache'
  return 'source-rules'
})

const hasCachedAiSuggestions = computed(() => {
  return Boolean(
    analysisStore.currentAiCoachingSummary
      || analysisStore.currentAiCoachingSuggestions.length
  )
})

const canRetryAi = computed(() => isRetryableAiError(aiError.value))

const actionLabel = computed(() => {
  if (loading.value) {
    return '生成中...'
  }

  return hasCachedAiSuggestions.value ? '重新生成 AI 建议' : '生成 AI 建议'
})

const retryButtonLabel = computed(() => {
  if (loading.value) {
    return '重试中...'
  }

  if (retryCooldownSeconds.value > 0) {
    return '等待冷却'
  }

  return '重试 AI 建议'
})

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    high: '#F56C6C',
    medium: '#E6A23C',
    low: '#909399'
  }
  return colors[priority] || '#909399'
}

const getPriorityIcon = (priority: string) => {
  const icons = {
    high: WarningFilled,
    medium: Warning,
    low: InfoFilled
  }
  return icons[priority as keyof typeof icons] || InfoFilled
}

const getPriorityTag = (priority: string) => {
  const tags: Record<string, 'danger' | 'warning' | 'info'> = {
    high: 'danger',
    medium: 'warning',
    low: 'info'
  }
  return tags[priority] || 'info'
}

const getPriorityLabel = (priority: string) => {
  const labels: Record<string, string> = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级'
  }
  return labels[priority] || '低优先级'
}

const buildFallbackSummary = (
  analysis: ShotAnalysis | null,
  items: CorrectionSuggestion[]
): string => {
  if (!analysis) {
    return ''
  }

  if (!items.length) {
    return '当前姿态没有明显的高风险问题，建议继续结合视频节奏、出手时机和连续动作去观察稳定性。'
  }

  const focus = items
    .slice(0, 2)
    .map(item => item.bodyPart)
    .join('、')

  return `从当前姿态看，主要需要优先关注 ${focus} 的发力与稳定性。建议先用本地规则明确训练重点，再按需生成 AI 建议做更细的动作解释。`
}

const clearRetryCooldown = () => {
  if (retryCooldownTimer !== null) {
    window.clearInterval(retryCooldownTimer)
    retryCooldownTimer = null
  }

  retryCooldownSeconds.value = 0
}

const startRetryCooldown = (message: string) => {
  clearRetryCooldown()

  const seconds = getRetryCooldownSeconds(message)
  if (seconds <= 0) {
    return
  }

  retryCooldownSeconds.value = seconds
  retryCooldownTimer = window.setInterval(() => {
    if (retryCooldownSeconds.value <= 1) {
      clearRetryCooldown()
      return
    }

    retryCooldownSeconds.value -= 1
  }, 1000)
}

const syncCachedSuggestions = () => {
  suggestions.value = analysisStore.currentAiCoachingSuggestions
  summary.value = analysisStore.currentAiCoachingSummary
}

const loadRuleSuggestions = async () => {
  suggestions.value = await invoke<CorrectionSuggestion[]>('get_correction_suggestions', {
    analysis: props.analysis
  })
  summary.value = buildFallbackSummary(props.analysis, suggestions.value)
  analysisStore.setAiCoachingCache('', [], 'rules')
}

const loadSuggestions = async () => {
  if (!props.analysis) {
    suggestions.value = []
    summary.value = ''
    aiError.value = ''
    successMessage.value = ''
    analysisStore.clearAiCoachingCache()
    clearRetryCooldown()
    return
  }

  if (hasCachedAiSuggestions.value) {
    syncCachedSuggestions()
    aiError.value = ''
    successMessage.value = ''
    clearRetryCooldown()
    return
  }

  successMessage.value = ''
  await loadRuleSuggestions()
}

const generateAiSuggestions = async () => {
  if (!props.analysis || loading.value || (retryCooldownSeconds.value > 0 && canRetryAi.value)) {
    return
  }

  loading.value = true
  aiError.value = ''
  successMessage.value = ''

  try {
    const imageData = await resolveAiImageSource(analysisStore.currentImage || null)
    const annotatedImageData = await resolveAiImageSource(analysisStore.currentAnnotatedImage || null)
    const response = await invoke<AiCoachingResponse>('get_ai_correction_suggestions', {
      analysis: props.analysis,
      imageData,
      annotatedImageData
    })

    analysisStore.setAiCoachingCache(response.summary, response.suggestions, 'ai')
    syncCachedSuggestions()

    if (analysisStore.currentHistoryId) {
      await analysisStore.updateHistoryAiCoaching(
        analysisStore.currentHistoryId,
        response.summary,
        response.suggestions
      )
    }

    successMessage.value = analysisStore.currentHistoryId
      ? 'AI 建议已重新生成，并已保存到这条历史记录。'
      : 'AI 建议已重新生成。'
    clearRetryCooldown()
  } catch (error) {
    successMessage.value = ''
    aiError.value = error instanceof Error ? error.message : String(error)
    startRetryCooldown(aiError.value)
    console.warn('AI suggestions unavailable, falling back to local rules:', error)
    await loadRuleSuggestions()
  } finally {
    loading.value = false
  }
}

watch(() => props.analysis, () => {
  void loadSuggestions()
})

onMounted(() => {
  void loadSuggestions()
})
onBeforeUnmount(clearRetryCooldown)
</script>

<style scoped>
.suggestion-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-action-button {
  min-width: 128px;
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03)),
    var(--glass-md);
  border-color: color-mix(in srgb, var(--primary-color) 24%, var(--surface-border));
  color: var(--text-primary);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.ai-action-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--primary-color) 42%, var(--surface-border));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05)),
    var(--glass-lg);
  box-shadow:
    0 14px 28px rgba(79, 70, 229, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.ai-action-button:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow:
    0 8px 18px rgba(79, 70, 229, 0.16),
    inset 0 2px 6px rgba(15, 23, 42, 0.14);
}

.ai-action-button:disabled {
  opacity: 0.72;
}

.suggestion-panel h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.success-hint {
  margin: 0 0 14px;
  color: var(--color-success);
  font-size: 13px;
  font-weight: 600;
}

.source-pill {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}

.source-ai {
  background: rgba(99, 102, 241, 0.12);
  color: var(--primary-hover);
  border-color: rgba(99, 102, 241, 0.18);
}

.source-cache {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.18);
}

.source-rules {
  background: var(--glass-sm);
  color: var(--text-secondary);
  border-color: var(--surface-border);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  color: var(--text-secondary);
  font-size: 14px;
}

.error-state {
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1px solid var(--color-danger-border);
  background: linear-gradient(135deg, var(--color-danger-bg), var(--glass-lg));
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}

.error-title {
  margin: 0 0 6px;
  color: var(--color-danger-hover);
  font-size: 13px;
  font-weight: 600;
}

.error-message {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.error-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.retry-ai-button {
  border-color: color-mix(in srgb, var(--color-danger) 34%, var(--surface-border));
  color: var(--color-danger-hover);
  background:
    linear-gradient(180deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04)),
    var(--glass-md);
}

.retry-ai-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-danger) 54%, var(--surface-border));
  background:
    linear-gradient(180deg, rgba(239, 68, 68, 0.16), rgba(239, 68, 68, 0.06)),
    var(--glass-lg);
}

.retry-hint {
  color: var(--text-secondary);
  font-size: 12px;
}

.summary-card {
  margin-bottom: 16px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.16), var(--glass-lg));
  padding: 18px 20px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: var(--shadow-sm), var(--inset-highlight);
}

.summary-label {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--primary-color);
}

.summary-text {
  margin: 0;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.8;
}

.suggestions {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow-y: auto;
}

.suggestion-card {
  border-left: 4px solid;
  background: var(--card-bg);
  border-top: 1px solid var(--surface-border);
  border-right: 1px solid var(--surface-border);
  border-bottom: 1px solid var(--surface-border);
  box-shadow: var(--shadow-sm), var(--inset-highlight);
}

.suggestion-card.priority-high {
  border-left-color: #F56C6C;
}

.suggestion-card.priority-medium {
  border-left-color: #E6A23C;
}

.suggestion-card.priority-low {
  border-left-color: #909399;
}

.suggestion-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.body-part {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
  flex: 1;
}

.suggestion-content {
  padding-left: 34px;
}

.suggestion-content p {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.issue {
  color: var(--color-warning);
}

.advice {
  color: var(--color-success);
}
</style>
