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
  position: relative;
  width: min(100%, 420px);
  min-height: 320px;
}

.workspace-hero-shadow,
.workspace-hero-figure {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  height: auto;
  object-fit: contain;
  pointer-events: none;
}

.workspace-hero-shadow {
  opacity: 0.16;
  transform: scale(1.1);
}

.workspace-hero-figure {
  z-index: 1;
}
</style>
