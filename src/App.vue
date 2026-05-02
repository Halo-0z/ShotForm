<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import FogRouteTransition from '@/components/transition/FogRouteTransition.vue'
import TitleBar from '@/components/TitleBar.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
import ToastContainer from '@/components/ui/toast/Toast.vue'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import { COPY_LOCK_CLASS, createCopyGuardHandlers } from '@/lib/copy-guard.js'

const route = useRoute()
const { initTheme } = useTheme()
const { handleCopy, handleCut } = createCopyGuardHandlers()
const { messages, dismiss } = useToast()
useGlobalShortcuts()

const isImmersiveChrome = computed(() => Boolean(route.meta.immersiveChrome))
const isWorkbenchChrome = computed(() => Boolean(route.meta.workbenchPage))

onMounted(() => {
  initTheme()
  document.addEventListener('copy', handleCopy)
  document.addEventListener('cut', handleCut)
})

onUnmounted(() => {
  document.removeEventListener('copy', handleCopy)
  document.removeEventListener('cut', handleCut)
})
</script>

<template>
  <div class="app-container" :class="[COPY_LOCK_CLASS, { 'immersive-home': isImmersiveChrome }]">
    <TitleBar :immersive="isImmersiveChrome" :workbench="isWorkbenchChrome" />
    <FogRouteTransition />
    <div class="app-content" :class="{ 'immersive-home': isImmersiveChrome }">
      <ErrorBoundary>
        <router-view />
      </ErrorBoundary>
    </div>
    <ToastContainer :messages="messages" @remove="dismiss" />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-container.immersive-home {
  background: transparent;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.app-content.immersive-home {
  position: relative;
}

.app-copy-locked,
.app-copy-locked * {
  user-select: none;
  -webkit-user-select: none;
}

.app-copy-locked input,
.app-copy-locked textarea,
.app-copy-locked [contenteditable='true'],
.app-copy-locked [contenteditable='plaintext-only'],
.app-copy-locked [data-allow-copy='true'],
.app-copy-locked [data-allow-copy='true'] * {
  user-select: text;
  -webkit-user-select: text;
}
</style>
