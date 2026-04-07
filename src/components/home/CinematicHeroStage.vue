<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useResolvedThemeState } from '@/composables/useResolvedThemeState'

const props = withDefaults(
  defineProps<{
    videoSrc?: string
    posterSrc?: string
    figureSrc?: string
    slideId?: string
    reduceMotion?: boolean
    transitioningOut?: boolean
    workspaceActive?: boolean
  }>(),
  {
    videoSrc: '/hero/home-hero-loop.mp4',
    posterSrc: '/hero/luka2.png',
    figureSrc: '/hero/luka2.png',
    slideId: 'luka',
    reduceMotion: false,
    transitioningOut: false,
    workspaceActive: false
  }
)

const videoFailed = ref(false)
const videoReady = ref(false)
const { isLightTheme } = useResolvedThemeState()

const hasVideo = computed(() => Boolean(props.videoSrc) && !videoFailed.value && !props.reduceMotion && !props.transitioningOut)
const heroSlideClass = computed(() => (props.slideId ? `slide-${props.slideId}` : 'slide-luka'))
const activePosterKey = computed(() => `poster-${props.slideId || props.posterSrc || 'default'}`)
const activeFigureKey = computed(() => `figure-${props.slideId || props.figureSrc || 'default'}`)

const posterStyle = computed(() => ({
  '--hero-poster-image': props.posterSrc ? `url("${props.posterSrc}")` : 'none'
}))

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

watch(() => props.videoSrc, resetVideoState)
watch(() => props.reduceMotion, reduceMotion => {
  if (reduceMotion) {
    videoReady.value = false
  }
})

watch(() => props.transitioningOut, transitioningOut => {
  if (transitioningOut) {
    videoReady.value = false
  }
})
</script>

<template>
  <section
    class="hero-stage"
    :class="[heroSlideClass, { 'is-transitioning-out': props.transitioningOut, 'light-mode': isLightTheme }]"
  >
    <div class="hero-video-poster" aria-hidden="true" :style="posterStyle"></div>
    <Transition name="hero-poster-swap" mode="out-in">
      <div
        :key="activePosterKey"
        class="hero-poster-figure"
        :class="{ 'is-hidden': props.workspaceActive, 'is-transitioning-out': props.transitioningOut }"
        :style="posterStyle"
        aria-hidden="true"
      ></div>
    </Transition>
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

    <Transition name="hero-figure-swap" mode="out-in">
      <div
        :key="activeFigureKey"
        class="hero-figure-shell"
        :class="{ 'is-hidden': props.workspaceActive, 'is-transitioning-out': props.transitioningOut }"
        aria-hidden="true"
      >
        <img :src="figureSrc" alt="" class="hero-figure" />
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.hero-stage {
  --hero-top-safe-clearance: clamp(3.35rem, 4.8vh, 4.35rem);
  --hero-bottom-safe-clearance: clamp(0.35rem, 1vh, 1rem);
  --hero-figure-width: clamp(17.8rem, min(22vw, 36vh), 24.5rem);
  --hero-figure-right: clamp(-0.5rem, 1.8vw, 2rem);
  --hero-figure-bottom: clamp(-0.25rem, -0.5vh, 0.35rem);
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
  --hero-figure-shadow:
    drop-shadow(0 24px 36px rgba(0, 0, 0, 0.42))
    drop-shadow(0 0 18px rgba(167, 189, 255, 0.08));
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
  object-fit: cover; /* object-cover */
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
  background-position:
    center,
    center,
    center;
  background-repeat: no-repeat;
  background-size:
    auto,
    auto,
    auto;
  opacity: var(--hero-video-poster-opacity);
}

.hero-poster-figure {
  background-image: var(--hero-poster-image);
  background-position: calc(100% - var(--hero-poster-right-offset)) var(--hero-poster-bottom-position);
  background-repeat: no-repeat;
  background-size: var(--hero-poster-width) auto;
  opacity: var(--hero-poster-figure-opacity);
  transform: translate3d(0, 0, 0);
  filter: var(--hero-poster-figure-filter);
  transition:
    opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 460ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 360ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform, filter;
}

.hero-poster-figure.is-hidden {
  opacity: 0;
  transform: translate3d(2.25rem, -1.25rem, 0) scale(0.95);
  filter: blur(12px);
}

.hero-stage.is-transitioning-out .hero-poster-figure,
.hero-poster-figure.is-transitioning-out {
  opacity: 0.08;
  transform: translate3d(0.75rem, -0.25rem, 0) scale(0.985);
  filter: blur(0);
}

.hero-poster-swap-enter-active {
  transition:
    opacity 560ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 620ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 560ms cubic-bezier(0.16, 1, 0.3, 1);
}

.hero-poster-swap-leave-active {
  transition:
    opacity 260ms cubic-bezier(0.4, 0, 1, 1),
    transform 320ms cubic-bezier(0.4, 0, 1, 1),
    filter 260ms cubic-bezier(0.4, 0, 1, 1);
}

.hero-poster-swap-enter-from {
  opacity: 0;
  transform: translate3d(1.8rem, -1rem, 0) scale(0.95);
  filter: blur(16px) saturate(0.88);
}

.hero-poster-swap-leave-to {
  opacity: 0;
  transform: translate3d(-0.6rem, 0.7rem, 0) scale(1.02);
  filter: blur(14px) saturate(0.9);
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
    repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.11) 0 1px,
      transparent 1px 3px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.14) 0 1px,
      transparent 1px 4px
    );
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

.hero-figure-shell.is-hidden {
  opacity: 0;
  transform: translate3d(1.75rem, -1.5rem, 0) scale(0.94);
  filter: blur(10px);
}

.hero-stage.is-transitioning-out .hero-figure-shell,
.hero-figure-shell.is-transitioning-out {
  opacity: 0.12;
  transform: translate3d(0.8rem, -0.65rem, 0) scale(0.99);
  filter: blur(0);
}

.hero-figure-swap-enter-active {
  transition:
    opacity 640ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 720ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 640ms cubic-bezier(0.16, 1, 0.3, 1);
}

.hero-figure-swap-leave-active {
  transition:
    opacity 260ms cubic-bezier(0.4, 0, 1, 1),
    transform 320ms cubic-bezier(0.4, 0, 1, 1),
    filter 260ms cubic-bezier(0.4, 0, 1, 1);
}

.hero-figure-swap-enter-from {
  opacity: 0;
  transform: translate3d(1.35rem, 0.4rem, 0) scale(0.975);
  filter: blur(18px);
}

.hero-figure-swap-leave-to {
  opacity: 0;
  transform: translate3d(-0.45rem, 0.8rem, 0) scale(1.015);
  filter: blur(14px);
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
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  max-height: calc(100vh - var(--hero-top-safe-clearance) - var(--hero-bottom-safe-clearance));
  filter: var(--hero-figure-shadow);
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
  --hero-figure-shadow:
    drop-shadow(0 18px 26px rgba(108, 83, 60, 0.16))
    drop-shadow(0 0 20px rgba(255, 255, 255, 0.26));
  --hero-figure-shell-shadow: rgba(179, 142, 111, 0.18);
}

.hero-stage.slide-kobe-shot {
  --hero-figure-width: clamp(16.9rem, min(20.7vw, 35.2vh), 23.2rem);
  --hero-poster-width: clamp(18.3rem, min(22.5vw, 38.8vh), 25.8rem);
  --hero-figure-right: clamp(-0.1rem, 1.8vw, 1.55rem);
  --hero-poster-right-offset: clamp(8.1rem, 10.9vw, 12.4rem);
  --hero-poster-bottom-position: calc(100% + clamp(1.55rem, 2.35vh, 2.45rem));
}

.hero-stage.slide-dirk-shot {
  --hero-figure-right: clamp(-0.15rem, 1.65vw, 1.55rem);
  --hero-figure-bottom: clamp(-0.1rem, -0.2vh, 0.2rem);
  --hero-poster-right-offset: clamp(8.2rem, 11.1vw, 12.8rem);
  --hero-poster-bottom-position: calc(100% + clamp(1.35rem, 2.05vh, 2.1rem));
}

.hero-stage.slide-jordan-shot-2 {
  --hero-figure-width: clamp(16.6rem, min(20.2vw, 34.8vh), 22.9rem);
  --hero-poster-width: clamp(18rem, min(22vw, 38.2vh), 25.3rem);
  --hero-figure-right: clamp(0.15rem, 2.2vw, 2rem);
  --hero-figure-bottom: clamp(-0.14rem, -0.25vh, 0.18rem);
  --hero-poster-right-offset: clamp(8.4rem, 11.2vw, 12.8rem);
  --hero-poster-bottom-position: calc(100% + clamp(1.45rem, 2.2vh, 2.3rem));
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

  .hero-stage.slide-jordan-shot-2 {
    --hero-figure-right: clamp(-0.25rem, 1.5vw, 1rem);
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
}
</style>
