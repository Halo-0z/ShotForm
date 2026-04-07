<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CinematicHeroStage from '@/components/home/CinematicHeroStage.vue'
import HeroCopyBlock from '@/components/home/HeroCopyBlock.vue'
import { navigateWithFogTransition } from '@/composables/useFogRouteTransition'
import {
  HOME_HERO_COPY,
  HOME_HERO_ROTATION_MS,
  HOME_HERO_SLIDES,
  shouldReduceHeroMotion
} from '@/lib/home-hero-state.js'

type HeroCopyMotionMode = 'intro' | 'return' | 'settled'

const router = useRouter()
const reduceMotion = ref(false)
const heroCopyMotionMode = ref<HeroCopyMotionMode>('intro')
const isTransitioningToUpload = ref(false)
const activeHeroIndex = ref(0)
const activeHeroSlide = computed(() => HOME_HERO_SLIDES[activeHeroIndex.value] ?? HOME_HERO_SLIDES[0])
const preloadUploadPage = () => import('@/views/Upload.vue')

const HERO_COPY_INTRO_DURATION = 1400

let motionQuery: MediaQueryList | null = null
let heroCopySettleTimer: ReturnType<typeof setTimeout> | null = null
let heroRotationTimer: ReturnType<typeof setInterval> | null = null
let uploadPreloadTimer: ReturnType<typeof setTimeout> | null = null
let uploadPreloadIdleCallbackId: number | null = null

const clearHeroCopySettleTimer = () => {
  if (!heroCopySettleTimer) {
    return
  }

  clearTimeout(heroCopySettleTimer)
  heroCopySettleTimer = null
}

const clearUploadPreloadSchedule = () => {
  if (uploadPreloadTimer) {
    clearTimeout(uploadPreloadTimer)
    uploadPreloadTimer = null
  }

  if (uploadPreloadIdleCallbackId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(uploadPreloadIdleCallbackId)
    uploadPreloadIdleCallbackId = null
  }
}

const clearHeroRotationTimer = () => {
  if (!heroRotationTimer) {
    return
  }

  clearInterval(heroRotationTimer)
  heroRotationTimer = null
}

const advanceHeroSlide = () => {
  if (HOME_HERO_SLIDES.length <= 1) {
    return
  }

  activeHeroIndex.value = (activeHeroIndex.value + 1) % HOME_HERO_SLIDES.length
}

const syncHeroRotation = () => {
  clearHeroRotationTimer()

  if (reduceMotion.value || isTransitioningToUpload.value || HOME_HERO_SLIDES.length <= 1) {
    return
  }

  heroRotationTimer = setInterval(() => {
    advanceHeroSlide()
  }, HOME_HERO_ROTATION_MS)
}

const scheduleUploadPreload = () => {
  clearUploadPreloadSchedule()

  if (typeof window === 'undefined') {
    return
  }

  if (typeof window.requestIdleCallback === 'function') {
    uploadPreloadIdleCallbackId = window.requestIdleCallback(() => {
      uploadPreloadIdleCallbackId = null
      void preloadUploadPage()
    }, { timeout: 900 })
    return
  }

  uploadPreloadTimer = setTimeout(() => {
    uploadPreloadTimer = null
    void preloadUploadPage()
  }, 180)
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

  if (reduceMotion.value) {
    activeHeroIndex.value = 0
  }
}

const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
  syncReduceMotion(event.matches)

  if (reduceMotion.value) {
    settleHeroCopyMotion()
  }
}

const handleStartAnalysis = async () => {
  isTransitioningToUpload.value = true
  clearUploadPreloadSchedule()
  clearHeroRotationTimer()

  try {
    await navigateWithFogTransition(router, '/upload', {
      preload: preloadUploadPage
    })
  } finally {
    isTransitioningToUpload.value = false
  }
}

watch([reduceMotion, isTransitioningToUpload], () => {
  syncHeroRotation()
})

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

  scheduleUploadPreload()
  syncHeroRotation()

  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', handleMotionPreferenceChange)
    return
  }

  motionQuery.addListener(handleMotionPreferenceChange)
})

onBeforeUnmount(() => {
  clearHeroCopySettleTimer()
  clearHeroRotationTimer()
  clearUploadPreloadSchedule()

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
      :slide-id="activeHeroSlide.id"
      :video-src="activeHeroSlide.videoSrc ?? ''"
      :figure-src="activeHeroSlide.figureSrc"
      :poster-src="activeHeroSlide.posterSrc ?? activeHeroSlide.figureSrc"
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
