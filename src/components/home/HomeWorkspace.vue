<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  ArrowRight,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Film,
  Loader2,
  Sparkles,
  Upload
} from 'lucide-vue-next'
import ImageUpload from '@/components/ImageUpload/index.vue'
import VideoUpload from '@/components/VideoUpload/index.vue'
import VideoPosePlayback from '@/components/VideoPosePlayback.vue'
import ComparisonView from '@/components/ComparisonView/index.vue'
import SuggestionPanel from '@/components/SuggestionPanel/index.vue'
import AngleChart from '@/components/ChartComponents/AngleChart.vue'
import HomeModuleGem from '@/components/HomeModuleGem.vue'
import HomeWorkspaceHeroArt from '@/components/home/HomeWorkspaceHeroArt.vue'
import { useAnalysisStore } from '@/stores/analysis'
import { getAiReviewState } from '@/lib/ai-analysis-flow.js'
import {
  getShotTypeGuidance,
  getShotTypeName,
  normalizeShotType,
  type ShotAnalysis,
  type ShotType
} from '@/types'

const analysisStore = useAnalysisStore()
const emit = defineEmits<{
  uploadWorkspaceLockChange: [locked: boolean]
  scrollSnapSuppressedChange: [suppressed: boolean]
}>()
const isGeneratingAiReview = ref(false)

const showUpload = ref(false)
const uploadMode = ref<'image' | 'video'>('image')
const activeModule = ref<'upload' | 'analysis' | 'compare' | 'suggestion'>('upload')
const showImageLeft = ref(false)
const videoPreviewUrl = ref('')

const hasAnalysis = computed(() => !!analysisStore.currentAnalysis)
const visualizedImage = computed(() => analysisStore.currentAnnotatedImage || analysisStore.currentImage)
const isUploadWorkspaceLocked = computed(() => showUpload.value && activeModule.value === 'upload')
const shouldSuppressScrollSnap = computed(() => activeModule.value !== 'upload')
const currentVideoAnalysis = computed(() => analysisStore.currentVideoAnalysis)
const currentVideoFrame = computed(() => {
  const analysis = currentVideoAnalysis.value
  if (!analysis?.frames.length) return null

  return analysis.frames[analysisStore.currentVideoFrameIndex]
    ?? analysis.frames[analysis.bestFrameIndex]
    ?? analysis.frames[0]
})
const isAnalysisWorkspace = computed(() => activeModule.value === 'analysis' && (analysisStore.isLoading || hasAnalysis.value))
const headerSubtitle = computed(() => {
  if (!isAnalysisWorkspace.value) {
    return '支持单张图片和短视频片段。图片适合快速看姿态，视频更适合看举球、准备出手前停球位置、出手节奏和整段分型。'
  }

  return currentVideoAnalysis.value
    ? '视频动作工作台已就绪：左侧看动态骨骼和关键帧，右侧看片段总览、当前诊断和角度数据。'
    : '单帧分析工作台已就绪：左侧看姿态可视化，右侧看分型判断、说明和角度数据。'
})

watch(
  () => analysisStore.currentAnalysis,
  val => {
    if (val) {
      showImageLeft.value = false
      activeModule.value = 'analysis'
      window.setTimeout(() => {
        showImageLeft.value = true
      }, 120)
    }
  }
)

watch(
  () => analysisStore.isLoading,
  loading => {
    if (loading) {
      showImageLeft.value = false
      activeModule.value = 'analysis'
    }
  }
)

watch(
  isUploadWorkspaceLocked,
  locked => {
    emit('uploadWorkspaceLockChange', locked)
  },
  { immediate: true }
)

watch(
  shouldSuppressScrollSnap,
  suppressed => {
    emit('scrollSnapSuppressedChange', suppressed)
  },
  { immediate: true }
)

const modules = [
  { key: 'upload', title: '上传素材', kind: 'upload' },
  { key: 'analysis', title: '姿势分析', kind: 'analysis' },
  { key: 'compare', title: '球星对比', kind: 'compare' },
  { key: 'suggestion', title: '矫正建议', kind: 'suggestion' }
] as const

const analysisSteps = [
  { key: 'detect', label: '姿态识别' },
  { key: 'angles', label: '角度分析' },
  { key: 'classify', label: '语义评审' },
  { key: 'compare', label: '结果总结' }
]

const shotConfidenceHint =
  '置信度表示当前图片或关键帧有多适合做分型判断。越接近准备出手前停球位置，越容易区分一段式、1.5 段式和二段式。'

const openUpload = (mode: 'image' | 'video') => {
  uploadMode.value = mode
  showUpload.value = true
}

const handleImageLoaded = async (imageData: string) => {
  videoPreviewUrl.value = ''
  try {
    await analysisStore.analyzeImage(imageData)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`图片分析失败：${message}`)
  }
}

const handleVideoLoaded = async (payload: {
  filePath: string
  previewUrl: string
  trimStartMs: number
  trimEndMs: number
}) => {
  videoPreviewUrl.value = payload.previewUrl
  try {
    await analysisStore.analyzeVideo(payload.filePath, payload.trimStartMs, payload.trimEndMs)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`视频分析失败：${message}`)
  }
}

const selectModule = (key: string) => {
  if ((key === 'compare' || key === 'suggestion') && !hasAnalysis.value) return
  activeModule.value = key as 'upload' | 'analysis' | 'compare' | 'suggestion'
}

const selectVideoFrame = (index: number) => {
  analysisStore.selectVideoFrame(index)
}

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const getActiveReview = (analysis: ShotAnalysis | null) => analysis?.aiReview ?? null

const getDisplayedShotType = (analysis: ShotAnalysis | null): ShotType => {
  const review = getActiveReview(analysis)
  return normalizeShotType(review?.shotType ?? analysis?.shotType)
}

const getDisplayedTitle = (analysis: ShotAnalysis | null) => {
  const review = getActiveReview(analysis)
  if (review?.title?.trim()) return review.title
  return getShotTypeName(analysis?.shotType)
}

const getDisplayedSummary = (analysis: ShotAnalysis | null) => {
  return getActiveReview(analysis)?.summary ?? ''
}

const getDisplayedReasons = (analysis: ShotAnalysis | null) => {
  const review = getActiveReview(analysis)
  if (review?.reasons?.length) return review.reasons
  return analysis?.shotTypeReasons ?? []
}

const getCoachReasons = (analysis: ShotAnalysis | null) => {
  const review = getActiveReview(analysis)
  const reasons = getDisplayedReasons(analysis)

  if (!review) return reasons
  if (review.phase === 'follow_through' || review.phase === 'release') {
    return reasons.slice(0, 4)
  }

  return reasons
}

const getDisplayedConfidence = (analysis: ShotAnalysis | null) => {
  const review = getActiveReview(analysis)
  return review?.shotTypeConfidence ?? analysis?.shotTypeConfidence ?? 0
}

const getShotTypeGuidanceText = (analysis: ShotAnalysis | null) => {
  if (!analysis) return ''
  const review = getActiveReview(analysis)
  return getShotTypeGuidance(review?.shotType ?? analysis.shotType, getDisplayedConfidence(analysis))
}

const getConfidenceLabel = (analysis: ShotAnalysis | null) => {
  const review = getActiveReview(analysis)
  if (review) {
    return review.decisionMode === 'confirmed' ? '置信度' : '参考值'
  }

  return getDisplayedShotType(analysis) === 'unknown' ? '参考值' : '置信度'
}

const getShotTypeBadgeVariant = (
  analysis: ShotAnalysis | null
): 'excellent' | 'good' | 'average' | 'poor' | 'secondary' => {
  const variantsByType: Record<ShotType, 'excellent' | 'good' | 'average' | 'poor' | 'secondary'> = {
    one_motion: 'excellent',
    one_point_five_motion: 'good',
    two_motion: 'average',
    unknown: 'secondary'
  }

  return variantsByType[getDisplayedShotType(analysis)]
}

const getPhaseLabel = (phase?: string | null) => {
  const phaseMap: Record<string, string> = {
    gather: '举球阶段',
    set_point: '准备出手前停球位置',
    release: '出手瞬间',
    follow_through: '随挥阶段',
    unknown: '阶段待确认'
  }

  if (!phase) return '阶段待确认'
  return phaseMap[phase] ?? phase
}

const getReviewSourceLabel = (analysis: ShotAnalysis | null) => {
  if (!analysis) {
    return '本地分析'
  }

  if (getAiReviewState(analysis) === 'cached') {
    return analysisStore.currentHistoryId ? '本地缓存 AI' : 'AI 点评'
  }

  return '本地分析'
}

const aiReviewActionLabel = computed(() => {
  if (isGeneratingAiReview.value) {
    return '生成中...'
  }

  return analysisStore.currentAnalysis?.aiReview ? '重新生成 AI 点评' : '生成 AI 点评'
})

const handleAiReview = async () => {
  if (!analysisStore.currentAnalysis || isGeneratingAiReview.value) {
    return
  }

  isGeneratingAiReview.value = true

  try {
    await analysisStore.generateAiReview({
      force: Boolean(analysisStore.currentAnalysis.aiReview)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`AI 点评生成失败: ${message}`)
  } finally {
    isGeneratingAiReview.value = false
  }
}
</script>

<template>
  <div
    class="home-page"
    :class="{
      'workspace-page': isAnalysisWorkspace,
      'focused-workspace': showUpload,
      'loaded-upload-workspace': showUpload && activeModule === 'upload'
    }"
  >
    <div class="home-container" :class="{ 'workspace-container': isAnalysisWorkspace }">
      <section class="analysis-hero-shell" :class="{ compact: isAnalysisWorkspace, focused: showUpload }">
        <HomeWorkspaceHeroArt
          class="analysis-hero-art"
          :compact="isAnalysisWorkspace"
          :focused="showUpload"
        />

        <div class="analysis-hero-copy">
          <header class="home-header" :class="{ compact: isAnalysisWorkspace }">
            <Badge variant="default" class="header-badge">
              <Sparkles class="mr-1.5 h-3.5 w-3.5" />
              AI 智能分析
            </Badge>
            <h1 class="header-title">投篮姿势分析</h1>
            <p class="header-subtitle" :class="{ compact: isAnalysisWorkspace }">
              {{ headerSubtitle }}
            </p>
            <label class="auto-ai-toggle">
              <input
                class="auto-ai-toggle-input"
                :checked="analysisStore.autoAiAnalysisEnabled"
                type="checkbox"
                @change="analysisStore.setAutoAiAnalysisEnabled(($event.target as HTMLInputElement).checked)"
              />
              <span
                class="auto-ai-toggle-switch"
                :class="{ active: analysisStore.autoAiAnalysisEnabled }"
                aria-hidden="true"
              >
                <span class="auto-ai-toggle-thumb"></span>
              </span>
              <span class="auto-ai-toggle-label">自动 AI 点评</span>
            </label>
          </header>

          <nav class="module-nav" :class="{ compact: isAnalysisWorkspace }" aria-label="home modules">
            <HomeModuleGem
              v-for="mod in modules"
              :key="mod.key"
              :kind="mod.kind"
              :title="mod.title"
              :active="activeModule === mod.key"
              :disabled="(mod.key === 'compare' || mod.key === 'suggestion') && !hasAnalysis"
              @select="selectModule(mod.key)"
            />
          </nav>
        </div>
      </section>

      <main class="module-content">
        <section v-show="activeModule === 'upload'" class="upload-section" :class="{ 'active-upload': showUpload }">
          <div class="upload-stage" :class="{ focused: showUpload }">
            <div v-if="!showUpload" class="upload-choice-grid">
            <Card class="choice-card">
              <CardContent class="choice-card-content">
                <div class="choice-icon-wrap image">
                  <Camera class="h-7 w-7" />
                </div>
                <h3 class="choice-title">上传图片</h3>
                <p class="choice-text">适合快速看单帧姿态、角度和当前动作是否更像一段式或二段式。</p>
                <Button size="lg" class="choice-btn" @click="openUpload('image')">
                  选择图片
                  <ArrowRight class="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card class="choice-card video">
              <CardContent class="choice-card-content">
                <div class="choice-icon-wrap video">
                  <Film class="h-7 w-7" />
                </div>
                <h3 class="choice-title">上传视频</h3>
                <p class="choice-text">支持裁剪片段并做 MediaPipe 动态骨骼分析，更适合看节奏、关键帧和整段动作。</p>
                <Button size="lg" class="choice-btn" @click="openUpload('video')">
                  选择视频
                  <ArrowRight class="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div v-else class="upload-area wide">
            <div class="upload-switch-wrap">
              <div
                class="upload-switch"
                :style="{ '--toggle-index': uploadMode === 'image' ? 0 : 1 }"
              >
                <span class="upload-switch-thumb" aria-hidden="true"></span>
                <button class="upload-switch-btn" :class="{ active: uploadMode === 'image' }" @click="uploadMode = 'image'">
                  <Camera class="h-4 w-4" />
                  图片
                </button>
                <button class="upload-switch-btn" :class="{ active: uploadMode === 'video' }" @click="uploadMode = 'video'">
                  <Film class="h-4 w-4" />
                  视频
                </button>
              </div>
            </div>

            <ImageUpload
              v-if="uploadMode === 'image'"
              :loading="analysisStore.isLoading"
              @image-loaded="handleImageLoaded"
            />
            <VideoUpload
              v-else
              :compact="showUpload"
              :loading="analysisStore.isLoading"
              @video-loaded="handleVideoLoaded"
            />
          </div>
          </div>
        </section>

        <section v-show="activeModule === 'analysis'" class="analysis-section">
          <div v-if="analysisStore.isLoading" class="analysis-loading">
            <div class="loading-visual-wrapper">
              <video
                v-if="videoPreviewUrl && !analysisStore.currentImage"
                :src="videoPreviewUrl"
                class="loading-video"
                muted
                playsinline
                autoplay
                loop
              ></video>
              <img
                v-else-if="analysisStore.currentImage"
                :src="analysisStore.currentImage"
                class="loading-image"
                alt="分析素材预览"
              />
              <div class="scan-line"></div>
            </div>

            <div class="loading-info">
              <Loader2 class="loading-spinner" />
              <p class="loading-title">正在分析你的投篮动作</p>
              <p class="loading-message">AI 正在读取素材并提取关键姿态，请稍等片刻。</p>
              <Progress
                v-if="analysisStore.progress"
                :value="analysisStore.progress.progress"
                class="loading-progress"
              />

              <div class="loading-steps">
                <div
                  v-for="step in analysisSteps"
                  :key="step.key"
                  class="step-item active"
                >
                  <CheckCircle2 class="step-icon" />
                  <span>{{ step.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else-if="analysisStore.currentAnalysis"
            class="analysis-result"
            :class="{ 'video-workspace': currentVideoAnalysis }"
          >
            <div class="result-main" :class="{ visible: showImageLeft }">
              <VideoPosePlayback
                v-if="currentVideoAnalysis"
                class="workspace-playback"
                :frames="currentVideoAnalysis ? currentVideoAnalysis.frames : []"
                :selected-frame-index="analysisStore.currentVideoFrameIndex"
              />

              <Card class="image-card" :class="{ secondary: currentVideoAnalysis }">
                <CardHeader class="analysis-card-header">
                  <div class="analysis-title-row">
                    <CardTitle class="image-title">
                      <CheckCircle2 class="h-4 w-4 text-[var(--accent-color)]" />
                      {{ currentVideoAnalysis ? '当前关键帧姿态' : '姿态可视化' }}
                    </CardTitle>
                    <Badge v-if="currentVideoAnalysis && currentVideoFrame" variant="secondary" class="phase-badge">
                      {{ formatTime(currentVideoFrame.timestampMs) }}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="image-container" :class="{ tall: !currentVideoAnalysis, focus: currentVideoAnalysis }">
                    <img
                      v-if="visualizedImage"
                      :src="visualizedImage"
                      class="pose-image"
                      alt="姿态可视化预览"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div class="result-data" :class="{ visible: showImageLeft }">
              <Card v-if="currentVideoAnalysis" class="data-card video-overview-card">
                <CardHeader class="analysis-card-header">
                  <div class="analysis-title-row">
                    <div>
                      <CardTitle>片段总览</CardTitle>
                      <p class="card-caption">先看整段动作结论，再切换关键帧看细节。</p>
                    </div>
                    <Badge variant="secondary" class="phase-badge">
                      {{ formatTime(currentVideoAnalysis.trimStartMs) }} - {{ formatTime(currentVideoAnalysis.trimEndMs) }}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="video-overview-top">
                    <div class="video-summary-chip">
                      <span class="video-summary-label">整体分型</span>
                      <strong class="video-summary-value" data-allow-copy="true">
                        {{ getShotTypeName(currentVideoAnalysis.overallShotType) }}
                      </strong>
                    </div>
                    <div class="video-summary-chip">
                      <span class="video-summary-label">置信度</span>
                      <strong class="video-summary-value" data-allow-copy="true">
                        {{ (currentVideoAnalysis.overallShotTypeConfidence * 100).toFixed(1) }}%
                      </strong>
                    </div>
                    <div class="video-summary-chip">
                      <span class="video-summary-label">分析帧数</span>
                      <strong class="video-summary-value" data-allow-copy="true">
                        {{ currentVideoAnalysis.framesAnalyzed }}
                      </strong>
                    </div>
                  </div>

                  <div class="video-overview-reasons">
                    <p class="section-kicker">片段判断</p>
                    <p
                      v-for="reason in currentVideoAnalysis.overallReasons"
                      :key="reason"
                      class="reason-item solid"
                      data-allow-copy="true"
                    >
                      {{ reason }}
                    </p>
                  </div>

                  <Separator class="my-4" />

                  <div class="keyframe-header">
                    <div>
                      <p class="section-kicker">关键帧时间轴</p>
                      <p class="card-caption">点选时间点，左侧主画面和诊断会同步切换。</p>
                    </div>
                    <Badge variant="secondary" class="phase-badge">
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

              <Card class="data-card featured">
                <CardHeader class="analysis-card-header">
                  <div class="analysis-title-row">
                    <div>
                      <CardTitle>{{ currentVideoAnalysis ? '当前帧诊断' : '分型评审' }}</CardTitle>
                      <p class="card-caption">
                        {{ currentVideoAnalysis ? '结合当前选中关键帧，给出更像教练讲解的判断。' : '根据当前单帧姿态，给出分型判断和训练提示。' }}
                      </p>
                    </div>
                    <div class="analysis-actions">
                      <Badge variant="secondary" class="source-badge">
                        <BrainCircuit class="h-3.5 w-3.5" />
                        {{ getReviewSourceLabel(analysisStore.currentAnalysis) }}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        class="ai-review-button"
                        :disabled="isGeneratingAiReview"
                        @click="handleAiReview"
                      >
                        <Loader2 v-if="isGeneratingAiReview" class="mr-1.5 h-4 w-4 animate-spin" />
                        <BrainCircuit v-else class="mr-1.5 h-4 w-4" />
                        {{ aiReviewActionLabel }}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="shot-type-row">
                    <div class="shot-type-meta">
                      <Badge
                        :variant="getShotTypeBadgeVariant(analysisStore.currentAnalysis)"
                        class="shot-type-badge"
                        data-allow-copy="true"
                      >
                        {{ getDisplayedTitle(analysisStore.currentAnalysis) }}
                      </Badge>

                      <Badge variant="secondary" class="phase-badge">
                        {{ getPhaseLabel(getActiveReview(analysisStore.currentAnalysis)?.phase) }}
                      </Badge>
                    </div>

                    <div class="confidence-row">
                      <span class="confidence-label">
                        {{ getConfidenceLabel(analysisStore.currentAnalysis) }}
                      </span>
                      <Progress
                        :value="getDisplayedConfidence(analysisStore.currentAnalysis) * 100"
                        class="confidence-bar"
                      />
                      <span class="confidence-value" data-allow-copy="true">
                        {{ (getDisplayedConfidence(analysisStore.currentAnalysis) * 100).toFixed(1) }}%
                      </span>
                    </div>
                  </div>

                  <p class="confidence-hint">
                    {{ shotConfidenceHint }}
                  </p>

                  <div v-if="getDisplayedSummary(analysisStore.currentAnalysis)" class="analysis-summary">
                    <p class="summary-label">整体判断</p>
                    <p class="summary-text" data-allow-copy="true">
                      {{ getDisplayedSummary(analysisStore.currentAnalysis) }}
                    </p>
                  </div>

                  <div
                    v-if="getShotTypeGuidanceText(analysisStore.currentAnalysis)"
                    class="guidance-note"
                  >
                    <p class="guidance-label">分型说明</p>
                    <p class="guidance-text" data-allow-copy="true">
                      {{ getShotTypeGuidanceText(analysisStore.currentAnalysis) }}
                    </p>
                  </div>

                  <Separator class="my-3" />

                  <div class="reasons-list">
                    <p
                      v-for="(reason, index) in getCoachReasons(analysisStore.currentAnalysis)"
                      :key="reason"
                      class="reason-item"
                      data-allow-copy="true"
                      :style="{ animationDelay: `${index * 100}ms` }"
                    >
                      {{ reason }}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card class="data-card chart-card">
                <CardHeader class="analysis-card-header">
                  <div>
                    <CardTitle>角度数据</CardTitle>
                    <p class="card-caption">
                      {{ currentVideoAnalysis ? '当前选中关键帧的关节角度数据。' : '当前姿态的关节角度数据。' }}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <AngleChart :angles="analysisStore.currentAnalysis!.angles" />
                </CardContent>
              </Card>
            </div>
          </div>

          <div v-else class="analysis-empty">
            <Upload class="empty-icon" />
            <p class="empty-text">请先上传图片或视频进行分析</p>
            <Button class="empty-btn" @click="activeModule = 'upload'">上传素材</Button>
          </div>
        </section>

        <section v-show="activeModule === 'compare'" class="compare-section">
          <ComparisonView v-if="analysisStore.currentAnalysis" :analysis="analysisStore.currentAnalysis" />
          <div v-else class="section-empty">
            <p>请先完成一次分析</p>
          </div>
        </section>

        <section v-show="activeModule === 'suggestion'" class="suggestion-section">
          <SuggestionPanel v-if="analysisStore.currentAnalysis" :analysis="analysisStore.currentAnalysis" />
          <div v-else class="section-empty">
            <p>请先完成一次分析</p>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  --primary-color: #8d98ff;
  --primary-hover: #aab2ff;
  --primary-active: #7887f3;
  --accent-color: #7fe0ff;
  --accent-hover: #58c8f0;

  --surface-color: rgba(12, 15, 24, 0.72);
  --surface-border: rgba(255, 255, 255, 0.12);
  --card-bg: rgba(18, 21, 31, 0.76);

  --glass-xs: rgba(255, 255, 255, 0.03);
  --glass-sm: rgba(255, 255, 255, 0.07);
  --glass-md: rgba(255, 255, 255, 0.11);
  --glass-lg: rgba(255, 255, 255, 0.15);

  --text-primary: var(--hero-text);
  --text-secondary: rgba(223, 229, 238, 0.78);
  --text-muted: rgba(177, 186, 204, 0.58);
  --text-inverse: #06070d;

  --border-color: rgba(141, 152, 255, 0.22);
  --border-light: rgba(255, 255, 255, 0.14);
  --divider-color: rgba(255, 255, 255, 0.08);

  --shadow-sm: 0 10px 24px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --shadow-md: 0 18px 40px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --shadow-lg: 0 24px 56px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --shadow-xl: 0 34px 84px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  --inset-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --inset-depth: inset 0 -1px 0 rgba(0, 0, 0, 0.32);

  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 24px clamp(56px, 8vh, 96px);
  position: relative;
  isolation: isolate;
  color: var(--text-primary);
  background:
    radial-gradient(circle at top, rgba(113, 133, 201, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(6, 8, 14, 0.72), rgba(5, 7, 12, 0.92));
}

.home-page::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: min(26rem, 42vh);
  background:
    radial-gradient(circle at 50% 0%, rgba(126, 148, 224, 0.16), transparent 60%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 78%);
  pointer-events: none;
  z-index: 0;
}

.home-page.workspace-page {
  padding-top: 16px;
  padding-bottom: clamp(72px, 10vh, 132px);
}

.home-page.focused-workspace {
  padding-bottom: clamp(48px, 7vh, 88px);
}

.home-page.loaded-upload-workspace {
  padding-top: 12px;
  padding-bottom: clamp(28px, 4vh, 56px);
}

.home-page.loaded-upload-workspace .home-header {
  display: none;
}

.home-page.loaded-upload-workspace .module-nav {
  display: none;
}

.home-page.loaded-upload-workspace .analysis-hero-shell {
  display: none;
}

.home-container {
  max-width: 1320px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  z-index: 1;
}

.analysis-hero-shell {
  position: relative;
  overflow: hidden;
  margin-bottom: 8px;
  padding: 28px 24px 12px;
  min-height: 364px;
  border-radius: 34px;
  border: 1px solid rgba(129, 140, 248, 0.12);
  background:
    radial-gradient(circle at 72% 18%, rgba(111, 133, 214, 0.14), transparent 20%),
    linear-gradient(180deg, rgba(16, 18, 29, 0.92), rgba(10, 12, 20, 0.96));
  box-shadow:
    0 30px 70px rgba(4, 7, 14, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.analysis-hero-copy {
  position: relative;
  z-index: 1;
}

.analysis-hero-art {
  position: absolute;
  right: 20px;
  bottom: 0;
}

.analysis-hero-shell.compact {
  min-height: 316px;
  padding-bottom: 8px;
}

.home-page.focused-workspace .analysis-hero-shell {
  min-height: 220px;
  padding: 18px 20px 10px;
}

.home-header {
  text-align: center;
  margin-bottom: 18px;
}

.home-header.compact {
  display: grid;
  justify-items: start;
  text-align: left;
  gap: 8px;
  margin-bottom: 14px;
}

.home-page.focused-workspace .home-header.compact {
  gap: 4px;
  margin-bottom: 10px;
}

.header-badge {
  margin-bottom: 12px;
  padding: 6px 14px;
  font-size: 13px;
}

.header-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -0.02em;
}

.header-subtitle {
  font-size: 15px;
  color: var(--text-secondary);
  max-width: 760px;
  margin: 0 auto;
  line-height: 1.7;
}

.header-subtitle.compact {
  max-width: 980px;
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
}

.home-page.focused-workspace .header-badge {
  margin-bottom: 8px;
  padding: 5px 12px;
}

.home-page.focused-workspace .header-title {
  font-size: 28px;
  margin-bottom: 4px;
}

.home-page.focused-workspace .header-subtitle.compact {
  max-width: 860px;
  font-size: 13px;
  line-height: 1.55;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.auto-ai-toggle {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.1)),
    linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(129, 140, 248, 0.04));
  color: var(--text-secondary);
  font-size: 13px;
  box-shadow:
    0 12px 28px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  cursor: pointer;
}

.home-page.focused-workspace .auto-ai-toggle {
  gap: 10px;
  margin-top: 6px;
  padding: 8px 12px;
}

.auto-ai-toggle:hover {
  border-color: rgba(129, 140, 248, 0.28);
  box-shadow:
    0 14px 32px rgba(99, 102, 241, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.48);
}

.auto-ai-toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.auto-ai-toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 48px;
  height: 28px;
  padding: 3px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08)),
    rgba(148, 163, 184, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 6px 16px rgba(15, 23, 42, 0.08);
  transition:
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.auto-ai-toggle-switch.active {
  border-color: rgba(129, 140, 248, 0.3);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08)),
    linear-gradient(135deg, rgba(99, 102, 241, 0.42), rgba(129, 140, 248, 0.28));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.36),
    0 8px 18px rgba(99, 102, 241, 0.2);
}

.auto-ai-toggle-thumb {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(232, 236, 255, 0.88));
  box-shadow:
    0 4px 10px rgba(15, 23, 42, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.75);
  transform: translateX(0);
  transition: transform 180ms ease;
}

.auto-ai-toggle-switch.active .auto-ai-toggle-thumb {
  transform: translateX(20px);
}

.auto-ai-toggle-label {
  font-weight: 600;
  letter-spacing: 0.01em;
}

.module-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(12px, 1.8vw, 18px);
  width: min(100%, 980px);
  margin: 0 auto 24px;
}

.module-nav.compact {
  width: 100%;
  margin-bottom: 24px;
  gap: 12px;
}

.home-page.focused-workspace .module-nav.compact {
  margin-bottom: 16px;
  gap: 10px;
}

.module-nav.compact :deep(.home-module-gem) {
  min-height: 116px;
  padding: 12px 12px 10px;
  border-radius: 20px;
  gap: 8px;
}

.home-page.focused-workspace .module-nav.compact :deep(.home-module-gem) {
  min-height: 102px;
  padding: 10px 10px 8px;
  gap: 6px;
}

.module-nav.compact :deep(.gem-icon) {
  width: min(100%, 104px);
}

.home-page.focused-workspace .module-nav.compact :deep(.gem-icon) {
  width: min(100%, 88px);
}

.module-nav.compact :deep(.gem-title) {
  font-size: 15px;
}

.home-page.focused-workspace .module-nav.compact :deep(.gem-title) {
  font-size: 14px;
}

.module-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.upload-section {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(10px, 1.6vh, 18px) 0 clamp(48px, 7vh, 96px);
}

.upload-section.active-upload {
  padding: clamp(8px, 1.4vh, 16px) 0 clamp(72px, 10vh, 132px);
}

.home-page.focused-workspace .upload-section.active-upload {
  padding: 4px 0 clamp(40px, 6vh, 72px);
}

.home-page.loaded-upload-workspace .upload-section.active-upload {
  padding: 0 0 clamp(28px, 4vh, 56px);
}

.upload-stage {
  position: relative;
  width: 100%;
  max-width: 1140px;
  min-height: min(680px, calc(100vh - 176px));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 18px;
  padding: clamp(16px, 2.2vh, 24px) 16px clamp(52px, 7vh, 96px);
}

.upload-stage::before {
  content: '';
  position: absolute;
  inset: -24px 16% auto;
  height: clamp(180px, 28vh, 260px);
  border-radius: 999px;
  background: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--primary-color) 24%, transparent),
    transparent 72%
  );
  filter: blur(36px);
  opacity: 0.85;
  pointer-events: none;
}

.upload-stage::after {
  content: none;
  display: none;
  opacity: 0;
  pointer-events: none;
}

.upload-stage.focused::after {
  display: block;
  content: '';
  position: absolute;
  inset: 56px 2% clamp(36px, 7vh, 88px);
  border-radius: 40px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--glass-md) 92%, transparent),
    color-mix(in srgb, var(--glass-sm) 88%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, var(--surface-border));
  box-shadow: var(--shadow-md), var(--inset-highlight);
  opacity: 0.96;
}

.upload-stage.focused {
  max-width: 1060px;
}

.home-page.focused-workspace .upload-stage.focused {
  max-width: 1080px;
  min-height: min(612px, calc(100vh - 252px));
  gap: 14px;
  padding: 8px 14px clamp(24px, 4vh, 48px);
}

.home-page.loaded-upload-workspace .upload-stage.focused {
  max-width: 1120px;
  min-height: min(640px, calc(100vh - 112px));
  gap: 12px;
  padding: 0 12px clamp(20px, 3vh, 40px);
}

.home-page.loaded-upload-workspace .upload-stage.focused::after {
  inset: 38px 1.5% clamp(24px, 4vh, 48px);
}

.upload-stage > * {
  position: relative;
  z-index: 1;
}

.upload-choice-grid {
  width: 100%;
  max-width: 980px;
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(320px, 1fr));
  padding: 36px 44px 32px;
  align-items: stretch;
  border-radius: 40px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--glass-md) 92%, transparent),
    color-mix(in srgb, var(--glass-sm) 88%, transparent)
  );
  border: 1px solid color-mix(in srgb, var(--primary-color) 16%, var(--surface-border));
  box-shadow: var(--shadow-md), var(--inset-highlight);
}

.choice-card {
  overflow: hidden;
  min-height: 252px;
  border-color: color-mix(in srgb, var(--primary-color) 12%, var(--surface-border));
  background: linear-gradient(160deg, var(--glass-md), var(--glass-sm));
  box-shadow: var(--shadow-md), var(--inset-highlight);
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
}

.choice-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--primary-color) 28%, var(--surface-border));
  box-shadow: var(--shadow-lg), var(--inset-highlight);
}

.choice-card-content {
  height: 100%;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.choice-icon-wrap {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--primary-color);
}

.choice-icon-wrap.video {
  background: rgba(16, 185, 129, 0.14);
  color: #059669;
}

.choice-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.choice-text {
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-secondary);
}

.choice-btn {
  width: fit-content;
  margin-top: auto;
  align-self: flex-start;
}

.upload-area {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-area.wide {
  max-width: 1000px;
}

.upload-area > * {
  width: 100%;
}

.upload-switch-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  margin: 0 auto 28px;
}

.home-page.focused-workspace .upload-switch-wrap {
  margin: 0 auto 16px;
}

.home-page.loaded-upload-workspace .upload-switch-wrap {
  margin: 0 auto 12px;
}

.upload-switch {
  --toggle-index: 0;
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: min(100%, 360px);
  padding: 6px;
  border-radius: 999px;
  background:
    linear-gradient(180deg, var(--glass-md), var(--glass-sm)),
    linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 68%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 15%, var(--surface-border));
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 82%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--primary-color) 12%, transparent);
}

.upload-switch-thumb {
  position: absolute;
  top: 6px;
  left: 6px;
  width: calc(50% - 7px);
  height: calc(100% - 12px);
  border-radius: 999px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--primary-color) 82%, white 18%),
      color-mix(in srgb, var(--primary-hover) 88%, rgba(255, 255, 255, 0.12))
    );
  box-shadow:
    0 10px 20px rgba(99, 102, 241, 0.22),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 56%, transparent);
  transform: translateX(calc(var(--toggle-index) * calc(100% + 8px)));
  transition:
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 420ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.upload-switch-btn {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 12px 18px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition:
    color 220ms ease,
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.upload-switch-btn:hover {
  color: color-mix(in srgb, var(--primary-color) 74%, var(--text-primary));
}

.upload-switch-btn.active {
  color: var(--text-inverse);
  transform: translateY(-1px);
}

.upload-switch-btn:active {
  transform: translateY(0) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .choice-card,
  .result-main,
  .result-data,
  .reason-item,
  .data-card,
  .upload-switch-thumb,
  .upload-switch-btn {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    transform: none !important;
  }
}


.analysis-section {
  flex: 1;
  min-height: 0;
}

.analysis-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.loading-visual-wrapper {
  position: relative;
  width: min(520px, 100%);
  aspect-ratio: 16 / 10;
  margin-bottom: 24px;
  border-radius: 20px;
  overflow: hidden;
  background: var(--glass-sm);
}

.loading-image,
.loading-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #050816;
}

.scan-line {
  position: absolute;
  inset: 0;
  border-radius: 20px;
  border: 2px solid var(--primary-color);
  opacity: 0.3;
  animation: scan 2s ease-in-out infinite;
}

.loading-info {
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  color: var(--primary-color);
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

.loading-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.loading-message {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.loading-progress {
  width: 260px;
  margin: 0 auto 16px;
}

.loading-steps {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  background: rgba(99, 102, 241, 0.1);
  font-size: 12px;
  color: var(--primary-color);
}

.analysis-result {
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(360px, 0.86fr);
  gap: clamp(18px, 2vw, 28px);
  align-items: flex-start;
}

.analysis-result.video-workspace {
  grid-template-columns: minmax(0, 1.22fr) minmax(360px, 0.88fr);
}

.result-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
  transition: all 0.7s ease;
  opacity: 0;
  transform: translateY(18px);
}

.result-main.visible {
  opacity: 1;
  transform: translateY(0);
}

.image-card {
  overflow: hidden;
}

.image-card.secondary {
  border-color: color-mix(in srgb, var(--primary-color) 18%, rgba(255, 255, 255, 0.06));
  background:
    linear-gradient(180deg, rgba(30, 28, 48, 0.94), rgba(18, 16, 33, 0.92)),
    radial-gradient(circle at top, color-mix(in srgb, var(--primary-color) 16%, transparent), transparent 54%);
  box-shadow:
    0 24px 48px rgba(5, 4, 16, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28);
}

.image-card.secondary :deep(.card-header) {
  border-bottom: 1px solid rgba(129, 140, 248, 0.1);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0));
}

.image-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.image-container {
  background: var(--glass-xs);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--primary-color) 12%, var(--surface-border));
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.image-container.focus {
  min-height: clamp(320px, 42vh, 430px);
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(8, 14, 28, 0.96), rgba(9, 12, 24, 0.92));
  border-color: rgba(96, 165, 250, 0.14);
  box-shadow:
    0 18px 36px rgba(2, 6, 23, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.image-container.tall {
  min-height: clamp(520px, 68vh, 720px);
}

.pose-image {
  width: 100%;
  max-width: 100%;
  max-height: min(76vh, 760px);
  object-fit: contain;
  border-radius: 14px;
}

.result-data {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  opacity: 0;
  transform: translateX(24px);
  transition: all 0.7s ease;
}

.result-data.visible {
  opacity: 1;
  transform: translateX(0);
}

.data-card {
  flex: none;
  animation: slideUp 0.5s ease-out forwards;
  padding: 22px;
}

.data-card.featured {
  position: static;
  top: auto;
  z-index: auto;
}

.data-card :deep(.card-header) {
  padding-bottom: 12px;
}

.data-card :deep(.card-title) {
  font-size: 16px;
  font-weight: 600;
}

.analysis-card-header {
  gap: 12px;
}

.analysis-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.source-badge,
.phase-badge {
  padding: 6px 10px;
}

.analysis-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.ai-review-button {
  position: relative;
  overflow: hidden;
  border-color: rgba(255, 255, 255, 0.22);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08)),
    linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(129, 140, 248, 0.08));
  color: var(--text-primary);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
}

.ai-review-button::before {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0));
  opacity: 0.9;
  pointer-events: none;
}

.ai-review-button:hover:not(:disabled) {
  border-color: rgba(129, 140, 248, 0.32);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.1)),
    linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(129, 140, 248, 0.12));
  box-shadow:
    0 14px 30px rgba(99, 102, 241, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.5),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.ai-review-button:disabled {
  opacity: 0.72;
}

.card-caption {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.video-overview-top {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.video-summary-chip {
  padding: 14px;
  border-radius: 14px;
  background: var(--glass-xs);
  border: 1px solid var(--surface-border);
}

.video-summary-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.video-summary-chip strong {
  font-size: 16px;
  color: var(--text-primary);
}

.video-overview-reasons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.section-kicker {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  color: color-mix(in srgb, var(--primary-color) 58%, var(--text-secondary));
}

.keyframe-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.keyframe-strip {
  display: grid;
  gap: 10px;
}

.keyframe-strip.filmstrip {
  grid-auto-flow: column;
  grid-auto-columns: minmax(122px, 132px);
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
  scroll-snap-type: x proximity;
}

.keyframe-card {
  border: 1px solid var(--surface-border);
  background: var(--glass-xs);
  border-radius: 14px;
  padding: 8px;
  cursor: pointer;
  transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
  color: var(--text-secondary);
  scroll-snap-align: start;
}

.keyframe-card:hover {
  border-color: color-mix(in srgb, var(--primary-color) 30%, var(--surface-border));
  box-shadow: var(--shadow-sm);
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--glass-sm) 92%, transparent);
}

.keyframe-card.active {
  border-color: var(--primary-color);
  box-shadow:
    var(--shadow-sm),
    0 0 0 1px rgba(129, 140, 248, 0.18),
    0 12px 26px rgba(79, 70, 229, 0.2);
  transform: translateY(-2px);
  background: linear-gradient(180deg, rgba(37, 33, 61, 0.96), rgba(25, 22, 43, 0.94));
}

.keyframe-card.active span {
  color: var(--text-primary);
  font-weight: 600;
}

.keyframe-card img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 8px;
  background: #0b1020;
}

.keyframe-card span {
  display: block;
  text-align: center;
  font-size: 12px;
}

.shot-type-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.shot-type-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.shot-type-badge {
  font-size: 16px;
  padding: 8px 18px;
}

.confidence-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.confidence-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.confidence-bar {
  width: 120px;
}

.confidence-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.confidence-hint {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}

.analysis-summary {
  margin-top: 16px;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), var(--glass-lg));
  box-shadow: var(--shadow-sm), var(--inset-highlight);
}

.summary-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--primary-color);
}

.summary-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-primary);
}

.guidance-note {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px dashed color-mix(in srgb, var(--primary-color) 30%, transparent);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--primary-color) 12%, transparent),
    var(--glass-sm)
  );
  box-shadow: var(--shadow-sm), var(--inset-highlight);
}

.guidance-label {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  color: color-mix(in srgb, var(--primary-color) 58%, var(--text-secondary));
}

.guidance-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
}

.reasons-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reason-item {
  font-size: 14px;
  color: var(--text-secondary);
  padding-left: 14px;
  border-left: 2px solid rgba(99, 102, 241, 0.3);
  animation: slideUp 0.4s ease-out forwards;
  opacity: 0;
  line-height: 1.6;
}

.reason-item.solid {
  opacity: 1;
}

.chart-card :deep(.card-content) {
  padding-top: 4px;
}

.analysis-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.empty-text {
  font-size: 15px;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.empty-btn {
  padding: 8px 20px;
}

.section-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

@keyframes scan {
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }

  50% {
    opacity: 1;
  }

  100% {
    transform: translateY(100%);
    opacity: 0;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1100px) {
  .analysis-hero-shell {
    min-height: 304px;
    padding: 24px 20px 12px;
  }

  .analysis-hero-art {
    right: 8px;
  }

  .analysis-result {
    grid-template-columns: 1fr;
  }

  .result-main,
  .result-data {
    width: 100%;
  }

  .result-data {
    transform: translateY(16px);
  }

  .result-data.visible {
    transform: translateY(0);
  }

  .data-card.featured {
    position: static;
    top: auto;
  }

  .upload-choice-grid {
    grid-template-columns: 1fr;
  }

  .video-overview-top {
    grid-template-columns: 1fr;
  }

  .image-container.tall {
    min-height: 420px;
  }
}

@media (max-width: 720px) {
  .home-page {
    padding: 18px 14px 28px;
  }

  .analysis-hero-shell,
  .analysis-hero-shell.compact,
  .home-page.focused-workspace .analysis-hero-shell {
    min-height: 204px;
    padding: 18px 16px 10px;
    border-radius: 28px;
  }

  .analysis-hero-art {
    right: -12px;
  }

  .header-title {
    font-size: 26px;
  }

  .module-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .module-nav.compact :deep(.home-module-gem) {
    min-height: 102px;
    padding: 10px 10px 8px;
  }

  .module-nav.compact :deep(.gem-icon) {
    width: min(100%, 82px);
  }

  .module-nav.compact :deep(.gem-title) {
    font-size: 14px;
  }

  .upload-switch {
    width: 100%;
  }

  .home-header.compact {
    gap: 6px;
  }

  .header-subtitle.compact {
    font-size: 13px;
  }

  .video-overview-top {
    grid-template-columns: 1fr;
  }

  .keyframe-strip.filmstrip {
    grid-auto-columns: minmax(110px, 124px);
  }
}
</style>
















