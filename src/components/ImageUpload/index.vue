<script setup lang="ts">
import { computed, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Crop, Loader2, Scissors, Upload as UploadIcon, X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  loading?: boolean
}>(), {
  loading: false
})

const emit = defineEmits<{
  (e: 'image-loaded', imageData: string): void
}>()

type ProcessImageResponse = {
  image_data: string
  width: number
  height: number
}

const previewUrl = ref('')
const imageBase64 = ref('')
const isDragging = ref(false)
const cropDialogOpen = ref(false)
const cropImageRef = ref<HTMLImageElement | null>(null)
const cropImageNatural = ref({ width: 0, height: 0 })
const selection = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const dragStart = ref<{ x: number; y: number } | null>(null)
const isCropping = ref(false)
const isLoading = computed(() => props.loading)

const processFile = (file: File) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']
  if (!allowedTypes.includes(file.type)) {
    window.alert('请上传 JPG 或 PNG 格式的图片')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    previewUrl.value = event.target?.result as string
    imageBase64.value = event.target?.result as string
  }
  reader.readAsDataURL(file)
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  processFile(file)
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  const file = event.dataTransfer?.files[0]
  if (file) {
    processFile(file)
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const confirmUpload = () => {
  if (!imageBase64.value || isLoading.value) return
  emit('image-loaded', imageBase64.value)
}

const resetCropState = () => {
  selection.value = null
  dragStart.value = null
}

const openCropDialog = () => {
  if (!previewUrl.value) return
  resetCropState()
  cropDialogOpen.value = true
}

const onCropImageLoad = (event: Event) => {
  const image = event.target as HTMLImageElement
  cropImageNatural.value = {
    width: image.naturalWidth,
    height: image.naturalHeight
  }
}

const getRelativePoint = (event: MouseEvent) => {
  const image = cropImageRef.value
  if (!image) return null

  const rect = image.getBoundingClientRect()
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)

  return { x, y, width: rect.width, height: rect.height }
}

const startSelection = (event: MouseEvent) => {
  const point = getRelativePoint(event)
  if (!point) return

  dragStart.value = { x: point.x, y: point.y }
  selection.value = { x: point.x, y: point.y, width: 0, height: 0 }
}

const updateSelection = (event: MouseEvent) => {
  if (!dragStart.value) return

  const point = getRelativePoint(event)
  if (!point) return

  const x = Math.min(dragStart.value.x, point.x)
  const y = Math.min(dragStart.value.y, point.y)
  const width = Math.abs(point.x - dragStart.value.x)
  const height = Math.abs(point.y - dragStart.value.y)

  selection.value = { x, y, width, height }
}

const finishSelection = () => {
  dragStart.value = null
}

const applyCrop = async () => {
  const image = cropImageRef.value
  const currentSelection = selection.value
  if (!image || !currentSelection || currentSelection.width < 20 || currentSelection.height < 20) {
    window.alert('请先框选球员主体区域')
    return
  }

  const rect = image.getBoundingClientRect()
  const scaleX = cropImageNatural.value.width / rect.width
  const scaleY = cropImageNatural.value.height / rect.height

  isCropping.value = true
  try {
    const response = await invoke<ProcessImageResponse>('process_image', {
      request: {
        image_data: imageBase64.value,
        operations: [
          {
            Crop: {
              x: Math.round(currentSelection.x * scaleX),
              y: Math.round(currentSelection.y * scaleY),
              width: Math.max(1, Math.round(currentSelection.width * scaleX)),
              height: Math.max(1, Math.round(currentSelection.height * scaleY))
            }
          }
        ]
      }
    })

    previewUrl.value = response.image_data
    imageBase64.value = response.image_data
    cropDialogOpen.value = false
    resetCropState()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`裁剪失败: ${message}`)
  } finally {
    isCropping.value = false
  }
}

const clearPreview = () => {
  previewUrl.value = ''
  imageBase64.value = ''
  cropDialogOpen.value = false
  resetCropState()
}
</script>

<template>
  <div class="w-full animate-fade-in">
    <div
      v-if="!previewUrl"
      class="relative overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--surface-border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_96%,var(--background)),color-mix(in_srgb,var(--bg-solid)_94%,var(--surface-color)))] px-6 py-6 shadow-[0_14px_30px_rgba(24,29,38,0.08),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_56%,transparent)] transition-all duration-300"
      :class="isDragging && 'border-[color-mix(in_srgb,var(--accent-color)_38%,var(--surface-border))] shadow-[0_18px_34px_rgba(24,29,38,0.1),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_62%,transparent)]'"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        @change="handleFileChange"
      />

      <div class="relative grid min-h-[360px] place-items-center rounded-[1.75rem] border border-dashed border-[color-mix(in_srgb,var(--surface-border)_84%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_94%,var(--surface-color)),color-mix(in_srgb,var(--bg-solid)_92%,var(--background)))] px-8 py-10 text-center shadow-[0_10px_24px_rgba(24,29,38,0.08),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_62%,transparent)]">
        <div class="mx-auto flex max-w-xl flex-col items-center justify-center gap-5">
          <div
            class="rounded-[1.4rem] border border-[color-mix(in_srgb,var(--surface-border)_78%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_94%,var(--surface-color)),color-mix(in_srgb,var(--bg-solid)_92%,var(--background)))] p-5 shadow-[0_10px_22px_rgba(24,29,38,0.08),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_54%,transparent)] transition-transform duration-300"
            :class="isDragging && 'scale-[1.03]'"
          >
            <UploadIcon
              class="h-10 w-10 text-[var(--primary-color)] transition-transform duration-300"
              :class="isDragging && 'translate-y-1'"
            />
          </div>

          <div class="space-y-2 text-center">
            <p class="text-[clamp(1.75rem,3vw,2.25rem)] font-semibold leading-none text-[var(--text-primary)]">
              导入投篮图片
            </p>
            <p class="mx-auto max-w-lg text-sm leading-7 text-[var(--text-secondary)]">
              建议使用清晰的单人投篮图，尽量保留头、持球手和脚部，方便后续主体裁剪与姿态判断。
            </p>
          </div>

          <p class="rounded-full border border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--surface-color)_88%,var(--bg-solid))] px-4 py-2 text-xs text-[var(--text-muted)] shadow-[var(--shadow-sm)]">
            支持 JPG / PNG
          </p>
        </div>
      </div>
    </div>

    <div v-else class="space-y-4 animate-slide-up">
      <div class="overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--surface-border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_96%,var(--background)),color-mix(in_srgb,var(--bg-solid)_94%,var(--surface-color)))] p-5 shadow-[0_12px_28px_rgba(24,29,38,0.08),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_56%,transparent)]">
        <div class="flex flex-col gap-5 lg:flex-row">
          <div class="relative h-40 w-full overflow-hidden rounded-[1.5rem] border border-[color-mix(in_srgb,var(--surface-border)_78%,transparent)] bg-[color-mix(in_srgb,var(--bg-solid)_94%,var(--surface-color))] shadow-[0_10px_24px_rgba(24,29,38,0.06)] lg:h-44 lg:w-44 lg:flex-shrink-0">
            <img :src="previewUrl" class="h-full w-full object-cover" alt="Preview" />
            <button
              class="absolute right-2 top-2 rounded-full border border-[color-mix(in_srgb,var(--surface-border)_78%,transparent)] bg-[color-mix(in_srgb,var(--card-bg)_92%,var(--bg-solid))] p-1.5 text-[var(--text-primary)] shadow-[0_10px_18px_rgba(24,29,38,0.16)] transition-transform duration-200 hover:scale-105"
              @click="clearPreview"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <div class="min-w-0 flex-1">
            <h3 class="truncate text-lg font-semibold text-[var(--text-primary)]">图片已准备好分析</h3>
            <p class="mt-1 text-sm text-[var(--text-secondary)]">
              开始分析前，建议先把球员主体裁出来，尤其是比赛截图或训练场景较杂时。
            </p>
            <p class="mt-2 text-sm text-[var(--text-muted)]">
              裁剪时尽量保留头、持球手、躯干和脚部，减少观众、防守人和背景干扰。
            </p>

            <p class="mt-4 inline-flex rounded-full border border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--surface-color)_88%,var(--bg-solid))] px-4 py-2 text-xs text-[var(--text-muted)] shadow-[var(--shadow-sm)]">
              可先裁剪主体，再进入分析
            </p>

            <div class="mt-5 flex flex-wrap gap-3">
              <Button :disabled="isLoading || !imageBase64" @click="confirmUpload" size="lg">
                <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
                <UploadIcon v-else class="mr-2 h-4 w-4" />
                {{ isLoading ? '分析中...' : '开始分析' }}
              </Button>
              <Button variant="outline" @click="openCropDialog" size="lg">
                <Crop class="mr-2 h-4 w-4" />
                先裁剪主体
              </Button>
              <Button variant="outline" @click="clearPreview" size="lg">
                重新选择
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Dialog :open="cropDialogOpen" @update:open="cropDialogOpen = $event">
      <DialogContent class="max-w-[92vw] border border-[color-mix(in_srgb,var(--surface-border)_82%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card-bg)_96%,var(--background)),color-mix(in_srgb,var(--bg-solid)_95%,var(--surface-color)))] shadow-[0_18px_40px_rgba(24,29,38,0.18),inset_0_1px_0_color-mix(in_srgb,var(--border-light)_58%,transparent)] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>裁剪球员主体</DialogTitle>
          <DialogDescription>在图片上拖拽框选球员，尽量保留头、手、脚，减少背景干扰。</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div
            class="relative mx-auto max-h-[70vh] overflow-hidden rounded-[1.5rem] border border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-solid)_88%,black)]"
            @mousedown="startSelection"
            @mousemove="updateSelection"
            @mouseup="finishSelection"
            @mouseleave="finishSelection"
          >
            <img
              ref="cropImageRef"
              :src="previewUrl"
              class="max-h-[70vh] w-auto select-none object-contain"
              alt="Crop preview"
              draggable="false"
              @load="onCropImageLoad"
            />
            <div
              v-if="selection"
              class="pointer-events-none absolute border-2 border-[var(--primary-color)] bg-[var(--primary-color)]/15 shadow-[0_0_0_9999px_rgba(12,16,22,0.42)]"
              :style="{
                left: `${selection.x}px`,
                top: `${selection.y}px`,
                width: `${selection.width}px`,
                height: `${selection.height}px`
              }"
            />
          </div>

          <div class="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-[color-mix(in_srgb,var(--surface-border)_78%,transparent)] bg-[color-mix(in_srgb,var(--surface-color)_84%,var(--bg-solid))] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <div class="flex items-center gap-2">
              <Scissors class="h-4 w-4" />
              <span>拖拽鼠标框选人物主体，框选过小不会生效。</span>
            </div>
            <div class="flex gap-3">
              <Button variant="outline" @click="resetCropState">重选区域</Button>
              <Button :disabled="isCropping" @click="applyCrop">
                <Loader2 v-if="isCropping" class="mr-2 h-4 w-4 animate-spin" />
                应用裁剪
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
