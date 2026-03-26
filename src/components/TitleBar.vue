<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Monitor, Moon, Pin, Sun } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const props = withDefaults(
  defineProps<{
    immersive?: boolean
  }>(),
  {
    immersive: false
  }
)

const router = useRouter()
const { theme, cycleTheme } = useTheme()

const isMaximized = ref(false)
const isPinned = ref(false)
let unlisten: (() => void) | null = null

onMounted(async () => {
  const currentWindow = getCurrentWindow()

  isMaximized.value = await currentWindow.isMaximized()
  isPinned.value = await currentWindow.isAlwaysOnTop()

  unlisten = await currentWindow.onResized(async () => {
    isMaximized.value = await currentWindow.isMaximized()
  })
})

onUnmounted(() => {
  unlisten?.()
})

const handleMinimize = async () => {
  await getCurrentWindow().minimize()
}

const handleToggleMaximize = async () => {
  await getCurrentWindow().toggleMaximize()
}

const handleClose = async () => {
  await getCurrentWindow().close()
}

const handleTogglePin = async () => {
  const nextPinned = !isPinned.value
  await getCurrentWindow().setAlwaysOnTop(nextPinned)
  isPinned.value = nextPinned
}

const handleOpenHistory = async () => {
  await router.push('/history')
}
</script>

<template>
  <div class="titlebar" :class="{ immersive: props.immersive }" data-tauri-drag-region>
    <div class="titlebar-left">
      <div class="titlebar-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" />
          <path d="M12 2C12 2 15 6 15 12C15 18 12 22 12 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M12 2C12 2 9 6 9 12C9 18 12 22 12 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          <path d="M2 12H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </div>
      <span class="titlebar-title">投篮分析</span>
    </div>

    <div class="titlebar-center" data-tauri-drag-region>
      <button
        v-if="props.immersive"
        class="titlebar-link"
        type="button"
        @click="handleOpenHistory"
      >
        历史记录
      </button>
    </div>

    <div class="titlebar-controls">
      <div class="titlebar-controls-left">
        <button
          class="titlebar-btn theme-btn"
          :title="`当前: ${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}`"
          @click="cycleTheme"
        >
          <Sun v-if="theme === 'light'" class="w-4 h-4" />
          <Moon v-else-if="theme === 'dark'" class="w-4 h-4" />
          <Monitor v-else class="w-4 h-4" />
        </button>

        <button
          class="titlebar-btn pin"
          :class="{ active: isPinned }"
          :title="isPinned ? '取消置顶' : '置顶窗口'"
          @click="handleTogglePin"
        >
          <Pin class="w-4 h-4" />
        </button>
      </div>

      <div class="titlebar-divider"></div>

      <div class="titlebar-controls-right">
        <button class="titlebar-btn minimize" title="最小化" @click="handleMinimize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1.5" fill="currentColor" />
          </svg>
        </button>

        <button
          class="titlebar-btn maximize"
          :title="isMaximized ? '向下还原' : '最大化'"
          @click="handleToggleMaximize"
        >
          <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect x="2.5" y="4" width="5" height="5" stroke="currentColor" stroke-width="1.5" fill="none" />
            <path d="M4 4V2.5h5.5V8H8" stroke="currentColor" stroke-width="1.5" fill="none" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none" />
          </svg>
        </button>

        <button class="titlebar-btn close" title="关闭" @click="handleClose">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 var(--spacing-sm);
  flex-shrink: 0;
  user-select: none;
  background: var(--surface-color);
  color: var(--text-primary);
  border-bottom: 1px solid var(--surface-border);
  backdrop-filter: var(--surface-blur);
  -webkit-backdrop-filter: var(--surface-blur);
}

.titlebar.immersive {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  color: var(--hero-text);
  background-color: transparent;
  background: linear-gradient(180deg, rgba(4, 6, 11, 0.82), rgba(4, 6, 11, 0.18));
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-left: var(--spacing-sm);
  z-index: 1;
}

.titlebar-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.titlebar-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.titlebar-center {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}

.titlebar-link {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  height: 30px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(244, 247, 255, 0.78);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.titlebar-link:hover {
  color: rgba(255, 255, 255, 0.98);
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.06);
}

.titlebar-controls {
  display: flex;
  height: 100%;
  align-items: center;
  margin-right: calc(var(--spacing-sm) * -1);
  z-index: 1;
}

.titlebar-controls-left,
.titlebar-controls-right {
  display: flex;
  height: 100%;
  align-items: center;
}

.titlebar-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  align-self: center;
  background-color: var(--border-color);
}

.titlebar.immersive .titlebar-divider {
  background-color: rgba(255, 255, 255, 0.12);
}

.titlebar-btn {
  position: relative;
  width: 46px;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: color 0.2s ease, transform 0.15s ease;
  -webkit-app-region: no-drag;
}

.titlebar-btn::after {
  content: '';
  position: absolute;
  inset: 6px 8px;
  border-radius: var(--radius-sm);
  background: transparent;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  pointer-events: none;
  z-index: 0;
}

.titlebar-btn svg {
  position: relative;
  z-index: 1;
}

.titlebar-btn:hover::after {
  background: rgba(0, 0, 0, 0.07);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
}

.titlebar.immersive .titlebar-btn:hover::after {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05);
}

.titlebar-btn:active {
  transform: scale(0.92);
}

.titlebar-btn.close:hover {
  color: #fff;
}

.titlebar-btn.close:hover::after {
  background: #e81123;
  box-shadow: 0 2px 8px rgba(232, 17, 35, 0.3);
}

.titlebar-btn.close:active::after {
  background: #c50f1f;
}

.titlebar-btn.pin.active {
  color: var(--accent-color);
}

.titlebar-btn.pin.active::after {
  background: rgba(16, 185, 129, 0.1);
}

.titlebar-btn.theme-btn:hover {
  color: var(--primary-color);
}
</style>
