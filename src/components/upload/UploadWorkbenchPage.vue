<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Clock3, Film, Image as ImageIcon, RotateCcw } from 'lucide-vue-next'
import ImageUpload from '@/components/ImageUpload/index.vue'
import VideoUpload from '@/components/VideoUpload/index.vue'
import { Button } from '@/components/ui/button'
import { navigateWithFogTransition } from '@/composables/useFogRouteTransition'
import { useAnalysisStore } from '@/stores/analysis'

const router = useRouter()
const analysisStore = useAnalysisStore()

const uploadMode = ref<'image' | 'video'>('video')
const uploadResetKey = ref(0)
const handoffError = ref('')

const workbenchKey = computed(() => `${uploadMode.value}-${uploadResetKey.value}`)
const isBusy = computed(() => analysisStore.isLoading)
const browserModeMessage = '当前是浏览器预览模式，素材可以选择和裁剪，但姿势分析需要在桌面版应用中运行。'

const hasTauriRuntime = () => {
  if (typeof window === 'undefined') return false

  return typeof (window as Window & {
    __TAURI_INTERNALS__?: { invoke?: unknown }
  }).__TAURI_INTERNALS__?.invoke === 'function'
}

const goHome = () => {
  navigateWithFogTransition(router, '/')
}

const goHistory = () => {
  navigateWithFogTransition(router, '/history')
}

const resetWorkbench = () => {
  handoffError.value = ''
  uploadResetKey.value += 1
}

const handleImageLoaded = async (imageData: string) => {
  handoffError.value = ''

  try {
    if (!hasTauriRuntime()) {
      handoffError.value = browserModeMessage
      window.alert(browserModeMessage)
      return
    }

    await analysisStore.analyzeImage(imageData)
    await navigateWithFogTransition(router, '/analysis')
  } catch (error) {
    handoffError.value = error instanceof Error ? error.message : String(error)
    window.alert(`图片分析失败：${handoffError.value}`)
  }
}

const handleVideoLoaded = async (payload: {
  filePath: string
  previewUrl: string
  trimStartMs: number
  trimEndMs: number
  durationMs: number
}) => {
  handoffError.value = ''

  try {
    if (!hasTauriRuntime()) {
      handoffError.value = browserModeMessage
      window.alert(browserModeMessage)
      return
    }

    await analysisStore.analyzeVideo(payload.filePath, payload.trimStartMs, payload.trimEndMs)
    await navigateWithFogTransition(router, '/analysis')
  } catch (error) {
    handoffError.value = error instanceof Error ? error.message : String(error)
    window.alert(`视频分析失败：${handoffError.value}`)
  }
}
</script>

<template>
  <section class="upload-workbench">
    <header class="upload-workbench__rail">
      <div class="upload-workbench__rail-main">
        <div class="upload-workbench__eyebrow">上传工作台</div>
        <div class="upload-workbench__heading">
          <h1>上传分析</h1>
          <p>直接导入图片或视频，完成后立即进入分析结果页。</p>
        </div>
      </div>

      <div class="upload-workbench__rail-actions">
        <Button variant="ghost" size="sm" @click="goHome">
          <ArrowLeft class="h-4 w-4" />
          返回首页
        </Button>
        <Button variant="outline" size="sm" @click="goHistory">
          <Clock3 class="h-4 w-4" />
          历史记录
        </Button>
      </div>
    </header>

    <section class="upload-workbench__deck">
      <div class="upload-workbench__mode-strip" aria-label="上传模式切换">
        <Button
          :variant="uploadMode === 'image' ? 'segmented-active' : 'secondary'"
          size="sm"
          @click="uploadMode = 'image'"
        >
          <ImageIcon class="h-4 w-4" />
          图片
        </Button>
        <Button
          :variant="uploadMode === 'video' ? 'segmented-active' : 'secondary'"
          size="sm"
          @click="uploadMode = 'video'"
        >
          <Film class="h-4 w-4" />
          视频
        </Button>
      </div>

      <div class="upload-workbench__surface">
        <ImageUpload
          v-if="uploadMode === 'image'"
          :key="workbenchKey"
          :loading="isBusy"
          @image-loaded="handleImageLoaded"
        />
        <VideoUpload
          v-else
          :key="workbenchKey"
          compact
          :loading="isBusy"
          @video-loaded="handleVideoLoaded"
        />
      </div>

      <footer class="upload-workbench__status-rail">
        <p class="upload-workbench__status">
          {{ uploadMode === 'image' ? '图片模式适合单帧姿态分析。' : '视频模式支持裁剪片段并进入关键帧分析。' }}
        </p>
        <div class="upload-workbench__action-buttons">
          <Button variant="outline" size="sm" @click="resetWorkbench">
            <RotateCcw class="h-4 w-4" />
            重新开始
          </Button>
        </div>
      </footer>
    </section>

    <p v-if="handoffError" class="upload-workbench__error">{{ handoffError }}</p>
  </section>
</template>

<style scoped>
.upload-workbench {
  display: grid;
  gap: 18px;
}

.upload-workbench__rail {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 15px 16px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 82%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card-bg) 94%, var(--background)), color-mix(in srgb, var(--surface-color) 90%, transparent));
  box-shadow:
    0 18px 42px rgba(24, 29, 38, 0.09),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 72%, transparent);
}

.upload-workbench__rail-main {
  display: grid;
  gap: 10px;
}

.upload-workbench__rail-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.upload-workbench__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-color) 42%, var(--text-secondary));
}

.upload-workbench__heading h1 {
  margin: 0;
  font-size: clamp(28px, 3vw, 40px);
  color: var(--text-primary);
}

.upload-workbench__heading p {
  margin: 8px 0 0;
  color: var(--text-secondary);
}

.upload-workbench__deck {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 30px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 80%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--card-bg) 92%, var(--background)),
    color-mix(in srgb, var(--surface-color) 86%, transparent)
  );
  box-shadow:
    0 24px 64px rgba(24, 29, 38, 0.11),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 64%, transparent);
}

.upload-workbench__mode-strip {
  display: flex;
  gap: 10px;
  padding: 6px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-color) 82%, transparent);
}

.upload-workbench__surface {
  min-height: 420px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 78%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-solid) 86%, var(--surface-color)), color-mix(in srgb, var(--bg-solid) 92%, var(--background)));
  box-shadow:
    0 14px 32px rgba(24, 29, 38, 0.08),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 54%, transparent);
  padding: 18px;
}

.upload-workbench__status-rail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 76%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-color) 90%, var(--background)),
    color-mix(in srgb, var(--bg-solid) 90%, var(--surface-color))
  );
  box-shadow:
    0 12px 24px rgba(24, 29, 38, 0.06),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 56%, transparent);
}

.upload-workbench__status {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.55;
}

.upload-workbench__action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.upload-workbench__error {
  margin: 0;
  color: var(--color-danger);
}

@media (max-width: 900px) {
  .upload-workbench__rail,
  .upload-workbench__status-rail {
    flex-direction: column;
    align-items: flex-start;
  }

  .upload-workbench__rail-actions {
    justify-content: flex-start;
  }
}
</style>
