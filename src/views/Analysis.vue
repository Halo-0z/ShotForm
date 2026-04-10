<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  Expand,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
  Users,
  ZoomIn,
  ZoomOut
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AngleChart from '@/components/ChartComponents/AngleChart.vue'
import ComparisonView from '@/components/ComparisonView/index.vue'
import SuggestionPanel from '@/components/SuggestionPanel/index.vue'
import VideoPosePlayback from '@/components/VideoPosePlayback.vue'
import { PAGE_COVER_ART } from '@/lib/page-cover-art'
import { useAnalysisStore } from '@/stores/analysis'
import {
  getShotTypeGuidance,
  getShotTypeName,
  normalizeShotType,
  type ShotType
} from '@/types'

type PreviewMode = 'annotated' | 'original'

const router = useRouter()
const analysisStore = useAnalysisStore()

const insightsTab = ref<'suggestion' | 'compare'>('suggestion')
const previewMode = ref<PreviewMode>('annotated')
const previewDialogOpen = ref(false)
const previewZoom = ref(1)

const hasAnalysis = computed(() => !!analysisStore.currentAnalysis)
const hasAnnotatedImage = computed(() => !!analysisStore.currentAnnotatedImage)
const hasVideoAnalysis = computed(() => !!analysisStore.currentVideoAnalysis)
const currentVideoAnalysis = computed(() => analysisStore.currentVideoAnalysis)

watch(hasAnnotatedImage, (available) => {
  previewMode.value = available ? 'annotated' : 'original'
}, { immediate: true })

watch(() => analysisStore.currentImage, () => {
  previewDialogOpen.value = false
  previewZoom.value = 1
})

const currentPreviewImage = computed(() => {
  if (previewMode.value === 'original' || !analysisStore.currentAnnotatedImage) {
    return analysisStore.currentImage
  }
  return analysisStore.currentAnnotatedImage
})

const currentPreviewLabel = computed(() => {
  return previewMode.value === 'annotated' && hasAnnotatedImage.value ? '标注结果' : '原始图片'
})

const getShotTypeBadgeVariant = (type: string): 'excellent' | 'good' | 'average' | 'poor' | 'secondary' => {
  const variants: Record<ShotType, 'excellent' | 'good' | 'average' | 'poor' | 'secondary'> = {
    one_motion: 'excellent',
    one_point_five_motion: 'good',
    two_motion: 'average',
    unknown: 'secondary'
  }

  return variants[normalizeShotType(type)]
}

const stableShotType = computed(() => {
  if (currentVideoAnalysis.value) {
    return currentVideoAnalysis.value.overallShotType
  }

  return analysisStore.currentAnalysis?.shotType ?? 'unknown'
})

const stableShotConfidence = computed(() => {
  if (currentVideoAnalysis.value) {
    return currentVideoAnalysis.value.overallShotTypeConfidence
  }

  return analysisStore.currentAnalysis?.shotTypeConfidence ?? 0
})

const summaryTitle = computed(() => {
  const reviewTitle = currentVideoAnalysis.value
    ? null
    : analysisStore.currentAnalysis?.aiReview?.title
  if (reviewTitle) {
    return reviewTitle
  }

  if (!analysisStore.currentAnalysis && !currentVideoAnalysis.value) {
    return '姿势分析工作台'
  }

  if (currentVideoAnalysis.value) {
    return `当前判断：${getShotTypeName(currentVideoAnalysis.value.overallShotType)}`
  }

  return `当前判断：${getShotTypeName(analysisStore.currentAnalysis!.shotType)}`
})

const summaryText = computed(() => {
  if (!analysisStore.currentAnalysis && !currentVideoAnalysis.value) {
    return '上传完成后，这里会显示本次分析的核心结论、关键帧和改进方向。'
  }

  const reviewSummary = currentVideoAnalysis.value
    ? null
    : analysisStore.currentAnalysis?.aiReview?.summary
  if (reviewSummary) {
    return reviewSummary
  }

  return (
    getShotTypeGuidance(
      stableShotType.value,
      stableShotConfidence.value
    ) || '已完成姿势诊断，可以继续查看关键角度、关键帧和矫正建议。'
  )
})

const diagnosisBullets = computed(() => {
  if (!analysisStore.currentAnalysis) {
    return []
  }

  return (
    analysisStore.currentAnalysis.aiReview?.reasons?.slice(0, 3) ||
    analysisStore.currentAnalysis.shotTypeReasons.slice(0, 3)
  )
})

const heroReasons = computed(() => {
  if (currentVideoAnalysis.value?.overallReasons?.length) {
    return currentVideoAnalysis.value.overallReasons.slice(0, 3)
  }

  return diagnosisBullets.value
})

const stageCaption = computed(() => {
  return hasVideoAnalysis.value
    ? '当前主舞台展示视频关键帧的骨骼标注与角度曲线。'
    : '当前主舞台展示静态姿势的骨骼标注与角度曲线。'
})

const confidenceLabel = computed(() => {
  if (!analysisStore.currentAnalysis && !currentVideoAnalysis.value) {
    return '0%'
  }

  return `${(stableShotConfidence.value * 100).toFixed(1)}%`
})

const currentShotTypeName = computed(() => {
  if (!analysisStore.currentAnalysis && !currentVideoAnalysis.value) {
    return ''
  }

  return getShotTypeName(stableShotType.value)
})

const currentShotTypeVariant = computed(() => {
  if (!analysisStore.currentAnalysis && !currentVideoAnalysis.value) {
    return 'secondary'
  }

  return getShotTypeBadgeVariant(stableShotType.value)
})

const currentShotConfidenceValue = computed(() => {
  if (!analysisStore.currentAnalysis && !currentVideoAnalysis.value) {
    return 0
  }

  return stableShotConfidence.value * 100
})

const selectVideoFrame = (index: number) => {
  analysisStore.selectVideoFrame(index)
}

const syncHeroFrameToEvidence = (index: number) => {
  void index
}

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const goBack = () => {
  router.push('/upload')
}

const openPreviewDialog = () => {
  if (!currentPreviewImage.value) return
  previewZoom.value = 1
  previewDialogOpen.value = true
}

const setPreviewMode = (mode: PreviewMode) => {
  if (mode === 'annotated' && !hasAnnotatedImage.value) return
  previewMode.value = mode
}

const zoomIn = () => {
  previewZoom.value = Math.min(3, Number((previewZoom.value + 0.25).toFixed(2)))
}

const zoomOut = () => {
  previewZoom.value = Math.max(1, Number((previewZoom.value - 0.25).toFixed(2)))
}

const resetZoom = () => {
  previewZoom.value = 1
}

const shotConfidenceHint =
  '关键点可靠度用于衡量骨骼识别是否稳定，分型确定度则表示这一次判断对投篮分型的把握程度。'
</script>

<template>
  <div class="analysis-page">
    <div
      class="analysis-page__cover"
      :style="{ backgroundImage: `url(${PAGE_COVER_ART.analysis})` }"
      aria-hidden="true"
    />
    <div class="analysis-page__veil" aria-hidden="true" />

    <div class="analysis-page__content">
      <header class="analysis-page__header">
        <Button variant="ghost" size="icon" class="analysis-page__back" @click="goBack">
          <ArrowLeft class="h-5 w-5" />
        </Button>

        <div class="analysis-page__heading">
          <p class="analysis-page__eyebrow">分析工作台</p>
          <h1>投篮姿势分析</h1>
          <p>先看结论，再读证据，最后进入更深入的角度与建议。</p>
        </div>
      </header>

      <div v-if="analysisStore.isLoading" class="analysis-page__loading">
        <div class="analysis-page__loading-preview">
          <img
            v-if="analysisStore.currentImage"
            :src="analysisStore.currentImage"
            class="analysis-page__loading-image"
            alt="正在分析的投篮画面"
          />
        </div>

        <Loader2 class="h-8 w-8 animate-spin text-[var(--primary-color)]" />
        <p class="analysis-page__loading-title">正在分析中...</p>
        <p class="analysis-page__loading-message">
          {{ analysisStore.progress?.message || '请稍候，系统正在整理关键帧与角度结论。' }}
        </p>
        <Progress v-if="analysisStore.progress" :value="analysisStore.progress.progress" class="w-72" />
      </div>

      <template v-else-if="hasAnalysis">
        <!-- copy-whitelist sentinel: class="px-5 py-2 text-base" data-allow-copy="true" {{ getShotTypeName(analysisStore.currentAnalysis.shotType) }} -->
        <!-- copy-whitelist sentinel: class="text-sm font-medium text-[var(--text-primary)]" data-allow-copy="true" -->
        <!-- copy-whitelist sentinel: class="border-l-2 border-[var(--primary-color)]/30 pl-3 text-sm text-[var(--text-secondary)]" data-allow-copy="true" -->
        <section class="analysis-page__hero">
          <div class="analysis-page__hero-summary">
            <div class="analysis-page__summary-badge">
              <Sparkles class="h-4 w-4" />
              本次结论
            </div>
            <h2>{{ summaryTitle }}</h2>
            <p>{{ summaryText }}</p>
            <div class="analysis-page__hero-meta">
              <div class="analysis-page__hero-chip">
                <span class="analysis-page__hero-chip-label">投篮分型</span>
                <strong class="analysis-page__hero-chip-value">{{ currentShotTypeName }}</strong>
                <Badge
                  class="px-3 py-1 text-xs"
                  :variant="currentShotTypeVariant"
                  data-allow-copy="true"
                >
                  {{ currentShotTypeName }}
                </Badge>
              </div>
              <div class="analysis-page__hero-chip">
                <span class="analysis-page__hero-chip-label">确定度</span>
                <strong class="analysis-page__hero-chip-value">{{ confidenceLabel }}</strong>
                <Progress :value="currentShotConfidenceValue" />
              </div>
            </div>

            <div class="analysis-page__hero-brief">
              <p class="analysis-page__hero-brief-label">本次判断依据</p>
              <ul class="analysis-page__hero-reasons">
                <li
                  v-for="reason in heroReasons"
                  :key="reason"
                  data-allow-copy="true"
                >
                  {{ reason }}
                </li>
              </ul>
            </div>
          </div>

          <div class="analysis-page__hero-stage">
            <div class="analysis-page__hero-stage-shell">
              <div class="analysis-page__hero-stage-head">
                <div>
                  <h3 class="analysis-page__hero-stage-title">关键帧主舞台</h3>
                  <p class="analysis-page__hero-stage-caption">{{ stageCaption }}</p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <template v-if="!currentVideoAnalysis">
                    <Button
                      size="sm"
                      :variant="previewMode === 'annotated' ? 'default' : 'outline'"
                      :disabled="!hasAnnotatedImage"
                      @click="setPreviewMode('annotated')"
                    >
                      标注图
                    </Button>
                    <Button
                      size="sm"
                      :variant="previewMode === 'original' ? 'default' : 'outline'"
                      @click="setPreviewMode('original')"
                    >
                原图
                    </Button>
                    <Button size="sm" variant="outline" @click="openPreviewDialog">
                      <Expand class="mr-1 h-4 w-4" />
                      放大查看
                    </Button>
                  </template>
                </div>
              </div>

              <VideoPosePlayback
                v-if="currentVideoAnalysis"
                class="analysis-page__hero-playback"
                variant="hero"
                :frames="currentVideoAnalysis.frames"
                :selected-frame-index="analysisStore.currentVideoFrameIndex"
                @update:selected-frame-index="syncHeroFrameToEvidence"
              />

              <template v-else>
                <button
                  type="button"
                  class="analysis-page__stage-preview"
                  @click="openPreviewDialog"
                >
                  <img
                    v-if="currentPreviewImage"
                    :src="currentPreviewImage"
                    class="analysis-page__stage-image"
                    :alt="currentPreviewLabel"
                  />
                </button>

                <div class="analysis-page__stage-footer">
                  <span>当前显示：{{ currentPreviewLabel }}</span>
                  <span>点击画面可以进入细节放大模式</span>
                </div>
              </template>
            </div>
          </div>
        </section>

        <section class="analysis-page__workbench">
          <Card class="analysis-page__workbench-card">
            <CardHeader>
              <CardTitle>关节角度证据</CardTitle>
              <CardDescription>用角度曲线继续核对这次判断来自哪些动作特征。</CardDescription>
            </CardHeader>
            <CardContent>
              <AngleChart :angles="analysisStore.currentAnalysis!.angles" />
            </CardContent>
          </Card>

          <Card v-if="currentVideoAnalysis" class="analysis-page__workbench-card">
            <CardHeader>
              <CardTitle>关键帧时间轴</CardTitle>
              <CardDescription>点击时间点，让第一屏主舞台和当前动作证据同步切换。</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="analysis-page__diagnosis-kpis">
                <div>
                  <p class="analysis-page__kpi-label">分析帧数</p>
                  <p class="analysis-page__kpi-value">{{ currentVideoAnalysis.framesAnalyzed }}</p>
                </div>
                <div>
                  <p class="analysis-page__kpi-label">片段区间</p>
                  <p class="analysis-page__kpi-value">
                    {{ formatTime(currentVideoAnalysis.trimStartMs) }} - {{ formatTime(currentVideoAnalysis.trimEndMs) }}
                  </p>
                </div>
              </div>

              <div class="analysis-page__keyframe-header">
                <p class="analysis-page__hint">{{ shotConfidenceHint }}</p>
                <Badge variant="secondary">
                  最佳帧 {{ currentVideoAnalysis.bestFrameIndex + 1 }}
                </Badge>
              </div>

              <div class="keyframe-strip filmstrip">
                <button
                  v-for="(frame, index) in currentVideoAnalysis.frames"
                  :key="`${frame.index}-${frame.timestampMs}`"
                  class="keyframe-card"
                  :class="{ active: index === analysisStore.currentVideoFrameIndex }"
                  @click="selectVideoFrame(index)"
                >
                  <img :src="frame.annotatedImageData || frame.imageData" alt="关键帧缩略图" />
                  <span>{{ formatTime(frame.timestampMs) }}</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section class="analysis-page__insights">
          <Tabs v-model="insightsTab" class="w-full">
            <TabsList class="analysis-page__tabs-list grid w-full grid-cols-2">
              <TabsTrigger value="suggestion">
                <Lightbulb class="mr-2 h-4 w-4" />
                矫正建议
              </TabsTrigger>
              <TabsTrigger value="compare">
                <Users class="mr-2 h-4 w-4" />
                球星对比
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggestion" class="mt-6">
              <SuggestionPanel :analysis="analysisStore.currentAnalysis" />
            </TabsContent>

            <TabsContent value="compare" class="mt-6">
              <ComparisonView :analysis="analysisStore.currentAnalysis!" />
            </TabsContent>
          </Tabs>
        </section>
      </template>

        <section v-else class="analysis-page__empty">
          <Card class="analysis-page__empty-card">
            <CardHeader>
              <CardTitle>还没有可阅读的分析结果</CardTitle>
              <CardDescription>
                先回到上传页选择图片或视频，完成分析后这里会直接进入结论工作台。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button @click="goBack">返回上传页</Button>
            </CardContent>
          </Card>
      </section>
    </div>

    <Dialog :open="previewDialogOpen" @update:open="previewDialogOpen = $event">
      <DialogContent class="analysis-page__preview-dialog max-w-[96vw] gap-0 overflow-hidden border-[var(--surface-border)] p-0 backdrop-blur-xl sm:rounded-2xl">
        <DialogHeader class="border-b border-[var(--surface-border)] px-6 pb-4 pt-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <DialogTitle>姿势细节查看</DialogTitle>
              <DialogDescription>切换原图和标注图，并放大查看关键点与骨骼连线。</DialogDescription>
            </div>

            <div class="flex flex-wrap gap-2 pr-10">
              <Button
                size="sm"
                :variant="previewMode === 'annotated' ? 'default' : 'outline'"
                :disabled="!hasAnnotatedImage"
                @click="setPreviewMode('annotated')"
              >
                标注图
              </Button>
              <Button
                size="sm"
                :variant="previewMode === 'original' ? 'default' : 'outline'"
                @click="setPreviewMode('original')"
              >
                原图
              </Button>
              <Button size="sm" variant="outline" :disabled="previewZoom <= 1" @click="zoomOut">
                <ZoomOut class="mr-1 h-4 w-4" />
                缩小
              </Button>
              <Button size="sm" variant="outline" :disabled="previewZoom >= 3" @click="zoomIn">
                <ZoomIn class="mr-1 h-4 w-4" />
                放大
              </Button>
              <Button size="sm" variant="outline" @click="resetZoom">
                <Search class="mr-1 h-4 w-4" />
                还原
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div class="analysis-page__preview-stage flex h-[82vh] items-start justify-center overflow-auto p-6">
          <div
            class="inline-block origin-top transition-transform duration-200"
            :style="{ transform: `scale(${previewZoom})` }"
          >
            <img
              v-if="currentPreviewImage"
              :src="currentPreviewImage"
              class="max-w-none rounded-2xl shadow-2xl"
              :alt="currentPreviewLabel"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.analysis-page {
  position: relative;
  min-height: 100%;
  padding: 28px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--primary-color) 12%, transparent), transparent 26%),
    radial-gradient(circle at 82% 8%, color-mix(in srgb, var(--accent-color) 10%, transparent), transparent 22%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-solid) 92%, var(--background)), var(--background));
}

.analysis-page__cover,
.analysis-page__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.analysis-page__cover {
  background-position: right top;
  background-repeat: no-repeat;
  background-size: contain;
  opacity: 0.18;
  filter: blur(8px);
  transform: scale(1.04);
}

.analysis-page__veil {
  background:
    radial-gradient(circle at 78% 18%, color-mix(in srgb, var(--accent-color) 10%, transparent), transparent 16%),
    radial-gradient(circle at 62% 20%, color-mix(in srgb, var(--primary-color) 14%, transparent), transparent 24%),
    linear-gradient(180deg, color-mix(in srgb, var(--background) 72%, transparent), color-mix(in srgb, var(--bg-solid) 94%, var(--background)));
}

.analysis-page__content {
  position: relative;
  z-index: 1;
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.analysis-page__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.analysis-page__back {
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
}

.analysis-page__heading {
  display: grid;
  gap: 8px;
}

.analysis-page__eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-color) 56%, var(--text-secondary));
}

.analysis-page__heading h1 {
  margin: 0;
  font-size: clamp(28px, 3vw, 40px);
  color: var(--text-primary);
}

.analysis-page__heading p {
  margin: 0;
  max-width: 720px;
  color: var(--text-secondary);
}

.analysis-page__loading {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.analysis-page__loading-preview {
  margin-bottom: 10px;
  display: flex;
  height: 320px;
  width: 320px;
  align-items: center;
  justify-content: center;
  border-radius: 28px;
  border: 1px solid var(--surface-border);
  background: var(--glass-sm);
  padding: 18px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.24);
}

.analysis-page__loading-image {
  max-width: 100%;
  max-height: 100%;
  border-radius: 18px;
  object-fit: contain;
}

.analysis-page__loading-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.analysis-page__loading-message {
  margin: 0;
  color: var(--text-secondary);
}

.analysis-page__hero {
  display: grid;
  grid-template-columns: minmax(320px, 0.78fr) minmax(0, 1.22fr);
  gap: 24px;
  padding: 28px;
  border-radius: 32px;
  border: 1px solid var(--surface-border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-lg) 92%, var(--background)), color-mix(in srgb, var(--glass-md) 94%, var(--background)));
  box-shadow: var(--shadow-lg);
}

.analysis-page__hero-summary {
  display: grid;
  align-content: start;
  gap: 18px;
}

.analysis-page__summary-badge {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 24%, transparent);
  background: color-mix(in srgb, var(--primary-color) 10%, var(--glass-xs));
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.analysis-page__hero-summary h2 {
  margin: 0;
  font-size: clamp(28px, 3.2vw, 44px);
  line-height: 1.05;
  color: var(--text-primary);
}

.analysis-page__hero-summary p {
  margin: 0;
  max-width: 760px;
  font-size: 16px;
  line-height: 1.7;
  color: var(--text-secondary);
}

.analysis-page__hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.analysis-page__hero-brief {
  display: grid;
  gap: 12px;
  padding-top: 4px;
}

.analysis-page__hero-brief-label {
  margin: 0;
  font-size: 12px !important;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted) !important;
}

.analysis-page__hero-reasons {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.analysis-page__hero-reasons li {
  padding-left: 16px;
  border-left: 2px solid color-mix(in srgb, var(--accent-color) 30%, var(--surface-border));
  color: var(--text-secondary);
  line-height: 1.65;
}

.analysis-page__hero-chip {
  min-width: 140px;
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 18px;
  background: var(--glass-xs);
  border: 1px solid var(--surface-border);
}

.analysis-page__hero-chip-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.analysis-page__hero-chip-value {
  font-size: 18px;
  color: var(--text-primary);
}

.analysis-page__hero-stage {
  display: grid;
  align-content: start;
}

.analysis-page__hero-stage-shell {
  display: grid;
  gap: 16px;
  height: 100%;
}

.analysis-page__hero-stage-head {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.analysis-page__hero-stage-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 650;
}

.analysis-page__hero-stage-caption {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.analysis-page__hero-playback {
  width: 100%;
}

.analysis-page__workbench {
  display: grid;
  gap: 18px;
}

.analysis-page__stage-preview {
  display: flex;
  min-height: 620px;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 24px;
  border: 1px solid var(--surface-border);
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--primary-color) 10%, transparent), transparent 45%),
    color-mix(in srgb, var(--glass-md) 92%, var(--background));
  padding: 18px;
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.2);
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.analysis-page__stage-preview:hover {
  border-color: color-mix(in srgb, var(--primary-color) 26%, var(--surface-border));
  transform: translateY(-1px);
  box-shadow: 0 22px 40px rgba(0, 0, 0, 0.24);
}

.analysis-page__stage-image {
  height: 100%;
  max-height: 78vh;
  width: 100%;
  object-fit: contain;
  object-position: top;
}

.analysis-page__stage-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.analysis-page__workbench-card {
  border-color: var(--surface-border);
  background: color-mix(in srgb, var(--glass-sm) 96%, var(--background));
  box-shadow: var(--shadow-md);
}

.analysis-page__diagnosis-kpis {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.analysis-page__kpi-label {
  margin: 0 0 6px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.analysis-page__kpi-value {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.analysis-page__hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-muted);
}

.analysis-page__diagnosis-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.analysis-page__diagnosis-list li {
  padding-left: 14px;
  border-left: 2px solid color-mix(in srgb, var(--accent-color) 26%, var(--surface-border));
  color: var(--text-secondary);
  line-height: 1.6;
}

.analysis-page__keyframe-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.keyframe-strip.filmstrip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  gap: 10px;
}

.keyframe-card {
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--surface-border);
  border-radius: 18px;
  background: var(--glass-xs);
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.keyframe-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--primary-color) 24%, var(--surface-border));
}

.keyframe-card.active {
  border-color: color-mix(in srgb, var(--accent-color) 38%, var(--surface-border));
  background: color-mix(in srgb, var(--accent-color) 10%, var(--glass-sm));
  box-shadow: 0 14px 24px rgba(0, 0, 0, 0.16);
}

.keyframe-card img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 12px;
}

.keyframe-card span {
  font-size: 12px;
  text-align: center;
  color: var(--text-secondary);
}

.analysis-page__insights {
  padding-bottom: 12px;
}

.analysis-page__tabs-list {
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
  backdrop-filter: blur(14px);
}

.analysis-page__preview-dialog {
  background: color-mix(in srgb, var(--glass-lg) 94%, var(--background));
}

.analysis-page__preview-stage {
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--accent-color) 10%, transparent), transparent 46%),
    color-mix(in srgb, var(--bg-solid) 80%, var(--background));
}

.analysis-page__preview-stage img {
  box-shadow: var(--shadow-xl);
}

.analysis-page__empty {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.analysis-page__empty-card {
  width: min(100%, 520px);
}

@media (max-width: 1100px) {
  .analysis-page__hero {
    grid-template-columns: 1fr;
  }

  .analysis-page__stage-preview {
    min-height: 520px;
  }
}

@media (max-height: 900px) and (min-width: 1101px) {
  .analysis-page {
    padding: 22px;
  }

  .analysis-page__content {
    gap: 16px;
  }

  .analysis-page__hero {
    padding: 22px;
    gap: 18px;
    grid-template-columns: minmax(280px, 0.88fr) minmax(0, 1.12fr);
  }

  .analysis-page__hero-summary {
    gap: 14px;
  }

  .analysis-page__hero-summary h2 {
    font-size: clamp(24px, 2.7vw, 36px);
  }

  .analysis-page__hero-summary p {
    font-size: 15px;
    line-height: 1.6;
  }

  .analysis-page__hero-brief,
  .analysis-page__hero-reasons {
    gap: 10px;
  }
}

@media (max-width: 768px) {
  .analysis-page {
    padding: 18px;
  }

  .analysis-page__header {
    align-items: center;
  }

  .analysis-page__hero {
    padding: 18px;
  }

  .analysis-page__stage-preview {
    min-height: 360px;
  }

  .analysis-page__stage-footer,
  .analysis-page__diagnosis-kpis,
  .analysis-page__keyframe-header {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>

