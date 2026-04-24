<script setup lang="ts">
import type { ComparisonSummary } from '@/types'

defineProps<{
  summaries: ComparisonSummary[]
  selectedPlayerId?: number | null
}>()

const emit = defineEmits<{
  select: [playerId: number]
}>()

const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`
const getComparisonModeLabel = (mode: ComparisonSummary['comparisonMode']) => {
  return mode === 'video_level' ? '视频级对比' : '单帧回退'
}

const translateLegacyShotType = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'one-motion') return '一段式'
  if (normalized === 'one-point-five-motion') return '一点五段式'
  if (normalized === 'two-motion') return '二段式'
  return value
}

const translateLegacyAngleLabel = (value: string) => {
  const normalized = value.trim().toLowerCase()
  const labels: Record<string, string> = {
    'elbow angle': '出手肘角',
    'shoulder and release line': '肩部与出手线路',
    'knee load': '膝部蓄力',
    'hip stack': '髋部支撑',
    'trunk tilt': '躯干倾角',
    'shoulder tilt': '肩线倾角'
  }

  return labels[normalized] ?? value
}

const translateLegacyJoinedLabels = (value: string) => {
  const knownLabels = [
    'shoulder and release line',
    'elbow angle',
    'knee load',
    'hip stack',
    'trunk tilt',
    'shoulder tilt'
  ]
  let remaining = value.trim().toLowerCase()
  const translated: string[] = []

  while (remaining) {
    const matchedLabel = knownLabels.find(label => remaining.startsWith(label))
    if (!matchedLabel) {
      translated.push(translateLegacyAngleLabel(remaining))
      break
    }

    translated.push(translateLegacyAngleLabel(matchedLabel))
    remaining = remaining.slice(matchedLabel.length).replace(/^(\s*,?\s*and\s*|\s*,\s*)/, '')
  }

  return translated.filter(Boolean).join('和')
}

const translateLegacyReasonPart = (part: string) => {
  const shotTypeMatch = part.match(/^shot type aligns with a (.+) profile$/)
  if (shotTypeMatch) {
    return `投篮类型与${translateLegacyShotType(shotTypeMatch[1])}模板一致`
  }

  const crossTypeMatch = part.match(/^mechanics still translate across (.+) and (.+) shot shapes$/)
  if (crossTypeMatch) {
    return `${translateLegacyShotType(crossTypeMatch[1])}和${translateLegacyShotType(crossTypeMatch[2])}虽然投篮分型不同，但关键动作仍有可迁移的相似点`
  }

  const overlapMatch = part.match(/^closest mechanical overlap at (.+)$/)
  if (overlapMatch) {
    return `最接近的动作重合点在${translateLegacyJoinedLabels(overlapMatch[1])}`
  }

  const loadingMatch = part.match(/^loading stays controlled through (.+)$/)
  if (loadingMatch) {
    return `${translateLegacyAngleLabel(loadingMatch[1])}的发力控制比较接近`
  }

  return part
}

const translateMatchReason = (reason: string) => {
  const closestMatch = reason.match(/^(.+?) is the closest weighted mechanics match\.$/)
  if (closestMatch) {
    return `${closestMatch[1]} 是当前加权动作特征最接近的模板。`
  }

  const rankedMatch = reason.match(/^(.+?) ranks highly because (.+)\.$/)
  if (!rankedMatch) {
    return reason
  }

  const translatedParts = rankedMatch[2]
    .split(/,\s+(?=(?:shot type|mechanics still|closest mechanical|loading stays))/)
    .map(part => translateLegacyReasonPart(part))

  return `${rankedMatch[1]} 排名靠前，因为${translatedParts.join('，')}。`
}
</script>

<template>
  <section class="comparison-ranking" data-compare-ranking>
    <button
      v-for="summary in summaries"
      :key="summary.player.id"
      type="button"
      class="comparison-ranking-card"
      :class="{ 'comparison-ranking-card--active': summary.player.id === selectedPlayerId }"
      :data-compare-card="summary.player.id"
      @click="emit('select', summary.player.id)"
    >
      <div class="comparison-ranking-card__header">
        <div>
          <p class="comparison-ranking-card__name" data-allow-copy="true">
            {{ summary.player.name }}
          </p>
          <p class="comparison-ranking-card__team">{{ summary.player.team }}</p>
        </div>
        <div class="comparison-ranking-card__score-wrap">
          <p class="comparison-ranking-card__score">{{ formatPercentage(summary.similarity) }}</p>
          <span class="comparison-ranking-card__mode">
            {{ getComparisonModeLabel(summary.comparisonMode) }}
          </span>
        </div>
      </div>

      <p class="comparison-ranking-card__reason" data-allow-copy="true">
        {{ translateMatchReason(summary.matchReason) }}
      </p>

      <p
        v-if="summary.player.id === selectedPlayerId"
        class="comparison-ranking-card__selected"
        data-compare-selected-player
      >
        {{ summary.player.name }}
      </p>
    </button>
  </section>
</template>

<style scoped>
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
  border-color: color-mix(in srgb, var(--accent-color) 36%, var(--surface-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 10%, transparent), transparent 48%),
    color-mix(in srgb, var(--glass-sm) 96%, var(--background));
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
}

.comparison-ranking-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.comparison-ranking-card__score-wrap {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.comparison-ranking-card__name,
.comparison-ranking-card__score {
  margin: 0;
  color: var(--text-primary);
  font-weight: 750;
}

.comparison-ranking-card__name {
  font-size: 18px;
}

.comparison-ranking-card__team,
.comparison-ranking-card__reason,
.comparison-ranking-card__selected {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.comparison-ranking-card__mode {
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

.comparison-ranking-card__team,
.comparison-ranking-card__selected {
  font-size: 13px;
}

.comparison-ranking-card__selected {
  width: fit-content;
  border-radius: 999px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  color: var(--text-primary);
}
</style>
