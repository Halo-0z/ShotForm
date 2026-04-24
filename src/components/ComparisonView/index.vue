<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import ComparisonDetailPane from './ComparisonDetailPane.vue'
import ComparisonProgress from './ComparisonProgress.vue'
import ComparisonRankingList from './ComparisonRankingList.vue'
import {
  configureComparisonStoreService,
  useComparisonStore
} from '@/stores/comparison'
import type { ComparisonIdentity } from '@/lib/comparison-service'
import {
  createComparisonPreviewService,
  isComparisonPreviewMode
} from '@/lib/comparison-preview'
import type { PlayerTemplateProfile, ShotAnalysis } from '@/types'

if (isComparisonPreviewMode()) {
  configureComparisonStoreService(() => createComparisonPreviewService())
}

const props = withDefaults(defineProps<{
  analysis: ShotAnalysis | null
  analysisProfile?: PlayerTemplateProfile | null
  identity: ComparisonIdentity | null
  surfaceId: string
  active?: boolean
}>(), {
  active: true,
  analysisProfile: null
})

const router = useRouter()
const comparisonStore = useComparisonStore()

const status = computed(() => comparisonStore.status)
const closestSummary = computed(() => comparisonStore.rankedSummaries[0] ?? null)
const selectedPlayerName = computed(() => comparisonStore.selectedDetail?.result.player.name ?? '')
const isWorking = computed(() => {
  return [
    'preparing',
    'loading_templates',
    'validating_templates',
    'ranking_players',
    'building_default_detail'
  ].includes(status.value)
})
const hasRankings = computed(() => comparisonStore.rankedSummaries.length > 0)
const showProgress = computed(() => isWorking.value || status.value === 'error')
const canRefreshWorkbench = computed(() => {
  return Boolean(props.active && props.analysis && props.identity && !isWorking.value)
})
const toolbarMessage = computed(() => {
  if (isWorking.value) {
    return '正在按真实阶段构建球星对比，不再使用假等待计时。'
  }

  if (status.value === 'ready' && comparisonStore.selectedDetail) {
    const closestPlayerName = closestSummary.value?.player.name ?? selectedPlayerName.value

    if (!closestPlayerName) {
      return '球星对比已准备完成，可切换其他球星查看完整详情。'
    }

    if (!selectedPlayerName.value || selectedPlayerName.value === closestPlayerName) {
      return `${closestPlayerName} 是当前最接近的模板，可切换其他球星查看完整详情。`
    }

    return `当前最接近的模板是 ${closestPlayerName}，你正在查看 ${selectedPlayerName.value} 的完整详情。`
  }

  if (status.value === 'empty') {
    return '当前没有可用球星模板，请先进入模板管理导入或保存模板。'
  }

  if (status.value === 'error') {
    return comparisonStore.errorMessage || '球星对比加载失败，请重试。'
  }

  return '导入球星模板后，这里会自动给出最接近的动作对比结果。'
})

const openTemplateManager = () => {
  router.push('/templates')
}

const refreshWorkbench = () => {
  if (!canRefreshWorkbench.value) {
    return
  }

  void comparisonStore.refreshWorkbench()
}

const ensureWorkbench = () => {
  if (!props.active || !props.analysis || !props.identity) {
    comparisonStore.releaseSurface(props.surfaceId)
    return
  }

  void comparisonStore.ensureWorkbench({
    surfaceId: props.surfaceId,
    identity: props.identity,
    analysis: props.analysis,
    analysisProfile: props.analysisProfile
  })
}

watch(
  () => [
    props.active,
    props.analysis,
    props.identity?.analysisKey,
    props.identity?.source,
    props.identity?.sessionId,
    props.identity?.videoPath,
    props.identity?.frameIndex,
    props.identity?.historyId,
    props.identity?.profileKey,
    props.analysisProfile?.samplesUsed,
    props.analysisProfile?.coverage,
    props.analysisProfile?.representativeTimestampMs
  ],
  ensureWorkbench,
  { immediate: true }
)

onBeforeUnmount(() => {
  comparisonStore.releaseSurface(props.surfaceId)
})
</script>

<template>
  <div class="comparison-view">
    <div v-if="!analysis" class="comparison-no-analysis" data-compare-no-analysis>
      <p class="comparison-no-analysis__title">请先进行姿势分析</p>
      <p class="comparison-no-analysis__body">完成一次投篮动作分析后，这里会显示可对比的球星模板。</p>
    </div>

    <div v-else class="comparison-workbench">
      <div class="comparison-toolbar">
        <div class="comparison-toolbar__copy">
          <p class="comparison-toolbar__title">球星模板</p>
          <p class="comparison-toolbar__body" data-compare-toolbar-body>{{ toolbarMessage }}</p>
        </div>
        <div class="comparison-toolbar__actions">
          <button
            type="button"
            class="comparison-toolbar__action comparison-toolbar__refresh"
            :disabled="!canRefreshWorkbench"
            title="重新读取最新模板并重建当前分析的球星对比"
            aria-label="刷新对比，重新读取最新模板"
            @click="refreshWorkbench"
          >
            刷新对比
          </button>
          <button
            type="button"
            class="comparison-toolbar__action"
            @click="openTemplateManager"
          >
            管理模板
          </button>
        </div>
      </div>

      <ComparisonProgress
        v-if="showProgress"
        :status="comparisonStore.status"
        :progress="comparisonStore.progress"
        :error-message="comparisonStore.errorMessage"
        :can-retry="comparisonStore.canRetry"
        @retry="void comparisonStore.retry()"
      />

      <div v-if="isWorking && !hasRankings" class="comparison-loading-shell" aria-label="正在构建球星对比">
        <span
          v-for="line in 6"
          :key="line"
          class="comparison-loading-shell__line"
        />
      </div>

      <div v-else-if="status === 'empty'" class="comparison-empty" data-compare-empty>
        <p class="comparison-empty__title">暂无球星模板</p>
        <p class="comparison-empty__body">先保存或导入模板后，再回到这里进行对比。</p>
        <button type="button" class="comparison-empty__action" @click="openTemplateManager">
          去管理模板
        </button>
      </div>

      <div v-else-if="status === 'error'" class="comparison-error" data-compare-error>
        <p class="comparison-error__title">球星对比加载失败</p>
        <p class="comparison-error__body">{{ comparisonStore.errorMessage }}</p>
      </div>

      <template v-else-if="hasRankings">
        <ComparisonRankingList
          :summaries="comparisonStore.rankedSummaries"
          :selected-player-id="comparisonStore.selectedPlayerId"
          @select="playerId => void comparisonStore.selectPlayer(playerId)"
        />

        <ComparisonDetailPane
          :analysis="analysis"
          :detail="comparisonStore.selectedDetail"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.comparison-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comparison-workbench {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comparison-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--surface-border);
  border-radius: 22px;
  background: color-mix(in srgb, var(--glass-xs) 94%, var(--background));
}

.comparison-toolbar__copy {
  display: grid;
  gap: 4px;
}

.comparison-toolbar__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.comparison-toolbar__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.comparison-toolbar__body {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.comparison-toolbar__action,
.comparison-empty__action {
  flex: 0 0 auto;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  padding: 8px 14px;
  background: var(--glass-xs);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 180ms ease, background 180ms ease, opacity 180ms ease;
}

.comparison-toolbar__action:hover,
.comparison-empty__action:hover {
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--surface-border));
}

.comparison-toolbar__action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.comparison-toolbar__refresh {
  border-color: color-mix(in srgb, var(--primary-color) 38%, var(--surface-border));
  background: color-mix(in srgb, var(--primary-color) 10%, var(--glass-xs));
}

.comparison-no-analysis,
.comparison-loading-shell,
.comparison-empty,
.comparison-error {
  padding: 20px;
  border-radius: 24px;
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
}

.comparison-no-analysis {
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
}

.comparison-no-analysis__title {
  margin: 0;
  color: var(--text-primary);
  font-weight: 750;
}

.comparison-no-analysis__body {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.comparison-loading-shell {
  display: grid;
  gap: 12px;
}

.comparison-loading-shell__line {
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--surface-border) 46%, transparent),
      color-mix(in srgb, var(--primary-color) 12%, transparent),
      color-mix(in srgb, var(--surface-border) 46%, transparent)
    );
  background-size: 220% 100%;
  animation: comparison-skeleton 1.2s ease-in-out infinite;
}

.comparison-loading-shell__line:nth-child(2),
.comparison-loading-shell__line:nth-child(5) {
  width: 82%;
}

.comparison-loading-shell__line:nth-child(3),
.comparison-loading-shell__line:nth-child(6) {
  width: 64%;
}

.comparison-empty,
.comparison-error {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.comparison-empty__title,
.comparison-error__title {
  margin: 0;
  color: var(--text-primary);
  font-weight: 750;
}

.comparison-empty__body,
.comparison-error__body {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.comparison-error {
  border-color: color-mix(in srgb, #f56c6c 34%, var(--surface-border));
}

@media (max-width: 640px) {
  .comparison-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .comparison-toolbar__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .comparison-toolbar__action {
    width: 100%;
  }
}

@keyframes comparison-skeleton {
  from {
    background-position: 110% 0;
  }

  to {
    background-position: -110% 0;
  }
}
</style>
