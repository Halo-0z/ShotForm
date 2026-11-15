<script setup lang="ts">
import { ref, onMounted, computed } from "vue"
import { useRouter } from "vue-router"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import ConfirmDialog from "@/components/ui/confirm-dialog/ConfirmDialog.vue"
import ProgressChart from "@/components/ProgressChart.vue"
import TrainingRecordEditor from "@/components/TrainingRecordEditor.vue"
import TrainingComparison from "@/components/TrainingComparison.vue"
import { localDate } from "@/lib/training-comparison.js"
import {
    Trash2,
    Eye,
    Clock,
    ChevronRight,
    ChevronDown,
    FileVideo,
    Image,
    Loader2,
} from "lucide-vue-next"
import { useAnalysisStore } from "@/stores/analysis"
import { hasTauriRuntime } from "@/lib/tauri-runtime"
import type { AnalysisHistory, ShotType } from "@/types"
import { SHOT_TYPE_NAMES, getRecordShotType } from "@/types"
import { getShotTypeBadgeVariant } from "@/lib/analysis-utils"

const router = useRouter()
const analysisStore = useAnalysisStore()
const historyList = ref<AnalysisHistory[]>([])
const isLoadingHistory = ref(true)

const PAGE_SIZE = 20
const currentOffset = ref(0)
const hasMore = ref(false)
const isLoadingMore = ref(false)
const shotTypeFilter = ref<ShotType | "">("")
const dateFrom = ref(""),
    dateTo = ref(""),
    tagFilter = ref("")
const historyError = ref("")
const editingId = ref<number | null>(null)
const selectedRecords = ref<AnalysisHistory[]>([])
const hasActiveFilters = computed(() =>
    Boolean(dateFrom.value || dateTo.value || tagFilter.value || shotTypeFilter.value),
)
const filteredHistory = computed(() => historyList.value)
let queryRevision = 0
const filters = () => ({
    dateFrom: dateFrom.value,
    dateTo: dateTo.value,
    tag: tagFilter.value,
    shotType: shotTypeFilter.value,
})
let appliedFilters = filters()
const loadInitial = async () => {
    const revision = ++queryRevision
    historyError.value = ""
    if (!hasTauriRuntime()) {
        historyError.value = "训练记录保存在桌面端，请在桌面应用中查看。"
        isLoadingHistory.value = false
        return
    }
    if (dateFrom.value && dateTo.value && dateFrom.value > dateTo.value) {
        historyError.value = "起始日期不能晚于结束日期"
        return
    }
    isLoadingHistory.value = true
    appliedFilters = filters()
    try {
        const page = await analysisStore.queryHistory(PAGE_SIZE, 0, appliedFilters)
        if (revision !== queryRevision) return
        historyList.value = page
        currentOffset.value = page.length
        hasMore.value = page.length === PAGE_SIZE
    } catch (e) {
        if (revision === queryRevision) historyError.value = `加载失败：${String(e)}`
    } finally {
        if (revision === queryRevision) isLoadingHistory.value = false
    }
}
const loadMore = async () => {
    if (isLoadingMore.value || !hasMore.value) return
    const revision = queryRevision
    isLoadingMore.value = true
    try {
        const page = await analysisStore.queryHistory(
            PAGE_SIZE,
            currentOffset.value,
            appliedFilters,
        )
        if (revision !== queryRevision) return
        historyList.value = [...historyList.value, ...page]
        currentOffset.value += page.length
        hasMore.value = page.length === PAGE_SIZE
    } catch (e) {
        historyError.value = `加载失败：${String(e)}`
    } finally {
        isLoadingMore.value = false
    }
}
const toggleComparison = (record: AnalysisHistory) => {
    if (selectedRecords.value.some((r) => r.id === record.id))
        selectedRecords.value = selectedRecords.value.filter((r) => r.id !== record.id)
    else if (selectedRecords.value.length < 2) selectedRecords.value.push(record)
}
const afterMetadataSaved = async () => {
    editingId.value = null
    selectedRecords.value = []
    await loadInitial()
}
const resetFilters = () => {
    dateFrom.value = ""
    dateTo.value = ""
    tagFilter.value = ""
    shotTypeFilter.value = ""
    void loadInitial()
}

onMounted(() => {
    void loadInitial()
})

const getShotTypeName = (type: ShotType) => SHOT_TYPE_NAMES[type]

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-CN")
}

const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)

    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    if (weeks < 4) return `${weeks}周前`
    if (months < 12) return `${months}个月前`
    return "很久以前"
}

const viewDetail = (record: AnalysisHistory) => {
    analysisStore.setCurrentHistoryRecord(record)
    router.push("/analysis")
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
        selectedRecords.value = selectedRecords.value.filter((r) => r.id !== id)
        await loadInitial()
    } catch (e) {
        historyError.value = `删除失败：${String(e)}`
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
    sourceType: "video" | "image"
    sourceName: string
    records: AnalysisHistory[]
}

const groupedHistory = computed<HistoryGroup[]>(() => {
    const groups = new Map<string, HistoryGroup>()

    for (const record of filteredHistory.value) {
        const sourceId = `${record.sourceIdentifier || "image"}#${record.id}`
        const existing = groups.get(sourceId)

        if (existing) {
            existing.records.push(record)
        } else {
            const sourceType = sourceId.startsWith("video:") ? "video" : "image"
            const sourceName =
                sourceType === "video"
                    ? (record.sourceIdentifier || "").replace("video:", "").split(/[\\/]/).pop() ||
                      "未知视频"
                    : `图片分析 · #${record.id}`

            groups.set(sourceId, {
                sourceIdentifier: sourceId,
                sourceType,
                sourceName,
                records: [record],
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

const isExpanded = (sourceIdentifier: string) => !expandedGroups.value.has(sourceIdentifier)
</script>

<template>
    <div class="history-page ui-page ui-enter">
        <div class="history-page__content">
            <header class="history-page__header ui-page__header">
                <div class="history-page__heading">
                    <h1 class="history-page__title">历史记录</h1>
                </div>
            </header>

            <section class="history-archive">
                <form class="training-filters" @submit.prevent="loadInitial">
                    <label
                        >开始日期<input v-model="dateFrom" type="date" aria-label="开始日期"
                    /></label>
                    <label
                        >结束日期<input v-model="dateTo" type="date" aria-label="结束日期"
                    /></label>
                    <label
                        >标签<input
                            v-model="tagFilter"
                            placeholder="完整标签名称"
                            aria-label="筛选标签"
                    /></label>
                    <label
                        >分型<select v-model="shotTypeFilter">
                            <option value="">全部分型</option>
                            <option value="one_motion">一段式</option>
                            <option value="one_point_five_motion">1.5 段式</option>
                            <option value="two_motion">二段式</option>
                            <option value="unknown">待确认</option>
                        </select></label
                    >
                    <Button type="submit" :disabled="isLoadingHistory">筛选</Button>
                    <Button type="button" variant="outline" @click="resetFilters">重置</Button>
                </form>
                <p v-if="historyError" role="alert" class="ui-notice ui-notice--error">
                    {{ historyError }}
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="isLoadingHistory"
                        @click="loadInitial"
                        >重新加载</Button
                    >
                </p>
                <p class="my-3">选择两条记录对比 · 已选 {{ selectedRecords.length }}/2</p>
                <Button
                    v-if="selectedRecords.length"
                    variant="outline"
                    size="sm"
                    @click="selectedRecords = []"
                    >清空选择</Button
                >
                <TrainingComparison
                    v-if="selectedRecords.length === 2"
                    :records="selectedRecords"
                    @close="selectedRecords = []"
                />
                <div v-if="isLoadingHistory" class="history-archive__loading">
                    <Loader2 class="h-8 w-8 animate-spin text-[var(--primary-color)]" />
                    <p class="history-archive__loading-text">正在加载历史记录...</p>
                </div>

                <template v-else>
                    <div v-if="historyList.length > 0" class="history-archive__list">
                        <div
                            v-for="group in groupedHistory"
                            :key="group.sourceIdentifier"
                            class="history-group"
                        >
                            <button
                                class="history-group__header"
                                :aria-expanded="isExpanded(group.sourceIdentifier)"
                                @click="toggleGroup(group.sourceIdentifier)"
                            >
                                <div class="history-group__toggle">
                                    <ChevronDown
                                        v-if="isExpanded(group.sourceIdentifier)"
                                        class="w-4 h-4"
                                    />
                                    <ChevronRight v-else class="w-4 h-4" />
                                </div>
                                <div class="history-group__icon">
                                    <FileVideo
                                        v-if="group.sourceType === 'video'"
                                        class="w-4 h-4"
                                    />
                                    <Image v-else class="w-4 h-4" />
                                </div>
                                <div class="history-group__info">
                                    <span class="history-group__name">{{ group.sourceName }}</span>
                                    <span class="history-group__count"
                                        >{{ group.records.length }} 条记录</span
                                    >
                                </div>
                            </button>

                            <div
                                v-show="isExpanded(group.sourceIdentifier)"
                                class="history-group__content"
                            >
                                <article
                                    v-for="record in group.records"
                                    :key="record.id"
                                    class="history-session-row"
                                >
                                    <div class="history-session-row__time">
                                        <p class="history-session-row__label">
                                            训练日期
                                            {{ record.trainingDate || localDate(record.createdAt) }}
                                        </p>
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
                                            <img
                                                :src="record.annotatedImagePath"
                                                class="history-session-row__preview-image"
                                                alt="历史记录"
                                            />
                                        </div>
                                        <div class="history-session-row__meta">
                                            <div class="history-session-row__badges">
                                                <Badge
                                                    :variant="
                                                        getShotTypeBadgeVariant(
                                                            getRecordShotType(record),
                                                        )
                                                    "
                                                >
                                                    {{ getShotTypeName(getRecordShotType(record)) }}
                                                </Badge>
                                                <span class="history-session-row__result"
                                                    >分析结果已保存</span
                                                >
                                            </div>
                                            <p class="history-session-row__summary">
                                                {{ record.notes || "无训练备注" }}
                                                <span v-if="record.tags?.length">
                                                    · {{ record.tags.join("、") }}</span
                                                >
                                            </p>
                                        </div>
                                    </div>

                                    <div class="history-session-row__actions">
                                        <label
                                            ><input
                                                type="checkbox"
                                                :checked="
                                                    selectedRecords.some((r) => r.id === record.id)
                                                "
                                                :disabled="
                                                    selectedRecords.length >= 2 &&
                                                    !selectedRecords.some((r) => r.id === record.id)
                                                "
                                                :aria-label="'选择记录 ' + record.id + ' 对比'"
                                                @change="toggleComparison(record)"
                                            />
                                            对比</label
                                        >
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            @click="
                                                editingId =
                                                    editingId === record.id ? null : record.id
                                            "
                                            >编辑训练</Button
                                        >
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="history-session-row__resume"
                                            @click="viewDetail(record)"
                                        >
                                            <Eye class="w-4 h-4" />
                                            查看分析
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                                            :aria-label="`删除记录 ${record.id}`"
                                            @click="deleteHistory(record.id)"
                                        >
                                            <Trash2 class="w-4 h-4" />
                                        </Button>
                                    </div>
                                </article>

                                <template
                                    v-for="record in group.records"
                                    :key="'edit-' + record.id"
                                >
                                    <TrainingRecordEditor
                                        v-if="editingId === record.id"
                                        :record="record"
                                        @saved="afterMetadataSaved"
                                        @cancel="editingId = null"
                                    />
                                </template>
                            </div>
                        </div>
                    </div>

                    <div v-if="hasMore" class="history-archive__more">
                        <Button
                            variant="outline"
                            :loading="isLoadingMore"
                            :disabled="isLoadingMore"
                            @click="void loadMore()"
                        >
                            加载更多记录
                        </Button>
                    </div>

                    <p v-if="historyList.length > 1" class="my-3">
                        以下趋势仅展示已加载记录的代表帧角度，跨素材变化不自动代表训练进步。
                    </p>
                    <ProgressChart v-if="historyList.length > 1" :records="historyList" />
                    <div
                        v-if="groupedHistory.length === 0 && !historyError"
                        class="history-empty-state"
                    >
                        <Clock class="w-12 h-12 text-[var(--text-muted)] mb-4" />
                        <h2 class="history-empty-state__title">
                            {{ hasActiveFilters ? "未找到匹配的记录" : "还没有投篮档案记录" }}
                        </h2>
                        <p class="history-empty-state__copy">
                            {{
                                !hasActiveFilters
                                    ? "完成第一次分析后，这里会按来源文件分组记录每次训练结果，并提供查看分析入口。"
                                    : "尝试调整日期、标签或分型筛选。"
                            }}
                        </p>
                    </div>
                </template>
            </section>
        </div>

        <ConfirmDialog
            :open="confirmDialogOpen"
            title="确定要删除这条记录吗？"
            description="删除后无法恢复，但你可以重新上传分析。"
            confirm-label="删除"
            variant="danger"
            :loading="isDeleting"
            @confirm="handleConfirmDelete"
            @cancel="handleCancelDelete"
            @update:open="confirmDialogOpen = $event"
        />
    </div>
</template>

<style scoped>
.history-page__content {
    max-width: 1440px;
    margin: auto;
}
.training-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;
    padding: 20px 0;
    border-top: 1px solid var(--surface-border);
    border-bottom: 1px solid var(--surface-border);
}
.training-filters label {
    display: grid;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary);
    flex: 1;
    min-width: 140px;
}
.training-filters input,
.training-filters select {
    width: 100%;
    padding: 8px 10px;
    min-height: 38px;
    border: 1px solid var(--border-color);
}
.history-selection {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 20px 0;
    color: var(--text-secondary);
    font-size: 13px;
}
.history-archive__loading,
.history-empty-state {
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    padding: 64px 24px;
    gap: 16px;
    text-align: center;
}
.history-empty-state__title {
    font-size: 22px;
    font-weight: 600;
}
.history-empty-state__copy {
    max-width: 45em;
    color: var(--text-secondary);
}
.history-group {
    border-bottom: 1px solid var(--surface-border);
}
.history-group__header {
    width: 100%;
    padding: 16px 0;
    display: flex;
    gap: 12px;
    align-items: center;
    text-align: left;
    color: var(--text-primary);
}
.history-group__header:hover {
    background: var(--card-bg);
}
.history-group__info {
    display: flex;
    align-items: baseline;
    gap: 12px;
    min-width: 0;
}
.history-group__name {
    font-weight: 600;
    overflow-wrap: anywhere;
}
.history-group__count {
    color: var(--text-muted);
    font-size: 13px;
    flex-shrink: 0;
}
.history-group__toggle,
.history-group__icon {
    flex-shrink: 0;
}
.history-session-row {
    display: grid;
    grid-template-columns: 170px minmax(180px, 1fr) auto;
    align-items: center;
    gap: 20px;
    padding: 20px 0;
    border-top: 1px solid var(--surface-border);
}
.history-session-row__label {
    font-size: 13px;
    color: var(--text-secondary);
}
.history-session-row__timestamp {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
    font-weight: 600;
}
.history-session-row__fulltime {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
}
.history-session-row__main {
    display: flex;
    gap: 14px;
    min-width: 0;
    align-items: center;
}
.history-session-row__preview {
    width: 64px;
    height: 76px;
    flex-shrink: 0;
    background: var(--stage-bg);
    border-radius: 4px;
    overflow: hidden;
}
.history-session-row__preview-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
.history-session-row__badges {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
}
.history-session-row__result {
    display: none;
}
.history-session-row__summary {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 8px;
    overflow-wrap: anywhere;
}
.history-session-row__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
.history-session-row__actions label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
}
.history-archive__more {
    margin: 20px 0;
    text-align: center;
}
@media (max-width: 1250px) {
    .history-session-row {
        grid-template-columns: 160px minmax(0, 1fr);
    }
    .history-session-row__actions {
        grid-column: 2;
    }
}
@media (max-width: 650px) {
    .history-session-row {
        grid-template-columns: 1fr;
        gap: 12px;
    }
    .history-session-row__actions {
        grid-column: auto;
    }
    .history-group__info {
        flex-wrap: wrap;
    }
    .training-filters label {
        min-width: 120px;
    }
}
</style>
