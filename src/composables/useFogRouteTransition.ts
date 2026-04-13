import { computed, ref } from 'vue'
import type { Router } from 'vue-router'

export type FogTransitionPhase = 'idle' | 'defocus' | 'veil' | 'reveal'
type FogTransitionOptions = {
  preload?: () => Promise<unknown>
}

const phase = ref<FogTransitionPhase>('idle')
const prefersReducedMotion = ref(false)
const isTransitioning = ref(false)

const isActive = computed(() => phase.value !== 'idle')

let reducedMotionInitialized = false

const initReducedMotionPreference = () => {
  if (reducedMotionInitialized || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return
  }

  reducedMotionInitialized = true
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const wait = (delay: number) => new Promise(resolve => setTimeout(resolve, delay))
const waitForNextPaint = () => new Promise<void>(resolve => {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    resolve()
    return
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => resolve())
  })
})

export const navigateWithFogTransition = async (router: Router, to: string, options?: FogTransitionOptions) => {
  initReducedMotionPreference()

  if (isTransitioning.value) {
    return
  }

  isTransitioning.value = true

  try {
    const preloadTask = options?.preload?.() ?? Promise.resolve()

    if (prefersReducedMotion.value) {
      await preloadTask
      await router.push(to)
      phase.value = 'idle'
      return
    }

    phase.value = 'defocus'
    await wait(70)
    phase.value = 'veil'
    await wait(130)
    await preloadTask
    await router.push(to)
    await waitForNextPaint()
    phase.value = 'reveal'
    await wait(150)
    phase.value = 'idle'
  } finally {
    isTransitioning.value = false
  }
}

export const useFogRouteTransition = () => {
  initReducedMotionPreference()

  return {
    phase,
    isActive,
    prefersReducedMotion
  }
}
