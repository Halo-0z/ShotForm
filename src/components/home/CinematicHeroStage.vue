<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    videoSrc?: string
    posterSrc?: string
    figureSrc?: string
    reduceMotion?: boolean
  }>(),
  {
    videoSrc: '/hero/home-hero-loop.mp4',
    posterSrc: '/hero/luka2.png',
    figureSrc: '/hero/luka2.png',
    reduceMotion: false
  }
)

const videoFailed = ref(false)
const videoReady = ref(false)

const hasVideo = computed(() => Boolean(props.videoSrc) && !videoFailed.value && !props.reduceMotion)

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
</script>

<template>
  <section class="hero-stage">
    <div class="hero-video-poster" aria-hidden="true" :style="posterStyle"></div>
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
    <div class="hero-vignette" aria-hidden="true"></div>

    <div class="hero-content-layer">
      <slot />
    </div>

    <div class="hero-figure-shell" aria-hidden="true">
      <img :src="figureSrc" alt="" class="hero-figure" />
    </div>
  </section>
</template>

<style scoped>
.hero-stage {
  position: relative;
  min-height: 100vh;
  overflow: clip;
  background:
    radial-gradient(circle at top, rgba(73, 94, 145, 0.24), transparent 42%),
    linear-gradient(180deg, rgba(6, 8, 15, 0.88), rgba(4, 5, 10, 0.98));
}

.hero-video,
.hero-video-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-video {
  opacity: 0;
  object-fit: cover; /* object-cover */
  transition: opacity 720ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-video.is-ready {
  opacity: 0.34;
}

.hero-video-poster {
  background-image:
    radial-gradient(circle at 70% 18%, rgba(129, 151, 215, 0.22), transparent 18%),
    radial-gradient(circle at 28% 80%, rgba(86, 110, 172, 0.24), transparent 24%),
    linear-gradient(180deg, rgba(9, 13, 25, 0.74), rgba(4, 6, 12, 0.96)),
    var(--hero-poster-image);
  background-position:
    center,
    center,
    center,
    74% bottom;
  background-repeat: no-repeat;
  background-size:
    auto,
    auto,
    auto,
    min(34vw, 24rem) auto;
  opacity: 0.94;
}

.hero-atmosphere-fallback {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 22% 24%, rgba(255, 255, 255, 0.08), transparent 18%),
    radial-gradient(circle at 75% 30%, rgba(109, 132, 198, 0.16), transparent 22%),
    radial-gradient(circle at 52% 84%, rgba(255, 214, 171, 0.14), transparent 24%);
  filter: blur(18px);
  opacity: 0.92;
}

.hero-vignette {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.3), transparent 26%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.6), transparent 38%);
}

.hero-content-layer {
  position: relative;
  z-index: 2;
}

.hero-figure-shell {
  position: absolute;
  right: clamp(2rem, 7vw, 7rem);
  bottom: -1.5rem;
  z-index: 1;
  width: min(34vw, 24rem);
  min-width: 15rem;
  pointer-events: none;
}

.hero-figure-shell::before {
  content: '';
  position: absolute;
  inset: auto 12% 2% 12%;
  height: 18%;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.38);
  filter: blur(26px);
}

.hero-figure {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  filter:
    drop-shadow(0 28px 42px rgba(0, 0, 0, 0.46))
    drop-shadow(0 0 26px rgba(167, 189, 255, 0.12));
}

@media (max-width: 900px) {
  .hero-video-poster {
    background-position:
      center,
      center,
      center,
      calc(100% + 0.5rem) bottom;
    background-size:
      auto,
      auto,
      auto,
      min(48vw, 20rem) auto;
  }

  .hero-figure-shell {
    right: -1.25rem;
    width: min(48vw, 20rem);
    opacity: 0.88;
  }
}

@media (max-width: 640px) {
  .hero-video-poster {
    background-position:
      center,
      center,
      center,
      calc(100% + 1.5rem) bottom;
    background-size:
      auto,
      auto,
      auto,
      min(58vw, 17rem) auto;
  }

  .hero-figure-shell {
    width: min(58vw, 17rem);
    right: -2rem;
    bottom: -0.5rem;
  }
}
</style>
