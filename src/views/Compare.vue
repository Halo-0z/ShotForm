<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-vue-next'
import ComparisonView from '@/components/ComparisonView/index.vue'
import { useAnalysisStore } from '@/stores/analysis'
import type { ShotAnalysis } from '@/types'

const router = useRouter()
const analysisStore = useAnalysisStore()
const analysis = ref<ShotAnalysis | null>(null)

onMounted(() => {
  analysis.value = analysisStore.currentAnalysis
})

const goBack = () => {
  router.push('/analysis')
}
</script>

<template>
  <div class="compare-page">
    <div class="page-header">
      <Button variant="ghost" size="icon" @click="goBack">
        <ArrowLeft class="w-5 h-5" />
      </Button>
      <h1 class="page-title">球星姿势对比</h1>
    </div>

    <div class="compare-content">
      <ComparisonView v-if="analysis" :analysis="analysis" />
      <Card v-else class="empty-card">
        <CardContent class="flex flex-col items-center justify-center py-16">
          <p class="text-[var(--text-muted)]">请先进行姿势分析</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.compare-page {
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

.compare-content {
  flex: 1;
  overflow: auto;
}

.empty-card {
  height: 100%;
}
</style>
