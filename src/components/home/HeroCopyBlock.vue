<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    headline?: string
    subtitle?: string
    cta?: string
  }>(),
  {
    headline: '看见你的出手节奏',
    subtitle: '基于姿态识别与关键帧分析，帮助你更清楚地理解投篮动作、出手节奏与发力结构。',
    cta: '开始分析'
  }
)

const emit = defineEmits<{
  (e: 'start'): void
}>()
</script>

<template>
  <div class="hero-copy-block">
    <p class="hero-kicker fade-rise">Basketball Shot Analyzer</p>
    <h1 class="hero-headline fade-rise">{{ props.headline }}</h1>
    <p class="hero-subtitle fade-rise delay-copy">{{ props.subtitle }}</p>
    <button type="button" class="hero-cta liquid-glass fade-rise delay-cta" @click="emit('start')">
      {{ props.cta }}
    </button>
  </div>
</template>

<style scoped>
.hero-copy-block {
  width: min(100%, 40rem);
  padding: clamp(6rem, 16vh, 10rem) clamp(1.5rem, 4vw, 4rem) clamp(5rem, 12vh, 8rem);
  color: rgba(248, 249, 252, 0.96);
}

.hero-kicker,
.hero-headline,
.hero-subtitle,
.hero-cta {
  opacity: 0;
  animation: fade-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.hero-kicker {
  margin: 0 0 1rem;
  font-size: 0.78rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(220, 228, 242, 0.72);
}

.hero-headline {
  margin: 0;
  font-family: var(--font-display), var(--font-display-cn);
  font-size: clamp(3.6rem, 9vw, 6.4rem);
  line-height: 0.96;
  letter-spacing: -0.05em;
  text-wrap: balance;
}

.hero-subtitle {
  margin: 1.6rem 0 0;
  max-width: 34rem;
  font-size: clamp(1rem, 1.8vw, 1.18rem);
  line-height: 1.8;
  color: rgba(234, 239, 247, 0.82);
}

.hero-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 2rem;
  padding: 0.95rem 2.2rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  color: rgba(250, 251, 255, 0.96);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.liquid-glass {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.04);
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
}

.delay-copy {
  animation-delay: 0.2s;
}

.delay-cta {
  animation-delay: 0.4s;
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

@media (max-width: 640px) {
  .hero-copy-block {
    padding-top: 5.5rem;
  }

  .hero-headline {
    max-width: 16rem;
  }
}
</style>
