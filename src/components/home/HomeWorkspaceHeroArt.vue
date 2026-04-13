<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    compact?: boolean
    focused?: boolean
  }>(),
  {
    compact: false,
    focused: false
  }
)

const figureSrc = '/hero/jordan-logo-original.png'
const shadowSrc = '/hero/jordan-logo-shadow.png'
</script>

<template>
  <div class="workspace-hero-art" :class="{ compact: props.compact, focused: props.focused }" aria-hidden="true">
    <img :src="shadowSrc" alt="" class="workspace-hero-shadow" />
    <img :src="figureSrc" alt="" class="workspace-hero-figure" />
  </div>
</template>

<style scoped>
.workspace-hero-art {
  --hero-figure-width: 94%;
  --hero-figure-shift-x: -0.35rem;
  --hero-figure-shift-y: 0.55rem;
  --hero-shadow-width: 102%;
  --hero-shadow-shift-x: -2.2rem;
  --hero-shadow-shift-y: 1.6rem;
  position: relative;
  width: min(100%, 420px);
  min-height: 320px;
}

.workspace-hero-shadow,
.workspace-hero-figure {
  position: absolute;
  right: 0;
  bottom: 0;
  height: auto;
  object-fit: contain;
  pointer-events: none;
}

.workspace-hero-shadow {
  width: var(--hero-shadow-width);
  opacity: 0.14;
  transform-origin: 88% 100%;
  transform: translate3d(var(--hero-shadow-shift-x), var(--hero-shadow-shift-y), 0) scale(1.1);
  filter: blur(2px) drop-shadow(0 24px 40px rgba(0, 0, 0, 0.42));
}

.workspace-hero-figure {
  width: var(--hero-figure-width);
  z-index: 1;
  transform-origin: 88% 100%;
  transform: translate3d(var(--hero-figure-shift-x), var(--hero-figure-shift-y), 0);
}

.workspace-hero-art.compact {
  --hero-figure-width: 92%;
  --hero-figure-shift-x: -0.45rem;
  --hero-figure-shift-y: 0.7rem;
  --hero-shadow-width: 100%;
  --hero-shadow-shift-x: -2rem;
  --hero-shadow-shift-y: 1.5rem;
  width: min(100%, 360px);
  min-height: 270px;
}

.workspace-hero-art.compact .workspace-hero-shadow,
.workspace-hero-art.focused .workspace-hero-shadow {
  opacity: 0.1;
}

.workspace-hero-art.focused {
  --hero-figure-width: 90%;
  --hero-figure-shift-x: -0.55rem;
  --hero-figure-shift-y: 0.75rem;
  --hero-shadow-width: 98%;
  --hero-shadow-shift-x: -1.9rem;
  --hero-shadow-shift-y: 1.45rem;
  width: min(100%, 340px);
  min-height: 248px;
}

@media (max-width: 1100px) {
  .workspace-hero-art {
    --hero-figure-width: 92%;
    --hero-figure-shift-x: -0.45rem;
    --hero-figure-shift-y: 0.65rem;
    --hero-shadow-width: 100%;
    --hero-shadow-shift-x: -1.8rem;
    --hero-shadow-shift-y: 1.3rem;
    width: min(100%, 360px);
    min-height: 280px;
  }
}

@media (max-width: 720px) {
  .workspace-hero-art,
  .workspace-hero-art.compact,
  .workspace-hero-art.focused {
    --hero-figure-width: 90%;
    --hero-figure-shift-x: -0.35rem;
    --hero-figure-shift-y: 0.5rem;
    --hero-shadow-width: 98%;
    --hero-shadow-shift-x: -1.45rem;
    --hero-shadow-shift-y: 1rem;
    width: min(100%, 240px);
    min-height: 210px;
  }
}
</style>
