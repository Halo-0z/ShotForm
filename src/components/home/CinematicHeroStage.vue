<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useResolvedThemeState } from '@/composables/useResolvedThemeState'

interface HeroFigure {
  src: string
  flip: boolean
  shadow: string
  glow: string
  shellShadow: string
}

const HERO_FIGURES: readonly HeroFigure[] = [
  { src: '/hero/luka2.png', flip: false, shadow: 'drop-shadow(0 24px 36px rgba(0,0,0,0.42)) drop-shadow(0 0 18px rgba(167,189,255,0.08))', glow: 'radial-gradient(circle at 72% 32%, rgba(108,132,196,0.12), transparent 24%)', shellShadow: 'rgba(0,0,0,0.38)' },
  { src: '/hero/kobe-shot.png', flip: false, shadow: 'drop-shadow(0 24px 36px rgba(0,0,0,0.42)) drop-shadow(0 0 18px rgba(119,33,64,0.10))', glow: 'radial-gradient(circle at 72% 32%, rgba(180,80,90,0.10), transparent 24%)', shellShadow: 'rgba(60,20,30,0.35)' },
  { src: '/hero/jordan-shot-2.png', flip: false, shadow: 'drop-shadow(0 24px 36px rgba(0,0,0,0.42)) drop-shadow(0 0 18px rgba(220,50,20,0.10))', glow: 'radial-gradient(circle at 72% 32%, rgba(220,120,40,0.11), transparent 24%)', shellShadow: 'rgba(80,30,10,0.36)' },
  { src: '/hero/durant-shot.png', flip: true, shadow: 'drop-shadow(0 24px 36px rgba(0,0,0,0.42)) drop-shadow(0 0 18px rgba(30,80,180,0.09))', glow: 'radial-gradient(circle at 72% 32%, rgba(40,100,200,0.10), transparent 24%)', shellShadow: 'rgba(15,40,100,0.34)' },
  { src: '/hero/dirk-shot.png', flip: false, shadow: 'drop-shadow(0 24px 36px rgba(0,0,0,0.42)) drop-shadow(0 0 18px rgba(30,140,100,0.08))', glow: 'radial-gradient(circle at 72% 32%, rgba(40,160,120,0.09), transparent 24%)', shellShadow: 'rgba(15,70,50,0.33)' }
]

const CAROUSEL_INTERVAL_MS = 6000

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

const currentIndex = ref(0)
const isPaused = ref(false)
let carouselTimer: ReturnType<typeof setInterval> | null = null

const effectiveFigures = computed<HeroFigure[]>(() => {
  if (props.figureSrc) return [{ src: props.figureSrc, flip: false, shadow: HERO_FIGURES[0].shadow, glow: HERO_FIGURES[0].glow, shellShadow: HERO_FIGURES[0].shellShadow }]
  return [...HERO_FIGURES]
})

const currentFigure = computed(() => {
  const figures = effectiveFigures.value
  if (!figures.length) return HERO_FIGURES[0]
  if (props.reduceMotion) return figures[0]
  return figures[currentIndex.value % figures.length] || figures[0]
})

const currentFigureSrc = computed(() => currentFigure.value.src)

const prevFigure = computed(() => {
  const figures = effectiveFigures.value
  if (figures.length <= 1) return currentFigure.value
  return figures[(currentIndex.value - 1 + figures.length) % figures.length]
})

const currentThemeVars = computed(() => {
  const f = currentFigure.value
  return { '--hero-figure-shadow': f.shadow, '--hero-figure-glow': f.glow, '--hero-figure-shell-shadow': f.shellShadow } as Record<string, string>
})

const shouldFlip = computed(() => currentFigure.value.flip)

const hasVideo = computed(() => Boolean(props.videoSrc) && !videoFailed.value && !props.reduceMotion && !props.transitioningOut)

const posterStyle = computed(() => ({ '--hero-poster-image': props.posterSrc ? `url("${props.posterSrc}")` : 'none' }))

const resetVideoState = () => { videoFailed.value = false; videoReady.value = false }
const handleVideoError = () => { videoFailed.value = true; videoReady.value = false }
const handleVideoCanPlay = () => { videoReady.value = true }

const advanceCarousel = () => {
  if (isPaused.value || props.reduceMotion || props.transitioningOut) return
  const figures = effectiveFigures.value
  if (figures.length <= 1) return
  currentIndex.value = (currentIndex.value + 1) % figures.length
}

const startCarousel = () => {
  stopCarousel()
  if (effectiveFigures.value.length <= 1 || props.reduceMotion) return
  carouselTimer = setInterval(advanceCarousel, CAROUSEL_INTERVAL_MS)
}

const stopCarousel = () => { if (carouselTimer !== null) { clearInterval(carouselTimer); carouselTimer = null } }
const handleMouseEnter = () => { isPaused.value = true }
const handleMouseLeave = () => { isPaused.value = false }

const preloadImages = () => { HERO_FIGURES.forEach(f => { const img = new Image(); img.src = f.src }) }

watch(() => props.videoSrc, resetVideoState)
watch(() => props.reduceMotion, rm => { if (rm) { videoReady.value = false; currentIndex.value = 0; stopCarousel() } else startCarousel() })
watch(() => props.transitioningOut, to => { if (to) { videoReady.value = false; stopCarousel() } })

onMounted(() => { preloadImages(); if (!props.reduceMotion) startCarousel() })
onBeforeUnmount(() => stopCarousel())
</script>

<template>
  <section class="hero-stage" :class="{ 'is-transitioning-out': props.transitioningOut, 'light-mode': isLightTheme }"
    :style="currentThemeVars" @mouseenter="handleMouseEnter" @mouseleave="handleMouseLeave">
    <div class="hero-video-poster" aria-hidden="true" :style="posterStyle"></div>
    <div class="hero-poster-figure" :class="{ 'is-transitioning-out': props.transitioningOut }" :style="posterStyle"
      aria-hidden="true"></div>
    <video v-if="hasVideo" class="hero-video" :class="{ 'is-ready': videoReady }" :src="videoSrc" :poster="posterSrc"
      autoplay muted loop playsinline @canplay="handleVideoCanPlay" @error="handleVideoError"></video>
    <div class="hero-atmosphere-fallback" aria-hidden="true"></div>
    <div class="hero-grain" aria-hidden="true"></div>
    <div class="hero-vignette" aria-hidden="true"></div>
    <div class="hero-content-layer">
      <slot />
    </div>
    <div class="hero-figure-shell" :class="{ 'is-transitioning-out': props.transitioningOut }" aria-hidden="true">
      <img :key="'a-' + currentFigureSrc" :src="currentFigureSrc" alt=""
        :class="['hero-figure', 'hero-figure-active', { 'hero-figure-flip': shouldFlip }]" />
      <template v-if="effectiveFigures.length > 1 && !props.reduceMotion">
        <img :key="'p-' + prevFigure.src" :src="prevFigure.src" alt=""
          :class="['hero-figure', 'hero-figure-prev', { 'hero-figure-flip': prevFigure.flip }]" />
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
    var(--hero-figure-glow, radial-gradient(circle at 72% 32%, rgba(108, 132, 196, 0.12), transparent 24%)),
    radial-gradient(circle at 52% 84%, rgba(255, 214, 171, 0.08), transparent 26%);
  --hero-atmosphere-blur: 14px;
  --hero-atmosphere-opacity: 0.78;
  --hero-grain-opacity: 0.022;
  --hero-grain-blend: soft-light;
  --hero-vignette-background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.22), transparent 25%),
    linear-gradient(0deg, rgba(0, 0, 0, 0.54), transparent 40%);
  --hero-figure-shadow:
    drop-shadow(0 24px 36px rgba(0, 0, 0, 0.42)) drop-shadow(0 0 18px rgba(167, 189, 255, 0.08));
  --hero-figure-shell-shadow: rgba(0, 0, 0, 0.38);
  position: relative;
  min-height: 100vh;
  overflow: clip;
  background: var(--hero-stage-background);
  transition:
    --hero-figure-shadow 1200ms cubic-bezier(0.22, 1, 0.36, 1),
    --hero-figure-glow 1200ms cubic-bezier(0.22, 1, 0.36, 1),
    --hero-figure-shell-shadow 1200ms cubic-bezier(0.22, 1, 0.36, 1);
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
  transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-stage.is-transitioning-out .hero-atmosphere-fallback {
  filter: blur(8px);
  opacity: 0.56;
}

.hero-grain {
  opacity: var(--hero-grain-opacity);
  mix-blend-mode: var(--hero-grain-blend);
  background-image:
    repeating-linear-gradient(0deg,
      rgba(0, 0, 0, 0.11) 0 1px,
      transparent 1px 3px),
    repeating-linear-gradient(90deg,
      rgba(255, 255, 255, 0.14) 0 1px,
      transparent 1px 4px);
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
  transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-stage.is-transitioning-out .hero-figure-shell::before {
  filter: blur(8px);
  opacity: 0.42;
}

.hero-figure {
  position: absolute;
  bottom: 0;
  left: 0;
  display: block;
  width: 100%;
  height: auto;
  max-height: calc(100vh - var(--hero-top-safe-clearance) - var(--hero-bottom-safe-clearance));
  filter: var(--hero-figure-shadow);
}

.hero-figure-flip {
  transform: scaleX(-1);
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
  --hero-figure-shadow:
    drop-shadow(0 18px 26px rgba(108, 83, 60, 0.16)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.26));
  --hero-figure-shell-shadow: rgba(179, 142, 111, 0.18);
}

@keyframes hero-float-in {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }

  60% {
    opacity: 0.85;
    transform: translateY(-4px) scale(1.01);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes hero-float-out {
  0% {
    opacity: 0.7;
    transform: translateY(0) scale(1);
  }

  100% {
    opacity: 0;
    transform: translateY(-16px) scale(1.03);
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
    transform: translateY(0) scale(1);
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
1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
} 1200ms cubic-bezier(0.22,
}

.hero-atmosphere-fallback {
position: absolute;
inset: 0;
background: var(--hero-atmosphere-background);
filter: blur(var(--hero-atmosphere-blur));
opacity: var(--hero-atmosphere-opacity);
}

ero-stage.is-transitioning-out .hero-atmosphere-fallback {
filter: blur(8px);
opacity: 0.56;


ero-grain {
p acity: var(--hero-grain-opacity);
x-blend-mode: var(--hero-grain-blend);
ckground-ims c: repeating-linear-gr dient(transparent 1px 3px),
repeating-linear-gradient(transform: translate3d(0.8rem, -0.65rem, 0)sscale(0.99);
olfilter:tblu; (0);
}

.he o- {
igu-shell::befo content: '';

position .hheo-hignette {
position: absolute;
inset: 0;
badter: bl: v2r(x-hero-vignette-background);
transition: background 1200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-state.is-trars {
tioin position: relative;
z-aniex: 0; 42
}

.hero-figure-shell {
position: absolute;
botto: va;
bottom: var(--hero-figure-bottom);
diipdey: block width: v0a%--hero-figure-width);
hinghtd outo;
maxxheight: cwlc(100vhr-(var(--h ro-isafsaee-ccei(0nc2 0.36, 1);
filfer: vrr(--hero-figurefshad.w);
}

.heho-figure-flip {
12;
transform: scaleX(-1);
}

.heoo-figureiave {
oiacsty: 12%;
igtma: 18% hero-float-ind14 0forwards;
}

.hero-figure-prev
}

{
{
oopacity:p0;
gnpointer-events:.none;
teimati n: hebo-float-out218m0s0cubi2-bezi r1, ft-wurds
}

;

@keyframes heoo-fltat-in 0% {
fdopacity:b0;
0.kgtronsfo m(2t5ansl teY2s0px)e(
}

60% {
opacity: 0.85;
o-e.22sform1 translateY(-4px)01
}
}

100% {
ocpy:i transform: translateY(0) scale(1);
l
}
}

@keyframesehero-flotto)ut {
0% {
opacity: 0.7;
width: 100:a translateY(0)
}

100%l {
te;
mopacity: 0;
transform: lranslateY(-16px) cadd(1.03);
i
}

g: 6px 10px;
border-radius: 999px;
background: rgba(0, 0, 0, 0.18);
backdrop-filter: blur(8px) saturate(140%);
-webkit-backdrop-filter: blur(8px) saturate(140%);
}

.hero-dot {
appearance: none;
-webkit-appearance: none;
display: block;
width: var(--hero-dot-size);
e ight: var(--hero-dot-size);
pa dding: 0;
bo rder: none;
rder-radiusient%;
background: var(--hero-dot-color);
cursor: pointer;
transition: background 320ms cubic-bezier(0.22, 1, 0.36, 1),
transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
po inter-events: auto;

radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), , transparent 18%);
tr--heao-ntmosphere-blur: 34px;
--hero-atmosphere-opacity: 1;
--hero-grain-opacity: 0.04;
--hero-grain-blens: multpply;
--hero-vignette-background: radiarent 28%), ), 844 linear-gradient(180deg, rgba(255, 255, 255, 0.18 .h2,
linear-gradient(0deg, rgba(237, 1228, 1216, 10.2), , transparent 36%);
0.18ro-figure-shadow: d)1pgshbdow(0 18px 26px rgba(108, 83, 60, 0.16)) dr1p-7hadow(0 0 209x rgba(255, 255, 255, 0.26));
--, l-o-figurshshedow:
}

@media (max-width: 900px) {
eg.hero-stageg {
-5ux); ; emo-t; p-safeicleargnce: 3.25ret;
--her:0bot.om-safe6clerranee: 0.3rem;
--hero-figure-width: clamp(16.4rem, 40vw, 18.8rem);
--hero-fi --hero-figure-bottom: 1. --hero-poster-width: clamp(17.6rem, 44vw, 20.2rem
----hero-poster-right-offset:mclamp(7rem, -10vw, -9.5rem);
poster-image: radial-gradient(circle at 18% 70%, rgba(109, 146, 216, 0.13), transparent 21%),
radial-gradient(circle at 30% 78%, rgba(247, 157, 120, 0.14), transparent 24%),
radial-gradient(circle at 90% 86%, rgba(255, 224, 144, 0.14), transparent 16%),
linear-grad8i;
}

.hero-figure-active {
animation-duration: 1000ms;
}

.hero-figure-prev {
animation-duration: 800ms;
}
}

--hero-atmosphere-background: radial-gradient(circle at 18% 68%, rgba(110, 147, 217, 0.14), transparent 20%),
radial-gradient(circle at 28% 80%, rgba(247, 161, 127, 0.14), transparent 24%),
radial-gradient(circle at 88% 88%, rgba(250, 204, 21, 0.14), transparent 14%),
radial-gradient(circle at 82% 16%, rgba(255, 255, 255, 0.74), transparent 18%);
hero-atmosphere-blur: 34px;
hero-atmosp-t-backgrr5rem);
--hero-poster-bottom-position: calc(100% + 0.95rem);


.hero-figure-shell {
opacity: 0.88;
}

sdolsfigirec animation-durasi0n
}

.hero-figure-prev {
prd- nimation-5uratxoap.600msm;
--hero-bottom-safe-clearance: 0.2rem;
--hero-figure-width: clamp(13.7rem, 49vw, 15.2rem);
--hero-figure-right: -1.5rem;
--hero-figure-bottom: 0.8rem;

--hero-poster-wie {
animation: nonr; er-bottom-position: calc(100% + 0.8rem);
}

opacity: 1;
scatransform:ltranslateY(0)e(1);
}


paiming: 5 n 8ex;
opacity: 0;
}
}

edia (sragers-reduced-motion: reduce) {
ero-fition: nree;
}

.hero-atmosphere-fallback {
,
transition: none;


on.hero-figure-shell::before- {
uration: 0.01ms !important;
ion:tranoin
}