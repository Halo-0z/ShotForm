<script setup lang="ts">
import { computed } from 'vue'
import RadarChart from '@/components/ChartComponents/RadarChart.vue'
import type { RadarIndicator } from '@/components/ChartComponents/RadarChart.vue'
import { getAngleDisplayName, type ComparisonDetailPayload, type ShotAnalysis } from '@/types'

const RADAR_ANGLE_ORDER = [
  'shooting_elbow_angle',
  'release_angle',
  'right_shoulder_angle',
  'left_shoulder_angle',
  'trunk_tilt',
  'right_hip_angle',
  'left_hip_angle',
  'right_knee_angle',
  'left_knee_angle',
  'shoulder_tilt',
]

const props = defineProps<{
  detail: ComparisonDetailPayload | null
  analysis: ShotAnalysis
}>()

const result = computed(() => props.detail?.result ?? null)

const radarData = computed(() => {
  const diffs = result.value?.angleDifferences ?? []
  const indexed = new Map(diffs.map(d => [d.name, d]))
  const ordered = RADAR_ANGLE_ORDER
    .filter(name => indexed.has(name))
    .map(name => indexed.get(name)!)

  if (ordered.length === 0) return null

  const indicators: RadarIndicator[] = ordered.map(d => ({
    name: getAngleDisplayName(d.name),
    max: d.name === 'trunk_tilt' || d.name === 'shoulder_tilt' ? 90 : 180,
  }))

  return {
    indicators,
    userData: ordered.map(d => d.userValue),
    playerData: ordered.map(d => d.playerValue),
  }
})
const sortedDifferences = computed(() => {
  return [...(result.value?.angleDifferences ?? [])].sort((left, right) => {
    const distanceOrder = Math.abs(right.difference) - Math.abs(left.difference)
    if (distanceOrder !== 0) return distanceOrder
    return left.name.localeCompare(right.name)
  })
})

const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`
const getComparisonModeLabel = (mode?: 'video_level' | 'single_frame_fallback') => {
  return mode === 'video_level' ? '视频级对比' : '单帧回退'
}
const getScoreColor = (similarity: number) => {
  if (similarity >= 0.8) return '#67C23A'
  if (similarity >= 0.6) return '#E6A23C'
  return '#F56C6C'
}
const scoreRingStyle = computed(() => {
  const similarity = Math.max(0, Math.min(1, result.value?.similarity ?? 0))
  return {
    '--score-color': getScoreColor(similarity),
    '--score-value': `${similarity * 100}%`
  }
})
const getDifferenceTone = (diff: number) => {
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
const getDifferenceWidth = (diff: number) => `${(Math.min(Math.abs(diff), 30) / 30) * 100}%`
const formatSignedDegrees = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}°`
</script>

<template>
  <section v-if="result && detail" class="comparison-detail" data-compare-detail>
    <div class="comparison-detail__grid">
      <article class="comparison-panel">
        <header class="comparison-panel__header">
          <span>相似度评分</span>
          <span class="comparison-panel__mode">
            {{ getComparisonModeLabel(result.comparisonMode) }}
          </span>
        </header>

        <div class="similarity-score">
          <div
            class="score-ring"
            :style="scoreRingStyle"
            role="img"
            :aria-label="`动作相似度 ${formatPercentage(result.similarity)}`"
          >
            <div class="score-ring__inner">
              <p class="score-value" data-allow-copy="true">
                {{ formatPercentage(result.similarity) }}
              </p>
              <p class="score-ring__caption">匹配度</p>
            </div>
          </div>
          <p class="score-label">
            <span>你与 </span>
            <span class="score-player" data-allow-copy="true" data-compare-detail-player>
              {{ result.player.name }}
            </span>
            <span> 的动作相似度</span>
          </p>
        </div>
      </article>

      <article class="comparison-panel">
        <header class="comparison-panel__header">
          <span>角度对比雷达图</span>
        </header>

        <RadarChart
          v-if="radarData"
          :user-data="radarData.userData"
          :player-data="radarData.playerData"
          :player-name="result.player.name"
          :indicators="radarData.indicators"
        />
      </article>
    </div>

    <article class="difference-card">
      <header class="comparison-panel__header">
        <span>详细角度差异</span>
      </header>

      <div class="difference-table" role="table" aria-label="详细角度差异">
        <div class="difference-table__header" role="row">
          <span role="columnheader">关节名称</span>
          <span role="columnheader">你的角度</span>
          <span role="columnheader">球星角度</span>
          <span role="columnheader">差异</span>
          <span role="columnheader">差异可视化</span>
        </div>

        <div
          v-for="row in sortedDifferences"
          :key="row.name"
          class="difference-table__row"
          role="row"
        >
          <span class="difference-table__name" role="cell">
            {{ getAngleDisplayName(row.name) }}
          </span>
          <span
            role="cell"
            :class="{ 'warning-value': Math.abs(row.difference) > 10 }"
            data-allow-copy="true"
          >
            {{ row.userValue.toFixed(1) }}°
          </span>
          <span role="cell" data-allow-copy="true">{{ row.playerValue.toFixed(1) }}°</span>
          <span role="cell">
            <span
              class="difference-pill"
              :class="`difference-pill--${getDifferenceTone(row.difference)}`"
              data-allow-copy="true"
            >
              {{ formatSignedDegrees(row.difference) }}
            </span>
          </span>
          <span role="cell">
            <span class="difference-bar" aria-hidden="true">
              <span
                class="difference-bar__fill"
                :style="{
                  width: getDifferenceWidth(row.difference),
                  background: getDifferenceColor(row.difference)
                }"
              />
            </span>
          </span>
        </div>
      </div>
    </article>

    <article class="comparison-learning-bridge">
      <header class="comparison-panel__header">
        <span>如何向这位球星学习</span>
      </header>

      <div class="learning-bridge">
        <p class="learning-bridge__intro">
          {{ detail.learningBridge.intro }}
        </p>

        <ul class="learning-bridge__list">
          <li
            v-for="gap in detail.learningBridge.gaps"
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
    </article>
  </section>
</template>

<style scoped>
.comparison-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.comparison-detail__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.comparison-panel,
.difference-card,
.comparison-learning-bridge {
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 24px;
  background: color-mix(in srgb, var(--glass-sm) 96%, var(--background));
}

.comparison-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--surface-border) 82%, transparent);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 750;
}

.comparison-panel__mode {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent-color) 12%, transparent);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.similarity-score {
  display: grid;
  justify-items: center;
  text-align: center;
  padding: 22px 20px 24px;
}

.score-ring {
  width: 150px;
  height: 150px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, var(--background) 0 57%, transparent 58%),
    conic-gradient(var(--score-color) var(--score-value), color-mix(in srgb, var(--surface-border) 62%, transparent) 0);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--surface-border) 54%, transparent);
}

.score-ring__inner {
  width: 104px;
  height: 104px;
  display: grid;
  place-items: center;
  align-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--glass-sm) 96%, var(--background));
}

.score-ring__caption {
  margin: 2px 0 0;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.score-label {
  margin: 14px 0 0;
  color: var(--text-secondary);
}

.score-value {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.difference-table {
  display: grid;
  padding: 6px;
}

.difference-table__header,
.difference-table__row {
  display: grid;
  grid-template-columns: minmax(130px, 1.3fr) minmax(90px, 0.75fr) minmax(90px, 0.75fr) minmax(82px, 0.6fr) minmax(140px, 1fr);
  align-items: center;
  gap: 12px;
}

.difference-table__header {
  padding: 10px 14px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.difference-table__row {
  min-height: 52px;
  padding: 10px 14px;
  border-top: 1px solid color-mix(in srgb, var(--surface-border) 70%, transparent);
  color: var(--text-secondary);
}

.difference-table__name {
  color: var(--text-primary);
  font-weight: 600;
}

.difference-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 750;
}

.difference-pill--success {
  background: color-mix(in srgb, #67c23a 16%, transparent);
  color: #67c23a;
}

.difference-pill--warning {
  background: color-mix(in srgb, #e6a23c 16%, transparent);
  color: #e6a23c;
}

.difference-pill--danger {
  background: color-mix(in srgb, #f56c6c 16%, transparent);
  color: #f56c6c;
}

.difference-bar {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-border) 52%, transparent);
}

.difference-bar__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 220ms ease;
}

.learning-bridge {
  display: grid;
  gap: 16px;
  padding: 18px;
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
  .comparison-detail__grid {
    grid-template-columns: 1fr;
  }

  .difference-table__header {
    display: none;
  }

  .difference-table__row {
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
  }

  .difference-table__row > span:first-child {
    grid-column: 1 / -1;
  }
}
</style>
