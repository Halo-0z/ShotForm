<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CinematicHeroStage from '@/components/home/CinematicHeroStage.vue'
import HeroCopyBlock from '@/components/home/HeroCopyBlock.vue'
import { navigateWithFogTransition } from '@/composables/useFogRouteTransition'
import { HOME_HERO_COPY, shouldReduceHeroMotion } from '@/lib/home-hero-state.js'

type HeroCopyMotionMode = 'intro' | 'settled'

const router = useRouter()
const reduceMotion = ref(false)
const heroCopyMotionMode = ref<HeroCopyMotionMode>('intro')
const isTransitioningToUpload = ref(false)

const HERO_COPY_INTRO_DURATION = 1400

let motionQuery: MediaQueryList | null = null
let heroCopySettleTimer: ReturnType<typeof setTimeout> | null = null

const clearHeroCopySettleTimer = () => {
  if (!heroCopySettleTimer) {
    return
  }

  clearTimeout(heroCopySettleTimer)
  heroCopySettleTimer = null
}

const settleHeroCopyMotion = () => {
  clearHeroCopySettleTimer()
  heroCopyMotionMode.value = 'settled'
}

const scheduleHeroCopySettle = (delay: number) => {
  clearHeroCopySettleTimer()
  heroCopySettleTimer = setTimeout(() => {
    heroCopyMotionMode.value = 'settled'
    heroCopySettleTimer = null
  }, delay)
}

const syncReduceMotion = (matches: boolean) => {
  reduceMotion.value = shouldReduceHeroMotion(matches)
}

const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
  syncReduceMotion(event.matches)

  if (reduceMotion.value) {
    settleHeroCopyMotion()
  }
}

const handleStartAnalysis = async () => {
  isTransitioningToUpload.value = true

  try {
    await navigateWithFogTransition(router, '/upload', {
      preload: () => import('@/views/Upload.vue')
    })
  } finally {
    isTransitioningToUpload.value = false
  }
}

onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  syncReduceMotion(motionQuery.matches)

  if (reduceMotion.value) {
    settleHeroCopyMotion()
  } else {
    scheduleHeroCopySettle(HERO_COPY_INTRO_DURATION)
  }

  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', handleMotionPreferenceChange)
    return
  }

  motionQuery.addListener(handleMotionPreferenceChange)
})

onBeforeUnmount(() => {
  clearHeroCopySettleTimer()

  if (!motionQuery) {
    return
  }

  if (typeof motionQuery.removeEventListener === 'function') {
    motionQuery.removeEventListener('change', handleMotionPreferenceChange)
    return
  }

  motionQuery.removeListener(handleMotionPreferenceChange)
})
</script>

<template>
  <div class="cinematic-home" :class="{ 'reduced-motion': reduceMotion }">
    <CinematicHeroStage
      class="hero-stage-shell"
      :reduce-motion="reduceMotion"
      :transitioning-out="isTransitioningToUpload"
    >
      <div class="hero-stage-inner">
        <HeroCopyBlock
          :headline="HOME_HERO_COPY.headline"
          :subtitle="HOME_HERO_COPY.subtitle"
          :cta="HOME_HERO_COPY.cta"
          :motion-mode="heroCopyMotionMode"
          @start="handleStartAnalysis"
        />
      </div>
    </CinematicHeroStage>
  </div>
</template>

<style scoped>
.cinematic-home {
  min-height: 100%;
  background: transparent;
}

.hero-stage-shell {
  position: relative;
}

.hero-stage-inner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 100vh;
  padding: clamp(3.6rem, 8vh, 5.2rem) clamp(1.1rem, 3.2vw, 3.2rem) clamp(3rem, 8vh, 4.8rem);
}
</style>
