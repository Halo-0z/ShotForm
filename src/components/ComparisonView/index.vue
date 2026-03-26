<template>
  <div class="comparison-view">
    <div class="player-select">
      <h3>选择球星模板</h3>
      <el-select v-model="selectedPlayer" placeholder="请选择球星" @change="handlePlayerChange">
        <el-option
          v-for="player in players"
          :key="player.id"
          :label="player.name"
          :value="player.id"
        >
          <span>{{ player.name }}</span>
          <span class="player-team">{{ player.team }}</span>
        </el-option>
      </el-select>
    </div>

    <div v-if="comparisonResult" class="comparison-content">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card>
            <template #header>
              <span>相似度评分</span>
            </template>
            <div class="similarity-score">
              <el-progress
                type="dashboard"
                :percentage="comparisonResult.similarity * 100"
                :color="getScoreColor(comparisonResult.similarity)"
              />
              <p class="score-label">与你和 {{ comparisonResult.player.name }} 的姿势相似度</p>
            </div>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card>
            <template #header>
              <span>角度对比雷达图</span>
            </template>
            <RadarChart
              :user-data="userAngles"
              :player-data="playerAngles"
              :player-name="comparisonResult.player.name"
            />
          </el-card>
        </el-col>
      </el-row>

      <el-card class="difference-card">
        <template #header>
          <span>详细角度差异</span>
        </template>
        <el-table :data="comparisonResult.angleDifferences" style="width: 100%">
          <el-table-column label="关节名称" width="150">
            <template #default="{ row }">
              {{ getAngleDisplayName(row.name) }}
            </template>
          </el-table-column>
          <el-table-column label="你的角度" width="120">
            <template #default="{ row }">
              <span :class="{ 'warning-value': Math.abs(row.difference) > 10 }">
                {{ row.userValue.toFixed(1) }}°
              </span>
            </template>
          </el-table-column>
          <el-table-column label="球星角度" width="120">
            <template #default="{ row }">
              {{ row.playerValue.toFixed(1) }}°
            </template>
          </el-table-column>
          <el-table-column label="差异" width="120">
            <template #default="{ row }">
              <el-tag :type="getDifferenceTag(row.difference)">
                {{ row.difference > 0 ? '+' : '' }}{{ row.difference.toFixed(1) }}°
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
    </div>

    <el-empty v-else-if="!analysis" description="请先进行姿势分析" />
    <el-empty v-else description="请选择球星进行对比" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getAngleDisplayName, type ComparisonResult, type PlayerTemplate, type ShotAnalysis } from '@/types'
import RadarChart from '@/components/ChartComponents/RadarChart.vue'

const props = defineProps<{
  analysis: ShotAnalysis | null
}>()

const players = ref<PlayerTemplate[]>([])
const selectedPlayer = ref<number | null>(null)
const comparisonResult = ref<ComparisonResult | null>(null)

const userAngles = computed(() => {
  if (!props.analysis) return []
  return props.analysis.angles.map(angle => angle.value)
})

const playerAngles = computed(() => {
  if (!comparisonResult.value) return []
  return comparisonResult.value.player.angles.map(angle => angle.value)
})

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

const loadPlayers = async () => {
  players.value = await invoke<PlayerTemplate[]>('get_player_templates')
}

const handlePlayerChange = async () => {
  if (!selectedPlayer.value || !props.analysis) return

  comparisonResult.value = await invoke<ComparisonResult>('compare_with_player', {
    analysis: props.analysis,
    playerId: selectedPlayer.value
  })
}

onMounted(() => {
  loadPlayers()
})
</script>

<style scoped>
.comparison-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.player-select {
  display: flex;
  align-items: center;
  gap: 15px;
}

.player-select h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.player-team {
  color: var(--text-muted);
  margin-left: 10px;
}

.comparison-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.similarity-score {
  text-align: center;
  padding: 20px;
}

.score-label {
  margin-top: 15px;
  color: var(--text-secondary);
}

.difference-card {
  flex: 1;
}

.warning-value {
  color: #E6A23C;
  font-weight: 600;
}
</style>
