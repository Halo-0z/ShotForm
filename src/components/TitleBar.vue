<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useTheme } from '@/composables/useTheme'
import { Pin, Sun, Moon, Monitor } from 'lucide-vue-next'

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
  if (unlisten) {
    unlisten()
  }
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
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="titlebar-left">
      <div class="titlebar-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--primary-color)" stroke-width="2"/>
          <path d="M12 2C12 2 15 6 15 12C15 18 12 22 12 22" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 2C12 2 9 6 9 12C9 18 12 22 12 22" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
          <path d="M2 12H22" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <span class="titlebar-title">投篮分析</span>
    </div>

    <div class="titlebar-center" data-tauri-drag-region></div>

    <div class="titlebar-controls">
      <div class="titlebar-controls-left">
        <button 
          class="titlebar-btn theme-btn" 
          @click="cycleTheme"
          :title="`当前: ${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}`"
        >
          <Sun v-if="theme === 'light'" class="w-4 h-4" />
          <Moon v-else-if="theme === 'dark'" class="w-4 h-4" />
          <Monitor v-else class="w-4 h-4" />
        </button>
        
        <button 
          class="titlebar-btn pin" 
          :class="{ active: isPinned }"
          @click="handleTogglePin"
          :title="isPinned ? '取消置顶' : '置顶窗口'"
        >
          <Pin class="w-4 h-4" />
        </button>
      </div>

      <div class="titlebar-divider"></div>

      <div class="titlebar-controls-right">
        <button class="titlebar-btn minimize" @click="handleMinimize" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1.5" fill="currentColor" />
          </svg>
        </button>
        
        <button class="titlebar-btn maximize" @click="handleToggleMaximize" :title="isMaximized ? '向下还原' : '最大化'">
          <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect x="2.5" y="4" width="5" height="5" stroke="currentColor" stroke-width="1.5" fill="none" />
            <path d="M4 4V2.5h5.5V8H8" stroke="currentColor" stroke-width="1.5" fill="none" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.5" fill="none" />
          </svg>
        </button>
        
        <button class="titlebar-btn close" @click="handleClose" title="关闭">
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
  background: var(--surface-color);
  backdrop-filter: var(--surface-blur);
  -webkit-backdrop-filter: var(--surface-blur);
  border-bottom: 1px solid var(--surface-border);
  user-select: none;
  flex-shrink: 0;
  padding: 0 var(--spacing-sm);
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-left: var(--spacing-sm);
  z-index: 1;
}

.titlebar-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.titlebar-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.titlebar-center {
  flex: 1;
  height: 100%;
  cursor: default;
  display: flex;
  align-items: center;
  justify-content: center;
}

.titlebar-controls {
  display: flex;
  height: 100%;
  z-index: 1;
  align-items: center;
  margin-right: calc(var(--spacing-sm) * -1);
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
  background-color: var(--border-color);
  margin: 0 4px;
  align-self: center;
}

.titlebar-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease, transform 0.15s ease;
  -webkit-app-region: no-drag;
  position: relative;
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

.titlebar-btn svg:not(.theme-icon) {
  position: relative;
  z-index: 1;
}

.titlebar-btn:hover {
  color: var(--text-primary);
}

.titlebar-btn:hover::after {
  background: rgba(0, 0, 0, 0.07);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
}

.titlebar-btn:active {
  transform: scale(0.92);
}

.titlebar-btn:active::after {
  background: rgba(0, 0, 0, 0.12);
}

.dark .titlebar-btn:hover::after {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05);
}

.dark .titlebar-btn:active::after {
  background: rgba(255, 255, 255, 0.14);
}

.titlebar-btn.close:hover {
  color: #FFFFFF;
}

.titlebar-btn.close:hover::after {
  background: #E81123;
  box-shadow: 0 2px 8px rgba(232, 17, 35, 0.3);
}

.titlebar-btn.close:active::after {
  background: #C50F1F;
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
