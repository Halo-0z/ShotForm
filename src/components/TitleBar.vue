<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { History, Layers, Monitor, Moon, Pin, Sun } from 'lucide-vue-next'
import { navigateWithFogTransition } from '@/composables/useFogRouteTransition'
import { useResolvedThemeState } from '@/composables/useResolvedThemeState'
import { useTheme } from '@/composables/useTheme'
import { hasTauriRuntime } from '@/lib/tauri-runtime'

const props = withDefaults(
  defineProps<{
    immersive?: boolean
    workbench?: boolean
  }>(),
  {
    immersive: false,
    workbench: false
  }
)

const router = useRouter()
const { theme, cycleTheme } = useTheme()
const { isLightTheme } = useResolvedThemeState()

const isMaximized = ref(false)
const isPinned = ref(false)
let unlisten: (() => void) | null = null

const getAppWindow = () => {
  if (!hasTauriRuntime()) {
    return null
  }

  return getCurrentWindow()
}

onMounted(async () => {
  const currentWindow = getAppWindow()
  if (!currentWindow) {
    return
  }

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
  await getAppWindow()?.minimize()
}

const handleToggleMaximize = async () => {
  await getAppWindow()?.toggleMaximize()
}

const handleClose = async () => {
  await getAppWindow()?.close()
}

const handleTogglePin = async () => {
  const currentWindow = getAppWindow()
  if (!currentWindow) {
    return
  }

  const nextPinned = !isPinned.value
  await currentWindow.setAlwaysOnTop(nextPinned)
  isPinned.value = nextPinned
}

const handleOpenHistory = async () => {
  await navigateWithFogTransition(router, '/history')
}

const handleOpenTemplates = async () => {
  await navigateWithFogTransition(router, '/templates')
}
</script>

<template>
  <div
    class="titlebar"
    :class="{ immersive: props.immersive, workbench: props.workbench, 'immersive-light': props.immersive && isLightTheme }"
    data-tauri-drag-region
  >
    <div class="titlebar-left">
      <div class="titlebar-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" />
          <path
            d="M12 2C12 2 15 6 15 12C15 18 12 22 12 22"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path
            d="M12 2C12 2 9 6 9 12C9 18 12 22 12 22"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path d="M2 12H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </div>
      <span class="titlebar-title">投篮分析</span>
    </div>

    <div class="titlebar-spacer" data-tauri-drag-region></div>

    <div class="titlebar-controls">
      <div class="titlebar-controls-left">
        <button
          v-if="props.immersive"
          class="titlebar-utility"
          type="button"
          title="历史记录"
          @click="handleOpenHistory"
        >
          <History class="w-3.5 h-3.5" />
          <span>历史记录</span>
        </button>

        <button
          v-if="props.immersive"
          class="titlebar-utility"
          type="button"
          title="模板管理"
          @click="handleOpenTemplates"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>模板管理</span>
        </button>

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
  --titlebar-base-tone: var(--surface-color);
  --titlebar-divider-color: var(--surface-border);
  --titlebar-btn-hover-surface: rgba(0, 0, 0, 0.07);
  --titlebar-btn-hover-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 var(--spacing-sm);
  flex-shrink: 0;
  user-select: none;
  background: var(--titlebar-base-tone);
  color: var(--text-primary);
  border-bottom: 1px solid var(--surface-border);
  backdrop-filter: var(--surface-blur);
  -webkit-backdrop-filter: var(--surface-blur);
  -webkit-app-region: drag;
}

.titlebar.workbench {
  --titlebar-base-tone: color-mix(in srgb, var(--surface-color) 94%, rgba(8, 12, 20, 0.5));
  --titlebar-divider-color: color-mix(in srgb, var(--surface-border) 82%, transparent);
  --titlebar-btn-hover-surface: color-mix(in srgb, var(--surface-color) 82%, rgba(12, 16, 26, 0.2));
  --titlebar-btn-hover-shadow: none;
}

.titlebar.immersive {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  color: var(--hero-text);
  background-color: transparent;
  background: linear-gradient(180deg, rgba(5, 7, 12, 0.9), rgba(5, 7, 12, 0.18));
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px) saturate(120%);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
}

.titlebar.immersive.immersive-light {
  color: rgba(29, 33, 40, 0.96);
  background: linear-gradient(180deg, rgba(252, 248, 243, 0.92), rgba(252, 248, 243, 0.44));
  border-bottom: 1px solid rgba(79, 86, 99, 0.08);
  backdrop-filter: blur(14px) saturate(135%);
  -webkit-backdrop-filter: blur(14px) saturate(135%);
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

.titlebar-spacer {
  flex: 1;
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

.titlebar-utility {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  margin-right: 6px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
  color: rgba(244, 247, 255, 0.64);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.titlebar.immersive .titlebar-utility {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(244, 247, 255, 0.64);
}

.titlebar.immersive.immersive-light .titlebar-utility {
  border-color: rgba(79, 86, 99, 0.08);
  background: rgba(255, 255, 255, 0.34);
  color: rgba(66, 72, 84, 0.84);
}

.titlebar-utility:hover {
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
}

.titlebar.immersive.immersive-light .titlebar-utility:hover {
  color: rgba(29, 33, 40, 0.96);
  border-color: rgba(79, 86, 99, 0.12);
  background: rgba(255, 255, 255, 0.56);
}

.titlebar-utility:active {
  transform: translateY(0);
}

.titlebar-utility:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary-color) 72%, transparent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.titlebar-utility svg {
  opacity: 0.82;
}

.titlebar-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  align-self: center;
  background-color: var(--titlebar-divider-color);
}

.titlebar.immersive .titlebar-divider {
  background-color: rgba(255, 255, 255, 0.12);
}

.titlebar.immersive.immersive-light .titlebar-divider {
  background-color: rgba(79, 86, 99, 0.12);
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

.titlebar.workbench .titlebar-btn {
  width: 42px;
  color: color-mix(in srgb, var(--text-primary) 78%, transparent);
  transition: color 0.16s ease;
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

.titlebar.workbench .titlebar-btn::after {
  inset: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--surface-border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-color) 90%, transparent);
  opacity: 0;
  transition: opacity 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}

.titlebar-btn svg {
  position: relative;
  z-index: 1;
}

.titlebar-btn:hover::after {
  background: var(--titlebar-btn-hover-surface);
  box-shadow: var(--titlebar-btn-hover-shadow);
}

.titlebar.workbench .titlebar-btn:hover {
  color: var(--text-primary);
}

.titlebar.workbench .titlebar-btn:hover::after {
  opacity: 1;
}

.titlebar.immersive .titlebar-btn:hover::after {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05);
}

.titlebar.immersive.immersive-light .titlebar-btn:hover::after {
  background: rgba(20, 24, 32, 0.06);
  box-shadow: inset 0 1px 2px rgba(20, 24, 32, 0.04);
}

.titlebar-btn:active {
  transform: scale(0.92);
}

.titlebar-btn:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary-color) 72%, transparent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
}

.titlebar-btn:focus-visible::after {
  background: var(--titlebar-btn-hover-surface);
  box-shadow: var(--titlebar-btn-hover-shadow);
}

.titlebar.workbench .titlebar-btn:active {
  transform: scale(0.97);
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

@media (max-width: 720px) {
  .titlebar-utility span {
    display: none;
  }

  .titlebar-utility {
    padding: 0 9px;
  }
}
</style>
