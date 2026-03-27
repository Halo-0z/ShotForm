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
    <section class="compare-hero-banner">
      <div class="page-header compare-hero-header">
        <Button variant="ghost" size="icon" class="compare-back-button" @click="goBack">
          <ArrowLeft class="w-5 h-5" />
        </Button>

        <div class="compare-hero-copy">
          <p class="compare-hero-kicker">Compare</p>
          <h1 class="page-title">球星姿势对比</h1>
        </div>
      </div>

      <img src="/hero/jordan-dunk.png" alt="" class="compare-hero-art" />
    </section>

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

.compare-hero-banner {
  position: relative;
  overflow: hidden;
  margin-bottom: var(--spacing-xl);
  padding: 20px 24px;
  min-height: 180px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at 78% 18%, rgba(242, 123, 67, 0.14), transparent 20%),
    radial-gradient(circle at 30% 24%, rgba(111, 133, 214, 0.14), transparent 26%),
    linear-gradient(180deg, rgba(18, 20, 31, 0.94), rgba(10, 12, 20, 0.98));
  box-shadow:
    0 24px 54px rgba(0, 0, 0, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.compare-hero-header {
  position: relative;
  z-index: 1;
  margin-bottom: 0;
}

.compare-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compare-hero-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, #f6b26b 62%, var(--text-secondary));
}

.compare-back-button {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.page-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.compare-hero-art {
  position: absolute;
  right: 8px;
  bottom: -2px;
  width: min(100%, 280px);
  height: auto;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 22px 36px rgba(0, 0, 0, 0.42));
}

.compare-content {
  flex: 1;
  overflow: auto;
}

.empty-card {
  height: 100%;
}

@media (max-width: 720px) {
  .compare-page {
    padding: 16px;
  }

  .compare-hero-banner {
    min-height: 152px;
    padding: 18px 16px;
  }

  .compare-hero-art {
    width: 180px;
    right: -10px;
  }
}
</style>
