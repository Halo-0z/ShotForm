<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trash2, Eye, Clock } from 'lucide-vue-next'
import { useAnalysisStore } from '@/stores/analysis'
import type { AnalysisHistory, ShotType } from '@/types'
import { SHOT_TYPE_NAMES } from '@/types'

const router = useRouter()
const analysisStore = useAnalysisStore()
const historyList = ref<AnalysisHistory[]>([])

onMounted(async () => {
  historyList.value = await analysisStore.getHistory()
})

const goBack = () => {
  router.push('/')
}

const getShotTypeName = (type: ShotType) => SHOT_TYPE_NAMES[type]

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const viewDetail = (record: AnalysisHistory) => {
  analysisStore.setCurrentHistoryRecord(record)
  router.push('/analysis')
}

const deleteHistory = async (id: number) => {
  if (confirm('确定要删除这条记录吗？')) {
    await analysisStore.deleteHistory(id)
    historyList.value = historyList.value.filter(h => h.id !== id)
  }
}

const getShotTypeBadgeVariant = (type: ShotType): 'excellent' | 'good' | 'average' | 'poor' | 'secondary' => {
  const variants: Record<ShotType, 'excellent' | 'good' | 'average' | 'poor' | 'secondary'> = {
    one_motion: 'excellent',
    one_point_five_motion: 'good',
    two_motion: 'average',
    unknown: 'secondary'
  }
  return variants[type] || 'good'
}
</script>

<template>
  <div class="history-page">
    <div class="page-header">
      <Button variant="ghost" size="icon" @click="goBack">
        <ArrowLeft class="w-5 h-5" />
      </Button>
      <h1 class="page-title">历史记录</h1>
    </div>
    
    <div class="history-content">
      <div v-if="historyList.length > 0" class="history-grid">
        <Card v-for="record in historyList" :key="record.id" class="history-card">
          <CardContent class="p-4">
            <div class="flex gap-4">
              <div class="w-24 h-20 rounded-lg overflow-hidden bg-[var(--glass-sm)] flex-shrink-0">
                <img :src="record.annotatedImagePath" class="w-full h-full object-cover" alt="历史记录" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <Badge :variant="getShotTypeBadgeVariant(record.analysis.shotType)">
                    {{ getShotTypeName(record.analysis.shotType) }}
                  </Badge>
                </div>
                <div class="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <Clock class="w-3.5 h-3.5" />
                  {{ formatDate(record.createdAt) }}
                </div>
              </div>
            </div>
            <div class="flex gap-2 mt-4">
              <Button variant="outline" size="sm" class="flex-1" @click="viewDetail(record)">
                <Eye class="w-4 h-4 mr-1.5" />
                查看详情
              </Button>
              <Button variant="outline" size="sm" class="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]" @click="deleteHistory(record.id)">
                <Trash2 class="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card v-else class="empty-card">
        <CardContent class="flex flex-col items-center justify-center py-16">
          <Clock class="w-12 h-12 text-[var(--text-muted)] mb-4" />
          <p class="text-[var(--text-muted)]">暂无历史记录</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.history-page {
  width: 100%;
  height: 100%;
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.page-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.history-content {
  flex: 1;
  overflow: auto;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--spacing-lg);
}

.history-card {
  transition: all var(--transition-normal);
}

.history-card:hover {
  transform: translateY(-2px);
}

.empty-card {
  height: 100%;
}
</style>
