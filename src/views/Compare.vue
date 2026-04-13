<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, GitCompareArrows } from 'lucide-vue-next'
import ComparisonView from '@/components/ComparisonView/index.vue'
import { Button } from '@/components/ui/button'
import { PAGE_COVER_ART } from '@/lib/page-cover-art'
import { useAnalysisStore } from '@/stores/analysis'

const router = useRouter()
const analysisStore = useAnalysisStore()

const analysis = computed(() => analysisStore.currentAnalysis)

const goBack = () => {
  router.push('/analysis')
}

const goToUpload = () => {
  router.push('/upload')
}
</script>

<template>
  <div class="compare-page">
    <div class="compare-page__cover" :style="{ backgroundImage: `url(${PAGE_COVER_ART.compare})` }" aria-hidden="true" />
    <div class="compare-page__veil" aria-hidden="true" />

    <div class="compare-page__content">
      <header class="compare-page__header">
        <Button variant="ghost" size="icon" class="compare-page__back" @click="goBack">
          <ArrowLeft class="h-5 w-5" />
        </Button>

        <div class="compare-page__heading">
          <p class="compare-page__eyebrow">Compare</p>
          <h1 class="compare-page__title">球星对比</h1>
        </div>

        <p class="compare-page__summary">
          当前对比基于本次分析结果与选中模板的关键角度差异。
        </p>
      </header>

      <section class="compare-page__workbench">
        <ComparisonView v-if="analysis" :analysis="analysis" />

        <div v-else class="compare-page__empty">
          <div class="compare-page__empty-icon">
            <GitCompareArrows class="h-6 w-6" />
          </div>
          <div class="compare-page__empty-copy">
            <p class="compare-page__empty-title">先完成一次姿势分析，再进入对比工作台</p>
            <p class="compare-page__empty-body">
              对比页会基于当前分析结果展示最接近的模板、关键角度差异和针对性的学习路径。
            </p>
          </div>
          <Button class="compare-page__empty-action" @click="goToUpload">
            前往上传工作台
          </Button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.compare-page {
  position: relative;
  min-height: 100%;
  padding: clamp(3.75rem, 6vh, 4.5rem) 28px 28px;
  overflow: hidden;
  background:
    radial-gradient(circle at 14% 14%, color-mix(in srgb, var(--accent-color) 4%, transparent), transparent 20%),
    radial-gradient(circle at 84% 18%, color-mix(in srgb, var(--primary-color) 4%, transparent), transparent 24%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-solid) 97%, var(--surface-color)), var(--bg-solid));
}

.compare-page__cover,
.compare-page__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.compare-page__cover {
  background-position: right -1rem top 1rem;
  background-repeat: no-repeat;
  background-size: min(31vw, 27rem) auto;
  opacity: 0.08;
  transform: translate3d(0, 0, 0) scale(1.01);
}

.compare-page__veil {
  background:
    radial-gradient(circle at 72% 22%, color-mix(in srgb, var(--accent-color) 8%, transparent), transparent 22%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-solid) 58%, transparent),
      color-mix(in srgb, var(--bg-solid) 90%, var(--background))
    );
  opacity: 0.44;
}

.compare-page__content {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  gap: 22px;
}

.compare-page__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(280px, 360px);
  align-items: start;
  gap: 18px;
}

.compare-page__back {
  margin-top: 2px;
}

.compare-page__heading {
  display: grid;
  gap: 8px;
}

.compare-page__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.compare-page__title {
  margin: 0;
  font-size: clamp(1.9rem, 1.55rem + 0.9vw, 2.45rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
}

.compare-page__summary {
  margin: 0;
  padding-top: 6px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.compare-page__workbench {
  border: 1px solid color-mix(in srgb, var(--surface-border) 90%, transparent);
  border-radius: 30px;
  padding: 24px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-color) 96%, var(--background)), color-mix(in srgb, var(--glass-xs) 90%, var(--background)));
  box-shadow: var(--shadow-lg);
}

.compare-page__empty {
  min-height: 420px;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 16px;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  border-radius: 24px;
  border: 1px dashed color-mix(in srgb, var(--surface-border) 88%, transparent);
  background: color-mix(in srgb, var(--glass-xs) 94%, var(--background));
}

.compare-page__empty-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--accent-color) 10%, var(--glass-sm));
  color: color-mix(in srgb, var(--accent-color) 68%, var(--text-primary));
}

.compare-page__empty-copy {
  display: grid;
  gap: 8px;
  max-width: 560px;
}

.compare-page__empty-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.compare-page__empty-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.compare-page__empty-action {
  margin-top: 2px;
}

@media (max-width: 960px) {
  .compare-page {
    padding: 72px 20px 24px;
  }

  .compare-page__cover {
    background-position: right -2rem top 1rem;
    background-size: min(44vw, 18rem) auto;
  }

  .compare-page__header {
    grid-template-columns: auto 1fr;
  }

  .compare-page__summary {
    grid-column: 1 / -1;
    padding-top: 0;
    max-width: 42rem;
  }

  .compare-page__workbench {
    padding: 20px;
  }
}

@media (max-width: 640px) {
  .compare-page__workbench {
    padding: 16px;
    border-radius: 24px;
  }

  .compare-page__empty {
    min-height: 360px;
    justify-items: stretch;
  }
}
</style>
