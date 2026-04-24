<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Clock3, Film, Image as ImageIcon, RotateCcw } from 'lucide-vue-next'
import ImageUpload from '@/components/ImageUpload/index.vue'
import VideoUpload from '@/components/VideoUpload/index.vue'
import { Button } from '@/components/ui/button'
import { navigateWithFogTransition } from '@/composables/useFogRouteTransition'
import { useAnalysisStore } from '@/stores/analysis'
import { hasTauriRuntime } from '@/lib/tauri-runtime'

const router = useRouter()
const analysisStore = useAnalysisStore()

const uploadMode = ref<'image' | 'video'>('video')
const uploadResetKey = ref(0)
const handoffError = ref('')

const workbenchKey = computed(() => `${uploadMode.value}-${uploadResetKey.value}`)
const isBusy = computed(() => analysisStore.isLoading)
const isBrowserPreviewMode = computed(() => !hasTauriRuntime())
const browserModeMessage = '当前为浏览器预览模式：可上传、裁剪、剪辑并预览素材，最终分析需在桌面端完成。'

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
        <p class="upload-workbench__eyebrow">Upload Workbench</p>
        <div class="upload-workbench__heading">
          <h1>上传素材</h1>
          <p>选择图片或视频，整理好素材后再进入最终分析。</p>
        </div>
      </div>

      <div class="upload-workbench__rail-actions">
        <Button variant="ghost" size="sm" @click="goHome">
          <ArrowLeft class="h-4 w-4" />
          首页
        </Button>
        <Button variant="outline" size="sm" @click="goHistory">
          <Clock3 class="h-4 w-4" />
          历史
        </Button>
      </div>
    </header>

    <section class="upload-workbench__main upload-workbench__deck">
      <div class="upload-workbench__mode-strip" aria-label="上传工具选择">
        <p class="upload-workbench__mode-label">输入类型</p>
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

      <div
        v-if="isBrowserPreviewMode"
        class="upload-workbench__browser-note"
        data-browser-preview-note
        role="note"
      >
        <p class="upload-workbench__browser-note-title">浏览器预览模式</p>
        <p class="upload-workbench__browser-note-copy">{{ browserModeMessage }}</p>
      </div>

      <div class="upload-workbench__surface">
        <ImageUpload
          v-if="uploadMode === 'image'"
          :key="workbenchKey"
          :desktop-analysis-available="!isBrowserPreviewMode"
          :loading="isBusy"
          @image-loaded="handleImageLoaded"
        />
        <VideoUpload
          v-else
          :key="workbenchKey"
          compact
          :desktop-analysis-available="!isBrowserPreviewMode"
          :loading="isBusy"
          @video-loaded="handleVideoLoaded"
        />
      </div>

      <footer class="upload-workbench__status-rail">
        <p class="upload-workbench__status">
          {{ uploadMode === 'image' ? '适合单帧动作判断。' : '先裁剪动作区间，再进入关键帧分析。' }}
        </p>
        <div class="upload-workbench__action-buttons">
          <Button variant="outline" size="sm" @click="resetWorkbench">
            <RotateCcw class="h-4 w-4" />
            重置当前素材
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
  gap: 16px;
}

.upload-workbench__rail {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 78%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--card-bg) 94%, var(--background)),
    color-mix(in srgb, var(--surface-color) 90%, var(--bg-solid))
  );
  box-shadow:
    0 10px 20px rgba(24, 29, 38, 0.05),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 68%, transparent);
}

.upload-workbench__rail-main {
  display: grid;
  gap: 6px;
}

.upload-workbench__rail-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.upload-workbench__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--accent-color) 36%, var(--text-secondary));
}

.upload-workbench__heading h1 {
  margin: 0;
  font-size: clamp(28px, 3vw, 40px);
  color: var(--text-primary);
}

.upload-workbench__heading p {
  margin: 4px 0 0;
  color: var(--text-secondary);
}

.upload-workbench__main {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 80%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--card-bg) 96%, var(--background)),
    color-mix(in srgb, var(--bg-solid) 95%, var(--surface-color))
  );
  box-shadow:
    0 16px 32px rgba(24, 29, 38, 0.08),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 60%, transparent);
}

.upload-workbench__mode-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 74%, transparent);
  background: color-mix(in srgb, var(--surface-color) 84%, var(--bg-solid));
}

.upload-workbench__mode-label {
  margin: 0;
  padding: 0 4px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.upload-workbench__browser-note {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 22%, var(--surface-border));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent-color) 8%, var(--card-bg)),
    color-mix(in srgb, var(--surface-color) 88%, var(--bg-solid))
  );
  color: var(--text-secondary);
  line-height: 1.6;
}

.upload-workbench__browser-note-title,
.upload-workbench__browser-note-copy {
  margin: 0;
}

.upload-workbench__browser-note-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-primary);
}

.upload-workbench__surface {
  min-height: 420px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 78%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-solid) 97%, var(--surface-color)),
    color-mix(in srgb, var(--bg-solid) 94%, var(--background))
  );
  box-shadow:
    0 10px 20px rgba(24, 29, 38, 0.06),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 54%, transparent);
  padding: 16px;
}

.upload-workbench__status-rail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 74%, transparent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-color) 92%, var(--card-bg)),
    color-mix(in srgb, var(--bg-solid) 96%, var(--surface-color))
  );
  box-shadow:
    0 10px 20px rgba(24, 29, 38, 0.05),
    inset 0 1px 0 color-mix(in srgb, var(--border-light) 56%, transparent);
}

.upload-workbench__status {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.upload-workbench__action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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
