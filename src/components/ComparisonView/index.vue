<template>
  <div class="comparison-view">
    <el-empty v-if="!analysis" description="请先进行姿势分析" />

    <div v-else class="comparison-workbench">
      <el-alert
        v-if="comparisonError"
        class="comparison-alert"
        type="warning"
        :closable="false"
        show-icon
        :title="comparisonError"
      />
      <button
        v-if="comparisonError && analysis"
        type="button"
        class="comparison-retry"
        @click="void retryWorkbench()"
      >
        重新加载对比结果
      </button>

      <div v-if="isLoadingRankings" class="comparison-loading">
        <p class="comparison-loading__title">正在匹配球星模板</p>
        <p class="comparison-loading__body">优先尝试智能排序，如果超时会自动回退到本地模板对比。</p>
        <el-skeleton :rows="6" animated />
      </div>

      <el-empty v-else-if="!rankedSummaries.length" description="暂无可用球星模板" />

      <template v-else>
        <section class="comparison-ranking">
          <button
            v-for="summary in rankedSummaries"
            :key="summary.player.id"
            type="button"
            class="comparison-ranking-card"
            :class="{ 'comparison-ranking-card--active': summary.player.id === selectedPlayerId }"
            @click="void selectPlayer(summary.player.id)"
          >
            <div class="comparison-ranking-card__header">
              <div>
                <p class="comparison-ranking-card__name" data-allow-copy="true">
                  {{ summary.player.name }}
                </p>
                <p class="comparison-ranking-card__team">
                  {{ summary.player.team }}
                </p>
              </div>
              <p class="comparison-ranking-card__score">
                {{ formatPercentage(summary.similarity) }}
              </p>
            </div>

            <p class="comparison-ranking-card__reason" data-allow-copy="true">
              {{ summary.matchReason }}
            </p>

            <p
              v-if="summary.shotTypeAlignment"
              class="comparison-ranking-card__alignment"
            >
              {{ summary.shotTypeAlignment }}
            </p>
          </button>
        </section>

        <div v-if="comparisonResult" class="comparison-content">
          <div class="comparison-detail-grid">
            <el-card class="comparison-panel">
              <template #header>
                <span>相似度评分</span>
              </template>

              <div class="similarity-score">
                <el-progress
                  type="dashboard"
                  :percentage="comparisonResult.similarity * 100"
                  :color="getScoreColor(comparisonResult.similarity)"
                />
                <p class="score-value" data-allow-copy="true">
                  {{ formatPercentage(comparisonResult.similarity) }}
                </p>
                <p class="score-label">
                  <span>与你和 </span>
                  <span class="score-player" data-allow-copy="true">{{ comparisonResult.player.name }}</span>
                  <span> 的姿势相似度</span>
                </p>
              </div>
            </el-card>

            <el-card class="comparison-panel">
              <template #header>
                <span>角度对比雷达图</span>
              </template>

              <RadarChart
                :user-data="userAngles"
                :player-data="playerAngles"
                :player-name="comparisonResult.player.name"
              />
            </el-card>
          </div>

          <el-card class="difference-card">
            <template #header>
              <span>详细角度差异</span>
            </template>

            <el-table
              v-loading="isLoadingComparison"
              :data="sortedDifferences"
              style="width: 100%"
            >
              <el-table-column label="关节名称" width="170">
                <template #default="{ row }">
                  {{ getAngleDisplayName(row.name) }}
                </template>
              </el-table-column>

              <el-table-column label="你的角度" width="120">
                <template #default="{ row }">
                  <span :class="{ 'warning-value': Math.abs(row.difference) > 10 }" data-allow-copy="true">
                    {{ row.userValue.toFixed(1) }}°
                  </span>
                </template>
              </el-table-column>

              <el-table-column label="球星角度" width="120">
                <template #default="{ row }">
                  <span data-allow-copy="true">{{ row.playerValue.toFixed(1) }}°</span>
                </template>
              </el-table-column>

              <el-table-column label="差异" width="120">
                <template #default="{ row }">
                  <el-tag :type="getDifferenceTag(row.difference)">
                    <span data-allow-copy="true">
                      {{ row.difference > 0 ? '+' : '' }}{{ row.difference.toFixed(1) }}°
                    </span>
                  </el-tag>
                </template>
              </el-table-column>

              <el-table-column label="差异可视化">
                <template #default="{ row }">
                  <el-progress
                    :percentage="(Math.min(Math.abs(row.difference), 30) / 30) * 100"
                    :color="getDifferenceColor(row.difference)"
                    :show-text="false"
                  />
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card class="comparison-learning-bridge">
            <template #header>
              <span>如何向这位球星学习</span>
            </template>

            <div class="learning-bridge">
              <p class="learning-bridge__intro">
                {{ learningIntro }}
              </p>

              <ul class="learning-bridge__list">
                <li
                  v-for="gap in learningGaps"
                  :key="gap.title"
                  class="learning-bridge__item"
                >
                  <p class="learning-bridge__gap" data-allow-copy="true">
                    {{ gap.title }}
                  </p>
                  <p class="learning-bridge__detail">
                    {{ gap.detail }}
                  </p>
                </li>
              </ul>
            </div>
          </el-card>
        </div>

        <el-empty v-else description="请选择球星进行对比" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import {
  getAngleDisplayName,
  type ComparisonResult,
  type ComparisonSummary,
  type ComparisonWorkbenchResult,
  type PlayerTemplate,
  type ShotAnalysis
} from '@/types'
import { useAnalysisStore } from '@/stores/analysis'
import RadarChart from '@/components/ChartComponents/RadarChart.vue'

const props = defineProps<{
  analysis: ShotAnalysis | null
}>()

const analysisStore = useAnalysisStore()

const rankedSummaries = ref<ComparisonSummary[]>([])
const selectedPlayerId = ref<number | null>(null)
const comparisonResult = ref<ComparisonResult | null>(null)
const comparisonError = ref('')
const isLoadingRankings = ref(false)
const isLoadingComparison = ref(false)

let rankingRequestId = 0
let comparisonRequestId = 0

const selectedSummary = computed(() => {
  if (!selectedPlayerId.value) return null
  return rankedSummaries.value.find(summary => summary.player.id === selectedPlayerId.value) ?? null
})

const userAngles = computed(() => {
  if (!props.analysis) return []
  return props.analysis.angles.map(angle => angle.value)
})

const playerAngles = computed(() => {
  if (comparisonResult.value) {
    return comparisonResult.value.player.angles.map(angle => angle.value)
  }

  if (selectedSummary.value) {
    return selectedSummary.value.player.angles.map(angle => angle.value)
  }

  return []
})

const sortedDifferences = computed(() => {
  if (!comparisonResult.value) return []

  return [...comparisonResult.value.angleDifferences].sort((left, right) => {
    const distanceOrder = Math.abs(right.difference) - Math.abs(left.difference)
    if (distanceOrder !== 0) return distanceOrder
    return left.name.localeCompare(right.name)
  })
})

const learningGaps = computed(() => {
  return sortedDifferences.value.slice(0, 3).map(difference => ({
    title: `${getAngleDisplayName(difference.name)}${difference.difference > 0 ? '偏大' : '偏小'} ${Math.abs(difference.difference).toFixed(1)}°`,
    detail: gapGuidance(difference.name)
  }))
})

const learningIntro = computed(() => {
  if (!comparisonResult.value) {
    return '先选中一个最接近的模板，再从差距最大的动作环节开始收窄。'
  }

  return `先从 ${comparisonResult.value.player.name} 身上最不像的一到两个关节开始修正，再回看建议区验证动作是否更接近模板。`
})

const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`

const getScoreColor = (similarity: number) => {
  if (similarity >= 0.8) return '#67C23A'
  if (similarity >= 0.6) return '#E6A23C'
  return '#F56C6C'
}

const getDifferenceTag = (diff: number) => {
  const absDiff = Math.abs(diff)
  if (absDiff <= 5) return 'success'
  if (absDiff <= 10) return 'warning'
  return 'danger'
}

const getDifferenceColor = (diff: number) => {
  const absDiff = Math.abs(diff)
  if (absDiff <= 5) return '#67C23A'
  if (absDiff <= 10) return '#E6A23C'
  return '#F56C6C'
}

const gapGuidance = (name: string) => {
  if (name.includes('elbow') || name.includes('release') || name.includes('shoulder')) {
    return '优先对齐出手肘部和抬手线路，让出手轨迹先稳定下来。'
  }

  if (name.includes('knee') || name.includes('hip')) {
    return '先调下肢加载深度和蹬伸节奏，让力量链条更接近模板。'
  }

  if (name.includes('tilt')) {
    return '收紧肩线和躯干的稳定性，减少额外的前倾或侧倾补偿。'
  }

  return '先把这个角度拉回模板附近，再观察整体节奏是否一起改善。'
}

const sortDifferencesByGap = (differences: ComparisonResult['angleDifferences']) => {
  return [...differences].sort((left, right) => {
    const distanceOrder = Math.abs(right.difference) - Math.abs(left.difference)
    if (distanceOrder !== 0) return distanceOrder
    return left.name.localeCompare(right.name)
  })
}

const buildFallbackMatchReason = (result: ComparisonResult) => {
  const closestAngles = [...result.angleDifferences]
    .sort((left, right) => {
      const distanceOrder = Math.abs(left.difference) - Math.abs(right.difference)
      if (distanceOrder !== 0) return distanceOrder
      return left.name.localeCompare(right.name)
    })
    .slice(0, 2)
    .map(difference => getAngleDisplayName(difference.name))

  if (!closestAngles.length) {
    return `${result.player.name} 是当前最接近的模板。`
  }

  return `${result.player.name} 在 ${closestAngles.join('、')} 上与你更接近。`
}

const buildFallbackSummary = (result: ComparisonResult): ComparisonSummary => ({
  player: result.player,
  similarity: result.similarity,
  topDifferences: sortDifferencesByGap(result.angleDifferences).slice(0, 3),
  matchReason: buildFallbackMatchReason(result),
  shotTypeAlignment: null
})

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) => {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

const applyWorkbenchSelection = async (
  summaries: ComparisonSummary[],
  candidateComparisons: ComparisonResult[]
) => {
  rankedSummaries.value = summaries

  const restoredComparison = analysisStore.currentComparison
  const matchingRestoredComparison =
    restoredComparison &&
    summaries.some(summary => summary.player.id === restoredComparison.player.id)
      ? restoredComparison
      : null

  const selectedComparison =
    matchingRestoredComparison ??
    candidateComparisons.find(result => result.player.id === summaries[0]?.player.id) ??
    null

  selectedPlayerId.value = selectedComparison?.player.id ?? summaries[0]?.player.id ?? null

  if (selectedComparison) {
    comparisonResult.value = selectedComparison
    analysisStore.setCurrentComparison(selectedComparison)
    return
  }

  if (selectedPlayerId.value) {
    await loadComparison(selectedPlayerId.value, false)
    return
  }

  comparisonResult.value = null
  analysisStore.setCurrentComparison(null)
}

const cacheComparison = async (
  result: ComparisonResult | null,
  persistHistory: boolean
) => {
  comparisonResult.value = result
  analysisStore.setCurrentComparison(result)

  if (!persistHistory || !analysisStore.currentHistoryId || !result) {
    return
  }

  try {
    await analysisStore.updateHistoryComparison(analysisStore.currentHistoryId, result)
  } catch (error) {
    console.warn('Failed to update comparison history:', error)
  }
}

const loadComparison = async (playerId: number, persistHistory = true) => {
  if (!props.analysis) return

  const requestId = ++comparisonRequestId
  isLoadingComparison.value = true
  comparisonError.value = ''

  try {
    const result = await invoke<ComparisonResult>('compare_with_player', {
      analysis: props.analysis,
      playerId
    })

    if (requestId !== comparisonRequestId) {
      return
    }

    selectedPlayerId.value = playerId
    await cacheComparison(result, persistHistory)
  } catch (error) {
    if (requestId !== comparisonRequestId) {
      return
    }

    comparisonError.value = '球星对比详情加载失败，请重试。'
    console.warn('Failed to load comparison detail:', error)
  } finally {
    if (requestId === comparisonRequestId) {
      isLoadingComparison.value = false
    }
  }
}

const loadFallbackWorkbench = async (
  analysis: ShotAnalysis,
  requestId: number
) => {
  const players = await invoke<PlayerTemplate[]>('get_player_templates')

  if (requestId !== rankingRequestId || !players.length) {
    return false
  }

  const settledFallbackResults = await Promise.allSettled(
    players.map(player =>
      withTimeout(
        invoke<ComparisonResult>('compare_with_player', {
          analysis,
          playerId: player.id
        }),
        1600,
        `compare_with_player(${player.id}) timed out`
      )
    )
  )

  if (requestId !== rankingRequestId || !settledFallbackResults.length) {
    return false
  }

  const fallbackResults = settledFallbackResults
    .filter((result): result is PromiseFulfilledResult<ComparisonResult> => result.status === 'fulfilled')
    .map(result => result.value)

  if (!fallbackResults.length) {
    return false
  }

  const fallbackSummaries = fallbackResults
    .map(buildFallbackSummary)
    .sort((left, right) => right.similarity - left.similarity)

  const sortedResults = [...fallbackResults].sort((left, right) => right.similarity - left.similarity)
  await applyWorkbenchSelection(fallbackSummaries, sortedResults)
  return true
}

const selectPlayer = async (playerId: number) => {
  if (selectedPlayerId.value === playerId && comparisonResult.value?.player.id === playerId) {
    return
  }

  selectedPlayerId.value = playerId
  await loadComparison(playerId)
}

const loadWorkbench = async (analysis: ShotAnalysis | null) => {
  const requestId = ++rankingRequestId

  if (!analysis) {
    rankedSummaries.value = []
    selectedPlayerId.value = null
    comparisonError.value = ''
    comparisonResult.value = null
    analysisStore.setCurrentComparison(null)
    return
  }

  isLoadingRankings.value = true
  comparisonError.value = ''

  try {
    const workbench = await withTimeout(
      invoke<ComparisonWorkbenchResult>('compare_against_all_players', {
        analysis
      }),
      1800,
      'compare_against_all_players timed out'
    )

    if (requestId !== rankingRequestId) {
      return
    }

    await applyWorkbenchSelection(
      workbench.summaries ?? [],
      workbench.selectedComparison ? [workbench.selectedComparison] : []
    )
  } catch (error) {
    if (requestId !== rankingRequestId) {
      return
    }

    try {
      const loadedFallback = await loadFallbackWorkbench(analysis, requestId)
      if (loadedFallback) {
        comparisonError.value = '智能排序暂不可用，已切换到本地模板对比。你可以重试智能排序。'
        return
      }
    } catch (fallbackError) {
      console.warn('Failed to load comparison fallback:', fallbackError)
    }

    rankedSummaries.value = []
    selectedPlayerId.value = null
    comparisonResult.value = null
    analysisStore.setCurrentComparison(null)
    comparisonError.value = '球星模板加载失败，请稍后重试。'
    console.warn('Failed to load comparison workbench:', error)
  } finally {
    if (requestId === rankingRequestId) {
      isLoadingRankings.value = false
    }
  }
}

const retryWorkbench = async () => {
  comparisonError.value = ''
  await loadWorkbench(props.analysis)
}

watch(
  () => props.analysis,
  analysis => {
    void loadWorkbench(analysis)
  },
  { immediate: true }
)
</script>

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

.comparison-alert {
  margin-bottom: 4px;
}

.comparison-retry {
  align-self: flex-start;
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  padding: 8px 14px;
  background: var(--glass-xs);
  color: var(--text-primary);
  cursor: pointer;
}

.comparison-retry:hover {
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--surface-border));
}

.comparison-loading {
  padding: 20px;
  border-radius: 24px;
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
}

.comparison-loading__title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.comparison-loading__body {
  margin: 0 0 16px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.comparison-ranking {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.comparison-ranking-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--surface-border);
  border-radius: 22px;
  background: var(--glass-xs);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.comparison-ranking-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--primary-color) 24%, var(--surface-border));
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.14);
}

.comparison-ranking-card--active {
  border-color: color-mix(in srgb, var(--accent-color) 34%, var(--surface-border));
  background: color-mix(in srgb, var(--accent-color) 8%, var(--glass-sm));
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
}

.comparison-ranking-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.comparison-ranking-card__name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.comparison-ranking-card__team,
.comparison-ranking-card__alignment {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.comparison-ranking-card__score {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.comparison-ranking-card__reason {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.comparison-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comparison-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.comparison-panel,
.difference-card,
.comparison-learning-bridge {
  border-color: var(--surface-border);
  background: color-mix(in srgb, var(--glass-sm) 96%, var(--background));
}

.similarity-score {
  text-align: center;
  padding: 20px;
}

.score-label {
  margin-top: 15px;
  color: var(--text-secondary);
}

.score-value {
  margin-top: 12px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.learning-bridge {
  display: grid;
  gap: 16px;
}

.learning-bridge__intro {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.learning-bridge__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.learning-bridge__item {
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 88%, transparent);
  background: color-mix(in srgb, var(--glass-xs) 96%, var(--background));
}

.learning-bridge__gap {
  margin: 0 0 6px;
  font-weight: 700;
  color: var(--text-primary);
}

.learning-bridge__detail {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.warning-value {
  color: #E6A23C;
  font-weight: 600;
}

@media (max-width: 900px) {
  .comparison-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
