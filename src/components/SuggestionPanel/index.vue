<template>
  <div class="suggestion-panel">
    <div class="panel-header">
      <h3>姿势纠正建议</h3>
      <div v-if="analysis" class="panel-actions">
        <el-button size="small" plain :loading="loading" @click="generateAiSuggestions">
          {{ actionLabel }}
        </el-button>
        <span class="source-pill" :class="sourceClass">
          {{ sourceLabel }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      正在生成建议...
    </div>

    <div v-else-if="aiError" class="error-state">
      <p class="error-title">AI 建议暂时不可用，已回退到本地规则。</p>
      <p class="error-message">{{ aiError }}</p>
      <div v-if="canRetryAi" class="error-actions">
        <el-button
          type="danger"
          plain
          size="small"
          :disabled="retryCooldownSeconds > 0 || loading"
          @click="generateAiSuggestions"
        >
          {{ retryButtonLabel }}
        </el-button>
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
        :key="index"
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
            问题: {{ suggestion.issue }}
          </p>
          <p class="advice">
            <el-icon><CircleCheck /></el-icon>
            建议: {{ suggestion.suggestion }}
          </p>
        </div>
      </el-card>
    </div>

    <el-empty
      v-else-if="!loading && !analysis"
      description="请先进行姿势分析"
    />
    <el-result
      v-else-if="!loading && !suggestions.length"
      icon="success"
      title="姿势整体较好"
      sub-title="当前没有发现需要优先纠正的明显问题。"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type {
  AiCoachingResponse,
  CorrectionSuggestion,
  ShotAnalysis
} from '@/types'
import { useAnalysisStore } from '@/stores/analysis'
import { getRetryCooldownSeconds, isRetryableAiError } from '@/lib/ai-retry-policy.js'

const props = defineProps<{
  analysis: ShotAnalysis | null
}>()

const analysisStore = useAnalysisStore()
const suggestions = ref<CorrectionSuggestion[]>([])
const summary = ref('')
const loading = ref(false)
const aiError = ref('')
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

const canRetryAi = computed(() => {
  return isRetryableAiError(aiError.value)
})

const actionLabel = computed(() => {
  if (loading.value) {
    return '生成中...'
  }

  return hasCachedAiSuggestions.value ? '重新生成 AI 建议' : '生成 AI 建议'
})

const retryButtonLabel = computed(() => {
  if (loading.value) {
    return '正在重试...'
  }

  if (retryCooldownSeconds.value > 0) {
    return '稍后再试'
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
  const icons: Record<string, string> = {
    high: 'WarningFilled',
    medium: 'Warning',
    low: 'InfoFilled'
  }
  return icons[priority] || 'InfoFilled'
}

const getPriorityTag = (priority: string) => {
  const tags: Record<string, string> = {
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
    return '这次动作里没有看到特别突出的单点问题，先保持当前出手节奏，再结合连续动作去看稳定性。'
  }

  const focus = items
    .slice(0, 2)
    .map(item => item.bodyPart)
    .join('、')

  return `这次最值得先收的是 ${focus} 的配合。先把动作顺下来，再去抠更多细节，会比直接追角度数字更有效。`
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
    analysisStore.clearAiCoachingCache()
    clearRetryCooldown()
    return
  }

  if (hasCachedAiSuggestions.value) {
    syncCachedSuggestions()
    aiError.value = ''
    clearRetryCooldown()
    return
  }

  await loadRuleSuggestions()
}

const generateAiSuggestions = async () => {
  if (!props.analysis || loading.value || (retryCooldownSeconds.value > 0 && canRetryAi.value)) {
    return
  }

  loading.value = true
  aiError.value = ''

  try {
    const response = await invoke<AiCoachingResponse>('get_ai_correction_suggestions', {
      analysis: props.analysis,
      imageData: analysisStore.currentImage || null,
      annotatedImageData: analysisStore.currentAnnotatedImage || null
    })
    analysisStore.setAiCoachingCache(response.summary, response.suggestions, 'ai')
    syncCachedSuggestions()
    clearRetryCooldown()
  } catch (error) {
    aiError.value = error instanceof Error ? error.message : String(error)
    startRetryCooldown(aiError.value)
    console.warn('AI suggestions unavailable, falling back to local rules:', error)
    await loadRuleSuggestions()
  } finally {
    loading.value = false
  }
}

watch(() => props.analysis, loadSuggestions)

onMounted(loadSuggestions)
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

.suggestion-panel h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
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
