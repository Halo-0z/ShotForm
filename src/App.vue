<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import TitleBar from '@/components/TitleBar.vue'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const { initTheme } = useTheme()

const isImmersiveChrome = computed(() => Boolean(route.meta.immersiveChrome))

onMounted(() => {
  initTheme()
})
</script>

<template>
  <div class="app-container" :class="{ 'immersive-home': isImmersiveChrome }">
    <TitleBar :immersive="isImmersiveChrome" />
    <div class="app-content" :class="{ 'immersive-home': isImmersiveChrome }">
      <router-view />
    </div>
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
}

.app-content.immersive-home {
  position: relative;
}
</style>
