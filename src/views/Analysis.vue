<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, BarChart3, Expand, Lightbulb, Loader2, Search, Upload, Users, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AngleChart from '@/components/ChartComponents/AngleChart.vue'
import ComparisonView from '@/components/ComparisonView/index.vue'
import ImageUpload from '@/components/ImageUpload/index.vue'
import SuggestionPanel from '@/components/SuggestionPanel/index.vue'
import { useAnalysisStore } from '@/stores/analysis'
import { SHOT_TYPE_NAMES, type ShotType } from '@/types'

type PreviewMode = 'annotated' | 'original'

const router = useRouter()
const analysisStore = useAnalysisStore()

const activeTab = computed({
  get: () => {
    if (!analysisStore.currentImage) return 'upload'
    return 'analysis'
  },
  set: () => { }
})

const hasImage = computed(() => !!analysisStore.currentImage)
const hasAnalysis = computed(() => !!analysisStore.currentAnalysis)
const hasAnnotatedImage = computed(() => !!analysisStore.currentAnnotatedImage)

const previewMode = ref<PreviewMode>('annotated')
const previewDialogOpen = ref(false)
const previewZoom = ref(1)

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
  return previewMode.value === 'annotated' && hasAnnotatedImage.value ? '姿势标注图' : '原始图片'
})

const normalizeShotType = (type: string): ShotType => {
  const mapping: Record<string, ShotType> = {
    oneMotion: 'one_motion',
    onePointFiveMotion: 'one_point_five_motion',
    twoMotion: 'two_motion',
    one_motion: 'one_motion',
    one_point_five_motion: 'one_point_five_motion',
    two_motion: 'two_motion',
    unknown: 'unknown',
    Unknown: 'unknown'
  }

  return mapping[type] ?? 'unknown'
}

const getShotTypeName = (type: string) => {
  return SHOT_TYPE_NAMES[normalizeShotType(type)]
}

const getShotTypeBadgeVariant = (type: string): 'excellent' | 'good' | 'average' | 'poor' | 'secondary' => {
  const variants: Record<ShotType, 'excellent' | 'good' | 'average' | 'poor' | 'secondary'> = {
    one_motion: 'excellent',
    one_point_five_motion: 'good',
    two_motion: 'average',
    unknown: 'secondary'
  }

  return variants[normalizeShotType(type)]
}

const handleImageLoaded = async (imageData: string) => {
  try {
    await analysisStore.analyzeImage(imageData)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`分析失败: ${message}`)
  }
}

const goBack = () => {
  router.push('/')
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
  '关键点可靠度衡量骨骼点识别稳定性，分型确定度衡量当前这张图对投篮分型判断的把握。'
</script>

<template>
  <div class="min-h-screen bg-background">
    <div class="border-b border-[var(--surface-border)] bg-[var(--glass-sm)] backdrop-blur-sm">
      <div class="container mx-auto px-6">
        <div class="flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" @click="goBack">
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <h1 class="text-lg font-semibold text-[var(--text-primary)]">姿势分析</h1>
        </div>
      </div>
    </div>

    <div class="container mx-auto flex-1 px-6 py-6">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-4 bg-[var(--glass-sm)] backdrop-blur-sm">
          <TabsTrigger value="upload">
            <Upload class="mr-2 h-4 w-4" />
            上传图片
          </TabsTrigger>
          <TabsTrigger value="analysis" :disabled="!hasImage">
            <BarChart3 class="mr-2 h-4 w-4" />
            姿势分析
          </TabsTrigger>
          <TabsTrigger value="compare" :disabled="!hasAnalysis">
            <Users class="mr-2 h-4 w-4" />
            球星对比
          </TabsTrigger>
          <TabsTrigger value="suggestion" :disabled="!hasAnalysis">
            <Lightbulb class="mr-2 h-4 w-4" />
            矫正建议
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" class="mt-6">
          <div class="mx-auto max-w-2xl">
            <ImageUpload :loading="analysisStore.isLoading" @image-loaded="handleImageLoaded" />
          </div>
        </TabsContent>

        <TabsContent value="analysis" class="mt-6">
          <div v-if="analysisStore.isLoading" class="flex flex-col items-center justify-center py-20">
            <div class="mb-8 flex h-80 w-80 items-center justify-center rounded-3xl border border-[var(--surface-border)] bg-[var(--glass-sm)] p-4 shadow-[var(--shadow-lg)]">
              <img
                v-if="analysisStore.currentImage"
                :src="analysisStore.currentImage"
                class="max-h-full max-w-full rounded-2xl object-contain"
                alt="正在分析的投篮图片"
              />
            </div>

            <Loader2 class="mb-4 h-8 w-8 animate-spin text-[var(--primary-color)]" />
            <p class="text-lg font-medium text-[var(--text-primary)]">正在分析中...</p>
            <p class="mt-1 text-sm text-[var(--text-secondary)]">
              {{ analysisStore.progress?.message || '请稍候' }}
            </p>
            <Progress v-if="analysisStore.progress" :value="analysisStore.progress.progress" class="mt-5 w-72" />
          </div>

          <div v-else-if="analysisStore.currentAnalysis" class="grid gap-6 xl:grid-cols-[minmax(460px,0.9fr)_minmax(540px,1.1fr)]">
            <Card class="overflow-hidden">
              <CardHeader class="space-y-4">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>投篮姿势可视化</CardTitle>
                    <CardDescription>放大展示关键点和骨骼连线，默认优先显示标注结果。</CardDescription>
                  </div>

                  <div class="flex flex-wrap gap-2">
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
                      查看大图
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent class="space-y-3">
                <button
                  type="button"
                  class="group flex min-h-[720px] w-full items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_45%),var(--glass-xs)] p-4 shadow-[var(--shadow-md)] transition-all hover:border-[rgba(99,102,241,0.35)] hover:shadow-[var(--shadow-lg)]"
                  @click="openPreviewDialog"
                >
                  <img
                    v-if="currentPreviewImage"
                    :src="currentPreviewImage"
                    class="h-full max-h-[78vh] w-full object-contain object-top transition-transform duration-300 group-hover:scale-[1.01]"
                    :alt="currentPreviewLabel"
                  />
                </button>

                <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>当前显示: {{ currentPreviewLabel }}</span>
                  <span>点击图片可放大查看细节</span>
                </div>
              </CardContent>
            </Card>

            <div class="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>投篮类型</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="flex flex-wrap items-center gap-4">
                    <Badge :variant="getShotTypeBadgeVariant(analysisStore.currentAnalysis.shotType)" class="px-5 py-2 text-base">
                      {{ getShotTypeName(analysisStore.currentAnalysis.shotType) }}
                    </Badge>
                    <div class="flex items-center gap-3">
                      <span class="text-sm text-[var(--text-secondary)]">分型确定度</span>
                      <Progress :value="analysisStore.currentAnalysis.shotTypeConfidence * 100" class="w-28" />
                      <span class="text-sm font-medium text-[var(--text-primary)]">
                        {{ (analysisStore.currentAnalysis.shotTypeConfidence * 100).toFixed(1) }}%
                      </span>
                    </div>
                  </div>

                  <p class="mt-3 text-xs leading-6 text-[var(--text-muted)]">
                    {{ shotConfidenceHint }}
                  </p>

                  <Separator class="my-4" />

                  <div class="space-y-2">
                    <p
                      v-for="reason in analysisStore.currentAnalysis.shotTypeReasons"
                      :key="reason"
                      class="border-l-2 border-[var(--primary-color)]/30 pl-3 text-sm text-[var(--text-secondary)]"
                    >
                      {{ reason }}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>关节角度数据</CardTitle>
                </CardHeader>
                <CardContent>
                  <AngleChart :angles="analysisStore.currentAnalysis.angles" />
                </CardContent>
              </Card>
            </div>
          </div>

          <div v-else class="py-16 text-center">
            <p class="text-[var(--text-muted)]">请先上传图片进行分析</p>
          </div>
        </TabsContent>

        <TabsContent value="compare" class="mt-6">
          <ComparisonView v-if="analysisStore.currentAnalysis" :analysis="analysisStore.currentAnalysis" />
        </TabsContent>

        <TabsContent value="suggestion" class="mt-6">
          <SuggestionPanel v-if="analysisStore.currentAnalysis" :analysis="analysisStore.currentAnalysis" />
        </TabsContent>
      </Tabs>
    </div>

    <Dialog :open="previewDialogOpen" @update:open="previewDialogOpen = $event">
      <DialogContent class="max-w-[96vw] gap-0 overflow-hidden border-[var(--surface-border)] bg-[var(--glass-lg)] p-0 backdrop-blur-xl sm:rounded-2xl">
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

        <div class="flex h-[82vh] items-start justify-center overflow-auto bg-black/90 p-6">
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
