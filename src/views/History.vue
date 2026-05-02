<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/ui/confirm-dialog/ConfirmDialog.vue'
import { ArrowLeft, Search, Trash2, Eye, Clock, ChevronRight, ChevronDown, FileVideo, Image, Loader2 } from 'lucide-vue-next'
import { PAGE_COVER_ART } from '@/lib/page-cover-art'
import { useAnalysisStore } from '@/stores/analysis'
import type { AnalysisHistory, ShotType } from '@/types'
import { SHOT_TYPE_NAMES } from '@/types'
import { getShotTypeBadgeVariant } from '@/lib/analysis-utils'

const router = useRouter()
const analysisStore = useAnalysisStore()
const historyList = ref<AnalysisHistory[]>([])
const isLoadingHistory = ref(true)

const PAGE_SIZE = 20
const currentOffset = ref(0)
const hasMore = ref(false)
const isLoadingMore = ref(false)
const searchQuery = ref('')
const shotTypeFilter = ref<ShotType | ''>('')

const filteredHistory = computed(() => {
  let list = historyList.value

  if (shotTypeFilter.value) {
    list = list.filter(r => r.analysis.shotType === shotTypeFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(r => {
      const typeName = getShotTypeName(r.analysis.shotType).toLowerCase()
      return typeName.includes(q)
    })
  }

  return list
})

const loadInitial = async () => {
  isLoadingHistory.value = true
  try {
    const page = await analysisStore.getHistoryPage(PAGE_SIZE, 0)
    historyList.value = page
    currentOffset.value = page.length
    hasMore.value = page.length === PAGE_SIZE
  } finally {
    isLoadingHistory.value = false
  }
}

const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return
  isLoadingMore.value = true
  try {
    const page = await analysisStore.getHistoryPage(PAGE_SIZE, currentOffset.value)
    historyList.value = [...historyList.value, ...page]
    currentOffset.value += page.length
    hasMore.value = page.length === PAGE_SIZE
  } finally {
    isLoadingMore.value = false
  }
}

onMounted(() => {
  void loadInitial()
})

const goBack = () => {
  router.push('/')
}

const getShotTypeName = (type: ShotType) => SHOT_TYPE_NAMES[type]

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatRelativeTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  if (weeks < 4) return `${weeks}周前`
  if (months < 12) return `${months}个月前`
  return '很久以前'
}

const viewDetail = (record: AnalysisHistory) => {
  analysisStore.setCurrentHistoryRecord(record)
  router.push('/analysis')
}

const deleteHistory = async (id: number) => {
  pendingDeleteId.value = id
  confirmDialogOpen.value = true
}

const confirmDialogOpen = ref(false)
const pendingDeleteId = ref<number | null>(null)
const isDeleting = ref(false)

const handleConfirmDelete = async () => {
  const id = pendingDeleteId.value
  if (id == null) return

  isDeleting.value = true
  try {
    await analysisStore.deleteHistory(id)
    historyList.value = historyList.value.filter(h => h.id !== id)
  } finally {
    isDeleting.value = false
    confirmDialogOpen.value = false
    pendingDeleteId.value = null
  }
}

const handleCancelDelete = () => {
  confirmDialogOpen.value = false
  pendingDeleteId.value = null
}

interface HistoryGroup {
  sourceIdentifier: string
  sourceType: 'video' | 'image'
  sourceName: string
  records: AnalysisHistory[]
}

const groupedHistory = computed<HistoryGroup[]>(() => {
  const groups = new Map<string, HistoryGroup>()

  for (const record of filteredHistory.value) {
    const sourceId = record.sourceIdentifier || 'unknown'
    const existing = groups.get(sourceId)

    if (existing) {
      existing.records.push(record)
    } else {
      const sourceType = sourceId.startsWith('video:') ? 'video' : 'image'
      const sourceName = sourceType === 'video'
        ? sourceId.replace('video:', '').split(/[\\/]/).pop() || '未知视频'
        : '图片分析'

      groups.set(sourceId, {
        sourceIdentifier: sourceId,
        sourceType,
        sourceName,
        records: [record]
      })
    }
  }

  return Array.from(groups.values())
})

const expandedGroups = ref<Set<string>>(new Set())

const toggleGroup = (sourceIdentifier: string) => {
  const newSet = new Set(expandedGroups.value)
  if (newSet.has(sourceIdentifier)) {
    newSet.delete(sourceIdentifier)
  } else {
    newSet.add(sourceIdentifier)
  }
  expandedGroups.value = newSet
}

const isExpanded = (sourceIdentifier: string) => expandedGroups.value.has(sourceIdentifier)
</script>

<template>
  <div class="history-page">
    <div class="history-page__cover" :style="{ backgroundImage: `url(${PAGE_COVER_ART.history})` }"
      aria-hidden="true" />
    <div class="history-page__veil" aria-hidden="true" />

    <div class="history-page__content">
      <header class="history-page__header">
        <Button variant="ghost" size="icon" class="history-page__back" @click="goBack">
          <ArrowLeft class="h-5 w-5" />
        </Button>

        <div class="history-page__heading">
          <p class="history-page__eyebrow">History</p>
          <h1 class="history-page__title">历史记录</h1>
        </div>
      </header>

      <section class="history-archive">
        <div v-if="isLoadingHistory" class="history-archive__loading">
          <Loader2 class="h-8 w-8 animate-spin text-[var(--primary-color)]" />
          <p class="history-archive__loading-text">正在加载历史记录...</p>
        </div>

        <template v-else>
          <header v-if="historyList.length > 0" class="history-archive__toolbar">
            <div>
              <p class="history-archive__eyebrow">Session Archive</p>
              <h2 class="history-archive__title">继续查看以往分析</h2>
            </div>
            <div class="history-archive__filters">
              <div class="history-archive__search">
                <Search class="history-archive__search-icon h-3.5 w-3.5" />
                <input v-model="searchQuery" class="history-archive__search-input" type="text"
                  placeholder="搜索投篮分型..." />
              </div>
              <select v-model="shotTypeFilter" class="history-archive__select">
                <option value="">全部分型</option>
                <option value="one_motion">一段式投篮</option>
                <option value="one_point_five_motion">1.5 段式投篮</option>
                <option value="two_motion">二段式投篮</option>
                <option value="unknown">分型待确认</option>
              </select>
            </div>
          </header>

          <div v-if="historyList.length > 0" class="history-archive__list">
            <div v-for="group in groupedHistory" :key="group.sourceIdentifier" class="history-group">
              <button class="history-group__header" @click="toggleGroup(group.sourceIdentifier)">
                <div class="history-group__toggle">
                  <ChevronDown v-if="isExpanded(group.sourceIdentifier)" class="w-4 h-4" />
                  <ChevronRight v-else class="w-4 h-4" />
                </div>
                <div class="history-group__icon">
                  <FileVideo v-if="group.sourceType === 'video'" class="w-4 h-4" />
                  <Image v-else class="w-4 h-4" />
                </div>
                <div class="history-group__info">
                  <span class="history-group__name">{{ group.sourceName }}</span>
                  <span class="history-group__count">{{ group.records.length }} 条记录</span>
                </div>
              </button>

              <div v-show="isExpanded(group.sourceIdentifier)" class="history-group__content">
                <article v-for="record in group.records" :key="record.id" class="history-session-row">
                  <div class="history-session-row__time">
                    <p class="history-session-row__label">分析时间</p>
                    <div class="history-session-row__timestamp">
                      <Clock class="w-3.5 h-3.5" />
                      {{ formatRelativeTime(record.createdAt) }}
                    </div>
                    <div class="history-session-row__fulltime">
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
                      查看分析
                    </Button>
                    <Button variant="outline" size="sm"
                      class="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                      @click="deleteHistory(record.id)">
                      <Trash2 class="w-4 h-4" />
                    </Button>
                  </div>
                </article>
              </div>
            </div>
          </div>

          <div v-if="hasMore && !searchQuery && !shotTypeFilter" class="history-archive__more">
            <Button variant="outline" :loading="isLoadingMore" :disabled="isLoadingMore" @click="void loadMore()">
              加载更多记录
            </Button>
          </div>

          <div v-if="groupedHistory.length === 0" class="history-empty-state">
            <Clock class="w-12 h-12 text-[var(--text-muted)] mb-4" />
            <h2 class="history-empty-state__title">
              {{ historyList.length === 0 ? '还没有投篮档案记录' : '未找到匹配的记录' }}
            </h2>
            <p class="history-empty-state__copy">
              {{ historyList.length === 0
                ? '完成第一次分析后，这里会按来源文件分组记录每次训练结果，并提供查看分析入口。'
                : '尝试调整搜索关键词或筛选条件。' }}
            </p>
          </div>
        </template>
      </section>
    </div>

    <ConfirmDialog :open="confirmDialogOpen" title="确定要删除这条记录吗？" description="删除后无法恢复，但你可以重新上传分析。" confirm-label="删除"
      variant="danger" :loading="isDeleting" @confirm="handleConfirmDelete" @cancel="handleCancelDelete"
      @update:open="confirmDialogOpen = $event" />
  </div>
</template>

<style scoped>
.history-page {
  position: relative;
  min-height: 100%;
  padding: clamp(3.75rem, 6vh, 4.5rem) 28px 28px;
  overflow: hidden;
  background:
    radial-gradient(circle at 14% 14%, color-mix(in srgb, var(--accent-color) 4%, transparent), transparent 20%),
    radial-gradient(circle at 84% 18%, color-mix(in srgb, var(--primary-color) 4%, transparent), transparent 24%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-solid) 97%, var(--surface-color)), var(--bg-solid));
}

.history-page__cover,
.history-page__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.history-page__cover {
  background-position: right -1rem top 1rem;
  background-repeat: no-repeat;
  background-size: min(31vw, 27rem) auto;
  opacity: 0.08;
  transform: translate3d(0, 0, 0) scale(1.01);
}

.history-page__veil {
  background:
    radial-gradient(circle at 72% 22%, color-mix(in srgb, var(--accent-color) 8%, transparent), transparent 22%),
    linear-gradient(180deg,
      color-mix(in srgb, var(--bg-solid) 58%, transparent),
      color-mix(in srgb, var(--bg-solid) 90%, var(--background)));
  opacity: 0.44;
}

.history-page__content {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  display: grid;
  gap: 22px;
}

.history-page__header {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: start;
  gap: 18px;
}

.history-page__back {
  margin-top: 2px;
}

.history-page__heading {
  display: grid;
  gap: 8px;
}

.history-page__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.history-page__title {
  margin: 0;
  font-size: clamp(1.9rem, 1.55rem + 0.9vw, 2.45rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-primary);
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

.history-archive__filters {
  display: flex;
  gap: 10px;
  align-items: center;
}

.history-archive__search {
  position: relative;
  display: flex;
  align-items: center;
}

.history-archive__search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}

.history-archive__search-input {
  width: 200px;
  height: 34px;
  padding: 0 12px 0 34px;
  border-radius: 10px;
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.history-archive__search-input::placeholder {
  color: var(--text-muted);
}

.history-archive__search-input:focus {
  border-color: var(--primary-color);
}

.history-archive__select {
  height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.history-archive__select:focus {
  border-color: var(--primary-color);
}

.history-archive__more {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}

.history-archive__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 400px;
}

.history-archive__loading-text {
  font-size: 14px;
  color: var(--text-muted);
}

.history-archive__list {
  display: grid;
  gap: 12px;
}

.history-group {
  border-radius: 22px;
  border: 1px solid var(--surface-border);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.history-group__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  transition: background-color 0.15s ease;
}

.history-group__header:hover {
  background: color-mix(in srgb, var(--surface-color) 40%, transparent);
}

.history-group__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.history-group__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary-color) 8%, transparent);
  color: var(--primary-color);
  flex-shrink: 0;
}

.history-group__info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.history-group__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-group__count {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.history-group__content {
  padding: 0 18px 14px;
  display: grid;
  gap: 8px;
}

.history-session-row {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 60%, transparent);
  background: color-mix(in srgb, var(--background) 60%, var(--card-bg));
  content-visibility: auto;
  contain-intrinsic-size: auto 88px;
}

.history-session-row__time {
  display: grid;
  gap: 4px;
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

.history-session-row__fulltime {
  font-size: 11px;
  color: var(--text-muted);
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
  gap: 6px;
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
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 24px;
  border: 1px dashed color-mix(in srgb, var(--surface-border) 88%, transparent);
  background: var(--card-bg);
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

@media (max-width: 960px) {
  .history-page {
    padding: 72px 20px 24px;
  }

  .history-page__cover {
    background-position: right -2rem top 1rem;
    background-size: min(44vw, 18rem) auto;
  }

  .history-archive__toolbar {
    flex-direction: column;
  }

  .history-archive__hint {
    max-width: none;
  }

  .history-group__info {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
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

@media (max-width: 640px) {
  .history-page__header {
    grid-template-columns: auto 1fr;
  }

  .history-empty-state {
    min-height: 360px;
  }
}
</style>
