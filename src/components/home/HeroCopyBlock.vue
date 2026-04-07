<script setup lang="ts">
import { useResolvedThemeState } from '@/composables/useResolvedThemeState'

const props = withDefaults(
  defineProps<{
    headline?: string
    subtitle?: string
    cta?: string
    motionMode?: 'intro' | 'return' | 'settled'
  }>(),
  {
    headline: '看见你的出手节奏',
    subtitle: '基于姿态识别与关键帧分析，帮助你更清楚地理解投篮动作、出手节奏与发力结构。',
    cta: '开始分析',
    motionMode: 'intro'
  }
)

const emit = defineEmits<{
  (e: 'start'): void
}>()

const { isLightTheme } = useResolvedThemeState()
</script>

<template>
  <div class="hero-copy-block" :class="[`motion-${props.motionMode}`, { 'light-mode': isLightTheme }]">
    <p class="hero-kicker">Basketball Shot Analyzer</p>
    <h1 class="hero-headline">{{ props.headline }}</h1>
    <p class="hero-subtitle delay-copy">{{ props.subtitle }}</p>
    <button type="button" class="hero-cta liquid-glass delay-cta" @click="emit('start')">
      <span class="hero-cta-label">{{ props.cta }}</span>
    </button>
  </div>
</template>

<style scoped>
.hero-copy-block {
  --hero-copy-color: rgba(248, 249, 252, 0.96);
  --hero-kicker-color: rgba(220, 228, 242, 0.64);
  --hero-subtitle-color: rgba(234, 239, 247, 0.74);
  --hero-cta-color: rgba(250, 251, 255, 0.96);
  --hero-cta-border: rgba(255, 255, 255, 0.24);
  --hero-cta-background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
    rgba(255, 255, 255, 0.032);
  --hero-cta-hover-background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
    rgba(255, 255, 255, 0.052);
  --hero-cta-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.2),
    0 18px 34px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(132, 149, 214, 0.08);
  --hero-cta-hover-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.24),
    0 24px 42px rgba(0, 0, 0, 0.34),
    0 0 0 1px rgba(148, 162, 255, 0.1);
  --hero-cta-label-shadow: 0 1px 10px rgba(8, 10, 18, 0.24);
  --hero-cta-highlight:
    linear-gradient(
      112deg,
      rgba(255, 255, 255, 0) 30%,
      rgba(255, 255, 255, 0.04) 42%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.38) 56%,
      rgba(255, 255, 255, 0.1) 64%,
      rgba(255, 255, 255, 0) 74%
    );
  width: min(100%, 36.5rem);
  padding: clamp(5.1rem, 14vh, 8rem) clamp(1.35rem, 3.2vw, 2.8rem) clamp(4rem, 10vh, 6.8rem);
  color: var(--hero-copy-color);
}

.hero-copy-block.motion-intro .hero-kicker,
.hero-copy-block.motion-intro .hero-headline,
.hero-copy-block.motion-intro .hero-subtitle,
.hero-copy-block.motion-intro .hero-cta {
  opacity: 0;
  animation: fade-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.hero-copy-block.motion-return {
  animation: hero-copy-return 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: transform, opacity, filter;
}

.hero-kicker {
  margin: 0 0 0.85rem;
  font-size: 0.74rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--hero-kicker-color);
}

.hero-headline {
  margin: 0;
  font-family: var(--font-display), var(--font-display-cn);
  font-size: clamp(3.2rem, 8.2vw, 5.8rem);
  line-height: 0.92;
  letter-spacing: -0.048em;
  text-wrap: balance;
}

.hero-subtitle {
  margin: 1.2rem 0 0;
  max-width: 27rem;
  font-size: clamp(0.96rem, 1.45vw, 1.06rem);
  line-height: 1.62;
  color: var(--hero-subtitle-color);
}

.hero-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  isolation: isolate;
  contain: paint;
  margin-top: 2.25rem;
  padding: 1.06rem 2.8rem;
  border: 1px solid var(--hero-cta-border);
  border-radius: 999px;
  color: var(--hero-cta-color);
  font-size: 1.03rem;
  font-weight: 650;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 260ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 320ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-cta-label {
  position: relative;
  z-index: 2;
  text-shadow: var(--hero-cta-label-shadow);
}

.hero-cta.liquid-glass {
  background: var(--hero-cta-background);
  box-shadow: var(--hero-cta-shadow);
}

.hero-cta::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--hero-cta-highlight);
  background-size: 220% 100%;
  background-position: 132% 50%;
  background-repeat: no-repeat;
  opacity: 0.16;
  animation: cta-idle-drift 6.4s cubic-bezier(0.37, 0, 0.2, 1) 1s infinite;
  pointer-events: none;
  will-change: background-position, opacity;
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    background-position 540ms cubic-bezier(0.22, 1, 0.36, 1);
  z-index: 0;
}

.hero-cta:hover,
.hero-cta:focus-visible {
  border-color: color-mix(in srgb, var(--hero-cta-border) 120%, transparent);
  background: var(--hero-cta-hover-background);
  box-shadow: var(--hero-cta-hover-shadow);
  transform: translateY(-2px);
}

.hero-cta:hover::after,
.hero-cta:focus-visible::after {
  opacity: 0.42;
  animation: cta-hover-sweep 860ms cubic-bezier(0.22, 1, 0.36, 1) 1 both;
}

.hero-cta:focus-visible {
  outline: none;
}

.hero-cta:active {
  transform: translateY(0) scale(0.985);
}

.liquid-glass {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.12),
    0 18px 32px rgba(0, 0, 0, 0.24);
}

.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.52),
    rgba(255, 255, 255, 0.06) 28%,
    rgba(255, 255, 255, 0) 52%,
    rgba(255, 255, 255, 0.08) 72%,
    rgba(255, 255, 255, 0.48)
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

.delay-copy {
  animation-delay: 0.2s;
}

.delay-cta {
  animation-delay: 0.4s;
}

.hero-copy-block.light-mode {
  --hero-copy-color: rgba(26, 29, 35, 0.96);
  --hero-kicker-color: rgba(92, 99, 112, 0.72);
  --hero-subtitle-color: rgba(77, 84, 97, 0.8);
  --hero-cta-color: rgba(23, 26, 33, 0.96);
  --hero-cta-border: rgba(64, 70, 82, 0.16);
  --hero-cta-background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.48)),
    rgba(255, 255, 255, 0.58);
  --hero-cta-hover-background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.56)),
    rgba(255, 255, 255, 0.68);
  --hero-cta-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 20px 38px rgba(126, 114, 166, 0.14),
    0 0 0 1px rgba(255, 255, 255, 0.4);
  --hero-cta-hover-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 24px 44px rgba(126, 114, 166, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.48);
  --hero-cta-label-shadow: 0 1px 0 rgba(255, 255, 255, 0.42);
  --hero-cta-highlight:
    linear-gradient(
      112deg,
      rgba(255, 255, 255, 0) 28%,
      rgba(255, 255, 255, 0.08) 40%,
      rgba(255, 255, 255, 0.24) 48%,
      rgba(255, 255, 255, 0.54) 54%,
      rgba(255, 255, 255, 0.18) 62%,
      rgba(255, 255, 255, 0) 74%
    );
}

@keyframes fade-rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes hero-copy-return {
  from {
    opacity: 0.74;
    transform: translateY(10px);
    filter: blur(2px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes cta-idle-drift {
  0%,
  100% {
    opacity: 0.16;
    background-position: 132% 50%;
  }

  44% {
    opacity: 0.22;
    background-position: 92% 50%;
  }

  66% {
    opacity: 0.3;
    background-position: 68% 50%;
  }

  82% {
    opacity: 0.2;
    background-position: 56% 50%;
  }
}

@keyframes cta-hover-sweep {
  0% {
    opacity: 0.16;
    background-position: 128% 50%;
  }

  26% {
    opacity: 0.3;
  }

  54% {
    opacity: 0.42;
  }

  100% {
    opacity: 0;
    background-position: -28% 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-copy-block.motion-intro .hero-kicker,
  .hero-copy-block.motion-intro .hero-headline,
  .hero-copy-block.motion-intro .hero-subtitle,
  .hero-copy-block.motion-intro .hero-cta,
  .hero-copy-block.motion-return {
    animation: none;
    opacity: 1;
    transform: none;
    filter: none;
  }

  .hero-cta,
  .hero-cta::after {
    transition-duration: 0.01ms !important;
  }

  .hero-cta::after {
    animation: none;
    opacity: 0.18;
    background-position: 88% 50%;
  }

  .hero-cta:hover::after,
  .hero-cta:focus-visible::after {
    animation: none;
    opacity: 0.24;
    background-position: 42% 50%;
  }
}

@media (max-width: 640px) {
  .hero-copy-block {
    padding-top: 5.5rem;
  }

  .hero-headline {
    max-width: 16rem;
  }
}
</style>
