<script setup lang="ts">
import { computed } from 'vue'
import type { ComparisonProgressState, ComparisonSessionStatus } from '@/lib/comparison-session.js'

const props = defineProps<{
  status: ComparisonSessionStatus
  progress: ComparisonProgressState
  errorMessage?: string
  canRetry?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const progressValue = computed(() => Math.round(props.progress.percent || 0))
const stageLabel = computed(() => {
  if (props.status === 'error') {
    return props.errorMessage || props.progress.message || '球星对比加载失败'
  }

  return props.progress.message || '正在准备球星对比'
})
</script>

<template>
  <section
    class="comparison-progress"
    :class="{ 'comparison-progress--error': status === 'error' }"
    data-compare-progress
  >
    <div class="comparison-progress__copy">
      <p class="comparison-progress__eyebrow">对比进度</p>
      <p class="comparison-progress__stage" data-compare-stage>{{ stageLabel }}</p>
    </div>

    <div class="comparison-progress__meter">
      <div
        class="comparison-progress__track"
        role="progressbar"
        aria-label="球星对比进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="progressValue"
      >
        <span
          class="comparison-progress__bar"
          :style="{ width: `${progressValue}%` }"
        />
      </div>
      <span class="comparison-progress__value">{{ progressValue }}%</span>
    </div>

    <button
      v-if="status === 'error' && canRetry"
      type="button"
      class="comparison-progress__retry"
      @click="emit('retry')"
    >
      重新加载
    </button>
  </section>
</template>

<style scoped>
.comparison-progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 280px) auto;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--surface-border);
  border-radius: 22px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 8%, transparent), transparent 44%),
    color-mix(in srgb, var(--glass-xs) 94%, var(--background));
}

.comparison-progress--error {
  border-color: color-mix(in srgb, #f56c6c 38%, var(--surface-border));
}

.comparison-progress__copy {
  display: grid;
  gap: 4px;
}

.comparison-progress__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.comparison-progress__stage {
  margin: 0;
  color: var(--text-primary);
  font-weight: 650;
}

.comparison-progress__meter {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: center;
  gap: 10px;
}

.comparison-progress__track {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-border) 56%, transparent);
}

.comparison-progress__bar {
  display: block;
  height: 100%;
  min-width: 4px;
  border-radius: inherit;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--primary-color) 86%, white), var(--accent-color));
  box-shadow: 0 0 18px color-mix(in srgb, var(--primary-color) 28%, transparent);
  transition: width 220ms ease;
}

.comparison-progress__value {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: right;
}

.comparison-progress__retry {
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  padding: 8px 14px;
  background: var(--glass-xs);
  color: var(--text-primary);
  cursor: pointer;
}

@media (max-width: 760px) {
  .comparison-progress {
    grid-template-columns: 1fr;
  }
}
</style>
