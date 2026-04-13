<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trash2, Eye, Clock } from 'lucide-vue-next'
import { PAGE_COVER_ART } from '@/lib/page-cover-art'
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
    <section class="history-hero-banner">
      <div class="page-header history-hero-header">
        <Button variant="ghost" size="icon" class="history-back-button" @click="goBack">
          <ArrowLeft class="w-5 h-5" />
        </Button>

        <div class="history-hero-copy">
          <p class="history-hero-kicker">History</p>
          <h1 class="page-title">历史记录</h1>
        </div>
      </div>

      <img :src="PAGE_COVER_ART.history" alt="" class="history-hero-art" />
    </section>

    <div class="history-content">
      <section v-if="historyList.length > 0" class="history-archive">
        <header class="history-archive__toolbar">
          <div>
            <p class="history-archive__eyebrow">Session Archive</p>
            <h2 class="history-archive__title">继续查看以往分析</h2>
          </div>
          <p class="history-archive__hint">按时间回看，优先恢复最近一次训练判断。</p>
        </header>

        <div class="history-archive__list">
          <article v-for="record in historyList" :key="record.id" class="history-session-row">
            <div class="history-session-row__time">
              <p class="history-session-row__label">训练时间</p>
              <div class="history-session-row__timestamp">
                <Clock class="w-3.5 h-3.5" />
                {{ formatDate(record.createdAt) }}
              </div>
            </div>

            <div class="history-session-row__main">
              <div class="history-session-row__preview">
                <img :src="record.annotatedImagePath" class="history-session-row__preview-image" alt="历史记录" />
              </div>
              <div class="history-session-row__meta">
                <div class="history-session-row__badges">
                  <Badge :variant="getShotTypeBadgeVariant(record.analysis.shotType)">
                    {{ getShotTypeName(record.analysis.shotType) }}
                  </Badge>
                  <span class="history-session-row__result">分析结果已保存</span>
                </div>
                <p class="history-session-row__summary">可以继续查看详情或恢复分析流程。</p>
              </div>
            </div>

            <div class="history-session-row__actions">
              <Button variant="outline" size="sm" class="history-session-row__resume" @click="viewDetail(record)">
                <Eye class="w-4 h-4" />
                继续分析
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                @click="deleteHistory(record.id)"
              >
                <Trash2 class="w-4 h-4" />
              </Button>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="history-empty-state">
        <Clock class="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h2 class="history-empty-state__title">还没有投篮档案记录</h2>
        <p class="history-empty-state__copy">
          完成第一次分析后，这里会按时间记录每次训练结果，并提供继续分析入口。
        </p>
      </section>
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

.history-hero-banner {
  position: relative;
  overflow: hidden;
  margin-bottom: var(--spacing-xl);
  padding: 20px 24px;
  min-height: 180px;
  border-radius: 28px;
  border: 1px solid var(--surface-border);
  background:
    radial-gradient(circle at 78% 22%, color-mix(in srgb, var(--accent-color) 11%, transparent), transparent 20%),
    radial-gradient(circle at 30% 24%, color-mix(in srgb, var(--primary-color) 12%, transparent), transparent 26%),
    linear-gradient(180deg, color-mix(in srgb, var(--glass-lg) 92%, var(--background)), color-mix(in srgb, var(--glass-md) 94%, var(--background)));
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(18px);
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.history-hero-header {
  position: relative;
  z-index: 1;
  margin-bottom: 0;
}

.history-hero-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-hero-kicker {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-color) 54%, var(--text-secondary));
}

.history-back-button {
  border-radius: 999px;
  background: var(--glass-xs);
  border: 1px solid var(--surface-border);
}

.page-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.history-hero-art {
  position: absolute;
  right: 18px;
  bottom: -8px;
  width: min(100%, 220px);
  height: auto;
  object-fit: contain;
  pointer-events: none;
  opacity: 0.92;
  filter: drop-shadow(0 22px 36px rgba(0, 0, 0, 0.4));
}

.history-content {
  flex: 1;
  overflow: auto;
}

.history-archive {
  display: grid;
  gap: 14px;
}

.history-archive__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 2px 4px 6px;
}

.history-archive__eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-color) 42%, var(--text-secondary));
}

.history-archive__title {
  margin: 0;
  font-size: clamp(1.06rem, 1rem + 0.4vw, 1.24rem);
  font-weight: 600;
  color: var(--text-primary);
}

.history-archive__hint {
  margin: 4px 0 0;
  max-width: 360px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.history-archive__list {
  display: grid;
  gap: 12px;
}

.history-session-row {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  border-radius: 22px;
  border: 1px solid var(--surface-border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-sm) 92%, var(--background)), color-mix(in srgb, var(--glass-xs) 96%, var(--background)));
  box-shadow: var(--shadow-sm);
}

.history-session-row__time {
  display: grid;
  gap: 8px;
}

.history-session-row__label {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.history-session-row__timestamp {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.history-session-row__main {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.history-session-row__preview {
  width: 86px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
  overflow: hidden;
}

.history-session-row__preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.history-session-row__meta {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.history-session-row__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-session-row__result {
  font-size: 12px;
  color: var(--text-muted);
}

.history-session-row__summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.history-session-row__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.history-session-row__resume {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.history-empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 24px;
  border: 1px solid var(--surface-border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-md) 94%, var(--background)), color-mix(in srgb, var(--glass-xs) 96%, var(--background)));
  text-align: center;
  padding: 28px;
}

.history-empty-state__title {
  margin: 0;
  font-size: 1.08rem;
  color: var(--text-primary);
}

.history-empty-state__copy {
  margin: 0;
  max-width: 460px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 720px) {
  .history-page {
    padding: 16px;
  }

  .history-hero-banner {
    min-height: 148px;
    padding: 18px 16px;
  }

  .history-hero-art {
    width: 156px;
    right: -2px;
  }

  .history-archive__toolbar {
    flex-direction: column;
  }

  .history-archive__hint {
    max-width: none;
  }

  .history-session-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .history-session-row__main {
    grid-template-columns: 76px minmax(0, 1fr);
  }

  .history-session-row__preview {
    width: 76px;
    height: 56px;
  }

  .history-session-row__actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
