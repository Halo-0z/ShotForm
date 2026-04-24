<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResolvedThemeState } from '@/composables/useResolvedThemeState'
import { getHeroFigureScale } from '@/lib/home-hero-scale.js'

interface HeroFigure {
  src: string
  flip: boolean
  visualScale?: number
  posterScale?: number
  liftY?: string
  posterLiftY?: string
}

const HERO_FIGURES: readonly HeroFigure[] = [
  {
    src: '/hero/luka2.png',
    flip: false
  },
  {
    src: '/hero/kobe-shot.png',
    flip: false
  },
  {
    src: '/hero/jordan-shot-2.png',
    flip: false,
    visualScale: 1.04,
    posterScale: 0.92,
    liftY: 'clamp(0.3rem, 1vh, 0.8rem)',
    posterLiftY: 'clamp(0.1rem, 0.45vh, 0.35rem)'
  },
  {
    src: '/hero/dirk-shot.png',
    flip: false
  }
]

const CAROUSEL_INTERVAL_MS = 6000
const FIGURE_EXIT_ANIMATION_MS = 1250
const HERO_FIGURE_BASELINE_SRC = HERO_FIGURES[0].src

const props = withDefaults(
  defineProps<{
    videoSrc?: string
    posterSrc?: string
    figureSrc?: string
    reduceMotion?: boolean
    transitioningOut?: boolean
  }>(),
  {
    videoSrc: '/hero/home-hero-loop.mp4',
    posterSrc: '/hero/luka2.png',
    figureSrc: '',
    reduceMotion: false,
    transitioningOut: false
  }
)

const videoFailed = ref(false)
const videoReady = ref(false)
const { isLightTheme } = useResolvedThemeState()
const figureMetrics = ref<Record<string, { width: number; height: number }>>({})
const heroStageEl = ref<HTMLElement | null>(null)
const figureShellEl = ref<HTMLElement | null>(null)
const figureLayoutFrame = ref<{ shellWidth: number; availableHeight: number } | null>(null)

const currentIndex = ref(0)
const previousFigure = ref<HeroFigure | null>(null)
const carouselReady = ref(false)
let carouselTimer: ReturnType<typeof setInterval> | null = null
let previousFigureTimer: ReturnType<typeof setTimeout> | null = null

const effectiveFigures = computed<HeroFigure[]>(() => {
  if (props.figureSrc) {
    return [
      {
        src: props.figureSrc,
        flip: false
      }
    ]
  }

  return [...HERO_FIGURES]
})

const currentFigure = computed(() => {
  const figures = effectiveFigures.value
  if (!figures.length) return HERO_FIGURES[0]
  if (props.reduceMotion) return figures[0]
  return figures[currentIndex.value % figures.length] || figures[0]
})

const currentFigureSrc = computed(() => currentFigure.value.src)
const hasPreviousFigure = computed(() => Boolean(previousFigure.value))

const normalizeFigureScale = (figure: HeroFigure, scale: number) => {
  return scale * (figure.visualScale ?? 1)
}

const currentFigureScale = computed(() => {
  return getHeroFigureScale(
    figureMetrics.value[currentFigureSrc.value] ?? null,
    figureMetrics.value[HERO_FIGURE_BASELINE_SRC] ?? null,
    figureLayoutFrame.value
  )
})

const currentPosterFigureSrc = computed(() => {
  return props.figureSrc ? props.figureSrc : currentFigureSrc.value
})

const createPosterFigureStyle = (figure: HeroFigure, scale: number) => ({
  '--hero-poster-image': figure.src ? `url("${figure.src}")` : 'none',
  '--hero-poster-scale': String(scale * (figure.posterScale ?? 1)),
  '--hero-poster-lift-y': figure.posterLiftY ?? figure.liftY ?? '0px'
})

const currentPosterFigureStyle = computed(() => {
  return createPosterFigureStyle(
    {
      ...currentFigure.value,
      src: currentPosterFigureSrc.value
    },
    currentFigureScale.value
  )
})

const previousFigureScale = computed(() => {
  if (!previousFigure.value) return 1

  return getHeroFigureScale(
    figureMetrics.value[previousFigure.value.src] ?? null,
    figureMetrics.value[HERO_FIGURE_BASELINE_SRC] ?? null,
    figureLayoutFrame.value
  )
})

const previousPosterFigureStyle = computed(() => {
  if (!previousFigure.value) {
    return {
      '--hero-poster-image': 'none',
      '--hero-poster-scale': '1',
      '--hero-poster-lift-y': '0px'
    }
  }

  return createPosterFigureStyle(previousFigure.value, previousFigureScale.value)
})

const createFigureMotionStyle = (figure: HeroFigure, scale: number) => {
  const visualScale = normalizeFigureScale(figure, scale)

  return {
    '--hero-figure-scale-x': String(figure.flip ? -visualScale : visualScale),
    '--hero-figure-scale-y': String(visualScale),
    '--hero-figure-lift-y': figure.liftY ?? '0px'
  }
}

const currentFigureMotionStyle = computed(() => {
  return createFigureMotionStyle(currentFigure.value, currentFigureScale.value)
})

const previousFigureMotionStyle = computed(() => {
  if (!previousFigure.value) {
    return {
      '--hero-figure-scale-x': '1',
      '--hero-figure-scale-y': '1',
      '--hero-figure-lift-y': '0px'
    }
  }

  return createFigureMotionStyle(previousFigure.value, previousFigureScale.value)
})

const hasVideo = computed(() => {
  return Boolean(props.videoSrc) && !videoFailed.value && !props.reduceMotion && !props.transitioningOut
})

const resetVideoState = () => {
  videoFailed.value = false
  videoReady.value = false
}

const handleVideoError = () => {
  videoFailed.value = true
  videoReady.value = false
}

const handleVideoCanPlay = () => {
  videoReady.value = true
}

const advanceCarousel = () => {
  if (props.reduceMotion || props.transitioningOut || !carouselReady.value) return

  const figures = effectiveFigures.value
  if (figures.length <= 1) return

  previousFigure.value = currentFigure.value
  if (previousFigureTimer !== null) {
    clearTimeout(previousFigureTimer)
  }

  currentIndex.value = (currentIndex.value + 1) % figures.length
  previousFigureTimer = setTimeout(() => {
    previousFigure.value = null
    previousFigureTimer = null
  }, FIGURE_EXIT_ANIMATION_MS)
}

const stopCarousel = () => {
  if (carouselTimer !== null) {
    clearInterval(carouselTimer)
    carouselTimer = null
  }
}

const startCarousel = () => {
  stopCarousel()
  if (!carouselReady.value || effectiveFigures.value.length <= 1 || props.reduceMotion) return
  carouselTimer = setInterval(advanceCarousel, CAROUSEL_INTERVAL_MS)
}

const parseResolvedPixels = (value: string) => {
  const pixels = Number.parseFloat(value)
  return Number.isFinite(pixels) ? pixels : 0
}

const updateFigureLayoutFrame = () => {
  const stageEl = heroStageEl.value
  const shellEl = figureShellEl.value
  if (!stageEl || !shellEl) return

  const stageStyles = window.getComputedStyle(stageEl)
  const topSafeClearance = parseResolvedPixels(stageStyles.getPropertyValue('--hero-top-safe-clearance'))
  const bottomSafeClearance = parseResolvedPixels(stageStyles.getPropertyValue('--hero-bottom-safe-clearance'))
  const shellWidth = shellEl.getBoundingClientRect().width
  const availableHeight = stageEl.getBoundingClientRect().height - topSafeClearance - bottomSafeClearance

  if (shellWidth <= 0 || availableHeight <= 0) return

  figureLayoutFrame.value = {
    shellWidth,
    availableHeight
  }
}

const loadFigureMetrics = async (src: string) => {
  if (!src || figureMetrics.value[src]) return

  const image = new Image()
  image.decoding = 'async'
  const loaded = new Promise<void>(resolve => {
    image.onload = () => resolve()
    image.onerror = () => resolve()
  })

  image.src = src
  await loaded

  try {
    await image.decode()
  } catch {
    // Some browsers reject decode() for already-cached images; dimensions are still usable.
  }

  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height

  if (!width || !height) return

  figureMetrics.value = {
    ...figureMetrics.value,
    [src]: { width, height }
  }
}

const preloadImages = async () => {
  const sources = new Set(HERO_FIGURES.map(figure => figure.src))

  if (props.figureSrc) {
    sources.add(props.figureSrc)
  }

  await Promise.all([...sources].map(src => loadFigureMetrics(src)))
}

watch(() => props.videoSrc, resetVideoState)

watch(
  () => props.reduceMotion,
  reduceMotion => {
    if (reduceMotion) {
      videoReady.value = false
      currentIndex.value = 0
      previousFigure.value = null
      stopCarousel()
      return
    }

    startCarousel()
  }
)

watch(
  () => props.transitioningOut,
  transitioningOut => {
    if (transitioningOut) {
      videoReady.value = false
      stopCarousel()
    }
  }
)

watch(
  () => props.figureSrc,
  async () => {
    currentIndex.value = 0
    previousFigure.value = null
    carouselReady.value = false
    stopCarousel()

    if (props.figureSrc) {
      await loadFigureMetrics(props.figureSrc)
    }

    if (props.reduceMotion || props.transitioningOut) {
      return
    }

    carouselReady.value = true
    startCarousel()
  }
)

onMounted(async () => {
  updateFigureLayoutFrame()
  window.addEventListener('resize', updateFigureLayoutFrame)
  await preloadImages()
  carouselReady.value = true

  if (!props.reduceMotion) {
    startCarousel()
  }
})

onBeforeUnmount(() => {
  stopCarousel()
  if (previousFigureTimer !== null) {
    clearTimeout(previousFigureTimer)
    previousFigureTimer = null
  }
  window.removeEventListener('resize', updateFigureLayoutFrame)
})
</script>

<template>
  <section
    ref="heroStageEl"
    class="hero-stage"
    :class="{ 'is-transitioning-out': props.transitioningOut, 'light-mode': isLightTheme }"
  >
    <div class="hero-video-poster" aria-hidden="true"></div>
    <div
      :key="`poster-${currentFigureSrc}`"
      class="hero-poster-figure hero-poster-figure-active"
      :class="{ 'is-transitioning-out': props.transitioningOut }"
      :style="currentPosterFigureStyle"
      aria-hidden="true"
    ></div>
    <div
      v-if="hasPreviousFigure && previousFigure"
      :key="`poster-prev-${previousFigure.src}`"
      class="hero-poster-figure hero-poster-figure-prev"
      :style="previousPosterFigureStyle"
      aria-hidden="true"
    ></div>
    <video
      v-if="hasVideo"
      class="hero-video"
      :class="{ 'is-ready': videoReady }"
      :src="videoSrc"
      :poster="posterSrc"
      autoplay
      muted
      loop
      playsinline
      @canplay="handleVideoCanPlay"
      @error="handleVideoError"
    ></video>
    <div class="hero-atmosphere-fallback" aria-hidden="true"></div>
    <div class="hero-grain" aria-hidden="true"></div>
    <div class="hero-vignette" aria-hidden="true"></div>
    <div class="hero-content-layer">
      <slot />
    </div>
    <div
      ref="figureShellEl"
      class="hero-figure-shell"
      :class="{ 'is-transitioning-out': props.transitioningOut }"
      aria-hidden="true"
    >
      <img
        :key="`a-${currentFigureSrc}`"
        :src="currentFigureSrc"
        alt=""
        class="hero-figure hero-figure-active"
        :style="currentFigureMotionStyle"
      />
      <template v-if="hasPreviousFigure && previousFigure">
        <img
          :key="`p-${previousFigure.src}`"
          :src="previousFigure.src"
          alt=""
          class="hero-figure hero-figure-prev"
          :style="previousFigureMotionStyle"
        />
      </template>
    </div>
  </section>
</template>

<style scoped>
.hero-stage {
  --hero-top-safe-clearance: clamp(3.35rem, 4.8vh, 4.35rem);
  --hero-bottom-safe-clearance: clamp(0.35rem, 1vh, 1rem);
  --hero-figure-width: clamp(17.8rem, min(22vw, 36vh), 24.5rem);
  --hero-figure-right: clamp(-0.5rem, 1.8vw, 2rem);
  --hero-figure-bottom: clamp(2rem, 5vh, 4.5rem);
  --hero-poster-width: clamp(19.6rem, min(24vw, 40vh), 27rem);
  --hero-poster-right-offset: clamp(8rem, 11.5vw, 13rem);
  --hero-poster-bottom-position: calc(100% + clamp(0.9rem, 1.7vh, 1.85rem));
  --hero-stage-background:
    radial-gradient(circle at 70% 12%, rgba(102, 124, 178, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(7, 9, 15, 0.92), rgba(4, 5, 10, 0.99));
  --hero-video-ready-opacity: 0.24;
  --hero-video-ready-filter: none;
  --hero-video-ready-blend: normal;
  --hero-video-poster-image:
    radial-gradient(circle at 72% 14%, rgba(120, 144, 206, 0.16), transparent 18%),
    radial-gradient(circle at 22% 78%, rgba(88, 111, 168, 0.18), transparent 24%),
    linear-gradient(180deg, rgba(8, 12, 22, 0.72), rgba(4, 6, 12, 0.96));
  --hero-video-poster-opacity: 0.92;
  --hero-poster-figure-opacity: 0.14;
  --hero-poster-figure-filter: blur(0.9px);
  --hero-atmosphere-background:
    radial-gradient(circle at 24% 24%, rgba(255, 255, 255, 0.06), transparent 20%),
    radial-gradient(circle at 72% 32%, rgba(108, 132, 196, 0.12), transparent 24%),
    radial-gradient(circle at 52% 84%, rgba(255, 214, 171, 0.08), transparent 26%);
  --hero-atmosphere-blur: 14px;
  --hero-atmosphere-opacity: 0.78;
  --hero-grain-opacity: 0.022;
  --hero-grain-blend: soft-light;
  --hero-vignette-background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.22), transparent 25%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.54), transparent 40%);
  --hero-figure-shell-shadow: rgba(0, 0, 0, 0.38);
  position: relative;
  min-height: 100vh;
  overflow: clip;
  background: var(--hero-stage-background);
}

.hero-video,
.hero-video-poster,
.hero-poster-figure,
.hero-grain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-video {
  opacity: 0;
  object-fit: cover;
  /* object-cover */
  mix-blend-mode: var(--hero-video-ready-blend);
  transition:
    opacity 720ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 720ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-video.is-ready {
  opacity: var(--hero-video-ready-opacity);
  filter: var(--hero-video-ready-filter);
}

.hero-video-poster {
  background-image: var(--hero-video-poster-image);
  background-position: center, center, center;
  background-repeat: no-repeat;
  background-size: auto, auto, auto;
  opacity: var(--hero-video-poster-opacity);
}

.hero-poster-figure {
  background-image: var(--hero-poster-image);
  background-position:
    calc(100% - var(--hero-poster-right-offset))
    calc(var(--hero-poster-bottom-position) - var(--hero-poster-lift-y, 0px));
  background-repeat: no-repeat;
  background-size: calc(var(--hero-poster-width) * var(--hero-poster-scale, 1)) auto;
  opacity: 0;
  transform: translate3d(0, 0, 0);
  filter: var(--hero-poster-figure-filter);
  will-change: opacity, transform;
}

.hero-poster-figure-active {
  animation: hero-poster-fade-in 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.hero-poster-figure-prev {
  pointer-events: none;
  animation: hero-poster-fade-out 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.hero-stage.is-transitioning-out .hero-poster-figure,
.hero-poster-figure.is-transitioning-out {
  opacity: 0.08;
  transform: translate3d(0.75rem, -0.25rem, 0) scale(0.985);
  filter: blur(0);
}

.hero-atmosphere-fallback {
  position: absolute;
  inset: 0;
  background: var(--hero-atmosphere-background);
  filter: blur(var(--hero-atmosphere-blur));
  opacity: var(--hero-atmosphere-opacity);
}

.hero-stage.is-transitioning-out .hero-atmosphere-fallback {
  filter: blur(8px);
  opacity: 0.56;
}

.hero-grain {
  opacity: var(--hero-grain-opacity);
  mix-blend-mode: var(--hero-grain-blend);
  background-image:
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.11) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.14) 0 1px, transparent 1px 4px);
  background-size: 3px 3px, 4px 4px;
  pointer-events: none;
}

.hero-vignette {
  position: absolute;
  inset: 0;
  background: var(--hero-vignette-background);
}

.hero-content-layer {
  position: relative;
  z-index: 2;
}

.hero-figure-shell {
  position: absolute;
  right: var(--hero-figure-right);
  bottom: var(--hero-figure-bottom);
  z-index: 1;
  width: var(--hero-figure-width);
  min-width: 16rem;
  pointer-events: none;
  transition:
    opacity 320ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 320ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform, filter;
}

.hero-stage.is-transitioning-out .hero-figure-shell,
.hero-figure-shell.is-transitioning-out {
  opacity: 0.12;
  transform: translate3d(0.8rem, -0.65rem, 0) scale(0.99);
  filter: blur(0);
}

.hero-figure-shell::before {
  content: '';
  position: absolute;
  inset: auto 12% 2% 12%;
  height: 18%;
  border-radius: 999px;
  background: var(--hero-figure-shell-shadow);
  filter: blur(26px);
}

.hero-stage.is-transitioning-out .hero-figure-shell::before {
  filter: blur(8px);
  opacity: 0.42;
}

.hero-figure {
  position: absolute;
  bottom: 0;
  right: 0;
  display: block;
  width: 100%;
  height: auto;
  max-height: calc(100vh - var(--hero-top-safe-clearance) - var(--hero-bottom-safe-clearance));
  transform-origin: right bottom;
  will-change: opacity, transform;
  backface-visibility: hidden;
  contain: paint;
}

.hero-figure-active {
  opacity: 1;
  animation: hero-float-in 1400ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.hero-figure-prev {
  opacity: 0;
  pointer-events: none;
  animation: hero-float-out 1200ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.hero-stage.light-mode {
  --hero-stage-background:
    radial-gradient(circle at 18% 68%, rgba(103, 142, 214, 0.16), transparent 20%),
    radial-gradient(circle at 30% 78%, rgba(247, 156, 120, 0.14), transparent 24%),
    radial-gradient(circle at 88% 84%, rgba(255, 215, 132, 0.15), transparent 16%),
    linear-gradient(180deg, #fcfaf6 0%, #faf7f1 48%, #f6f0e8 100%);
  --hero-video-ready-opacity: 0;
  --hero-video-ready-filter: saturate(0.6) brightness(1.35) blur(4px);
  --hero-video-ready-blend: normal;
  --hero-video-poster-image:
    radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
    radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
    radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
    linear-gradient(180deg, rgba(255, 252, 248, 0.9), rgba(250, 246, 239, 0.96));
  --hero-video-poster-opacity: 1;
  --hero-poster-figure-opacity: 0.06;
  --hero-poster-figure-filter: blur(1.2px) saturate(0.92);
  --hero-atmosphere-background:
    radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
    radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
    radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
    radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
  --hero-atmosphere-blur: 34px;
  --hero-atmosphere-opacity: 1;
  --hero-grain-opacity: 0.04;
  --hero-grain-blend: multiply;
  --hero-vignette-background:
    radial-gradient(circle at 84% 14%, rgba(255, 255, 255, 0.48), transparent 18%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 28%),
    linear-gradient(0deg, rgba(237, 228, 216, 0.2), transparent 36%);
  --hero-figure-shell-shadow: rgba(179, 142, 111, 0.18);
}

@keyframes hero-poster-fade-in {
  0% {
    opacity: 0;
    transform: translate3d(0.45rem, 0.15rem, 0);
  }

  100% {
    opacity: var(--hero-poster-figure-opacity);
    transform: translate3d(0, 0, 0);
  }
}

@keyframes hero-poster-fade-out {
  0% {
    opacity: var(--hero-poster-figure-opacity);
    transform: translate3d(0, 0, 0);
  }

  100% {
    opacity: 0;
    transform: translate3d(-0.35rem, -0.12rem, 0);
  }
}

@keyframes hero-float-in {
  0% {
    opacity: 0;
    transform: translateY(calc(20px - var(--hero-figure-lift-y, 0px))) scale(
      var(--hero-figure-scale-x, 1),
      var(--hero-figure-scale-y, 1)
    );
  }

  60% {
    opacity: 0.85;
    transform: translateY(calc(3px - var(--hero-figure-lift-y, 0px))) scale(
      var(--hero-figure-scale-x, 1),
      var(--hero-figure-scale-y, 1)
    );
  }

  100% {
    opacity: 1;
    transform: translateY(calc(0px - var(--hero-figure-lift-y, 0px))) scale(
      var(--hero-figure-scale-x, 1),
      var(--hero-figure-scale-y, 1)
    );
  }
}

@keyframes hero-float-out {
  0% {
    opacity: 0.7;
    transform: translateY(calc(0px - var(--hero-figure-lift-y, 0px))) scale(
      var(--hero-figure-scale-x, 1),
      var(--hero-figure-scale-y, 1)
    );
  }

  100% {
    opacity: 0;
    transform: translateY(calc(-16px - var(--hero-figure-lift-y, 0px))) scale(
      var(--hero-figure-scale-x, 1),
      var(--hero-figure-scale-y, 1)
    );
  }
}

@media (max-width: 900px) {
  .hero-stage {
    --hero-top-safe-clearance: 3.25rem;
    --hero-bottom-safe-clearance: 0.3rem;
    --hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
    --hero-figure-right: -0.6rem;
    --hero-figure-bottom: 0.15rem;
    --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem);
    --hero-poster-right-offset: clamp(7rem, 10vw, 9.5rem);
    --hero-poster-bottom-position: calc(100% + 0.95rem);
  }

  .hero-figure-shell {
    opacity: 0.88;
  }

  .hero-figure-active {
    animation-duration: 1000ms;
  }

  .hero-figure-prev {
    animation-duration: 800ms;
  }
}

@media (max-width: 640px) {
  .hero-stage {
    --hero-top-safe-clearance: 3.1rem;
    --hero-bottom-safe-clearance: 0.2rem;
    --hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
    --hero-figure-right: -1.5rem;
    --hero-figure-bottom: 0.1rem;
    --hero-poster-width: clamp(14.6rem, 54vw, 16.5rem);
    --hero-poster-right-offset: clamp(5rem, 8vw, 6.5rem);
    --hero-poster-bottom-position: calc(100% + 0.8rem);
  }

  .hero-figure-active {
    animation-duration: 800ms;
  }

  .hero-figure-prev {
    animation-duration: 600ms;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-figure-active {
    animation: none;
    opacity: 1;
    transform: translateY(calc(0px - var(--hero-figure-lift-y, 0px))) scale(
      var(--hero-figure-scale-x, 1),
      var(--hero-figure-scale-y, 1)
    );
  }

  .hero-figure-prev {
    animation: none;
    opacity: 0;
  }

  .hero-stage {
    transition: none;
  }

  .hero-atmosphere-fallback {
    transition: none;
  }

  .hero-figure-shell::before {
    transition: none;
  }
}
</style>
