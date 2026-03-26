<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import CinematicHeroStage from '@/components/home/CinematicHeroStage.vue'
import HeroCopyBlock from '@/components/home/HeroCopyBlock.vue'
import HomeWorkspace from '@/components/home/HomeWorkspace.vue'
import { HOME_HERO_COPY, getInitialHeroMode } from '@/lib/home-hero-state.js'
import { useAnalysisStore } from '@/stores/analysis'

const analysisStore = useAnalysisStore()

const heroMode = ref(getInitialHeroMode(Boolean(analysisStore.currentAnalysis)))
const workspaceRef = ref<HTMLElement | null>(null)

const hasAnalysis = computed(() => Boolean(analysisStore.currentAnalysis))
const isWorking = computed(() => analysisStore.isLoading || hasAnalysis.value)

const scrollWorkspaceIntoView = () => {
  requestAnimationFrame(() => {
    workspaceRef.value?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  })
}

const enterWorkspace = async () => {
  heroMode.value = 'workspace'
  await nextTick()
  scrollWorkspaceIntoView()
}

watch(isWorking, value => {
  if (value) {
    heroMode.value = 'workspace'
  }
})
</script>

<template>
  <div class="cinematic-home" :class="{ 'is-workspace': heroMode === 'workspace' }">
    <CinematicHeroStage class="hero-stage-shell">
      <div class="hero-stage-inner">
        <HeroCopyBlock
          :headline="HOME_HERO_COPY.headline"
          :subtitle="HOME_HERO_COPY.subtitle"
          :cta="HOME_HERO_COPY.cta"
          @start="enterWorkspace"
        />
      </div>
    </CinematicHeroStage>

    <section ref="workspaceRef" class="workspace-reveal" :class="{ visible: heroMode === 'workspace' }">
      <div class="workspace-surface">
        <HomeWorkspace />
      </div>
    </section>
  </div>
</template>

<style scoped>
.cinematic-home {
  background:
    radial-gradient(circle at top, rgba(76, 99, 158, 0.16), transparent 28%),
    linear-gradient(180deg, #06070d 0%, #05060a 44%, #090d17 100%);
}

.hero-stage-shell {
  position: relative;
}

.hero-stage-inner {
  display: flex;
  align-items: flex-start;
  min-height: 100vh;
}

.workspace-reveal {
  position: relative;
  margin-top: -5rem;
  padding: 0 0 4rem;
  opacity: 0.74;
  transform: translateY(3.5rem);
  transition:
    opacity 420ms ease,
    transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
}

.workspace-reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

.workspace-surface {
  position: relative;
  margin: 0 auto;
  width: min(100% - 2rem, 92rem);
  border-radius: 2rem 2rem 0 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(12, 14, 22, 0.96), rgba(9, 11, 18, 0.98)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 42%);
  box-shadow:
    0 -1px 0 rgba(255, 255, 255, 0.04),
    0 -30px 80px rgba(0, 0, 0, 0.28);
  overflow: clip;
}

@media (max-width: 720px) {
  .workspace-reveal {
    margin-top: -2rem;
  }

  .workspace-surface {
    width: calc(100% - 1rem);
    border-radius: 1.5rem 1.5rem 0 0;
  }
}
</style>
