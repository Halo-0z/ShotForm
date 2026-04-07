<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import UploadWorkbenchPage from '@/components/upload/UploadWorkbenchPage.vue'
import { useFogRouteTransition } from '@/composables/useFogRouteTransition'
import { PAGE_COVER_ART } from '@/lib/page-cover-art'

const { phase, prefersReducedMotion } = useFogRouteTransition()

const shouldReveal = ref(false)
const isDirectAccess = ref(false)

onMounted(() => {
  if (prefersReducedMotion.value) {
    shouldReveal.value = true
    return
  }

  if (phase.value === 'idle') {
    isDirectAccess.value = true
    shouldReveal.value = true
  }
})

watch(phase, (newPhase) => {
  if (newPhase === 'idle' && !shouldReveal.value && !prefersReducedMotion.value) {
    shouldReveal.value = true
  }
})
</script>

<template>
  <div
    class="upload-page"
    :class="{
      'upload-page--reveal': shouldReveal,
      'upload-page--direct-access': isDirectAccess,
      'upload-page--reduced-motion': prefersReducedMotion
    }"
  >
    <div class="upload-page__cover" :style="{ backgroundImage: `url(${PAGE_COVER_ART.upload})` }" aria-hidden="true" />
    <div class="upload-page__veil" aria-hidden="true" />
    <div class="upload-page__content">
      <UploadWorkbenchPage />
    </div>
  </div>
</template>

<style scoped>
.upload-page {
  position: relative;
  min-height: 100%;
  padding: clamp(3.75rem, 6vh, 4.5rem) 28px 28px;
  overflow: hidden;
  background:
    radial-gradient(circle at 16% 10%, color-mix(in srgb, var(--accent-color) 4%, transparent), transparent 22%),
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--primary-color) 3%, transparent), transparent 20%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-solid) 96%, var(--surface-color)), var(--bg-solid));
}

.upload-page--direct-access {
  transition: none;
}

.upload-page--reduced-motion {
  transition: none;
}

.upload-page__cover,
.upload-page__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.upload-page__cover {
  background-position: right -1.5rem top 1.25rem;
  background-repeat: no-repeat;
  background-size: min(34vw, 31rem) auto;
  opacity: 0.08;
  transform: translate3d(0, 0, 0) scale(1.01);
  transition:
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.upload-page__veil {
  background:
    radial-gradient(circle at 70% 26%, color-mix(in srgb, var(--accent-color) 8%, transparent), transparent 22%),
    radial-gradient(circle at 32% 18%, color-mix(in srgb, var(--primary-color) 5%, transparent), transparent 26%),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-solid) 70%, transparent),
      color-mix(in srgb, var(--bg-solid) 92%, var(--background))
    );
  opacity: 0.38;
  transition: opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.upload-page__content {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  opacity: 0;
  transform: translate3d(0, 6px, 0);
  transition:
    opacity 240ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.upload-page--reveal .upload-page__cover {
  opacity: 0.1;
  transform: translate3d(0, 0, 0) scale(1.01);
}

.upload-page--reveal .upload-page__veil {
  opacity: 0.42;
}

.upload-page--reveal .upload-page__content {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.upload-page:not(.upload-page--reveal) .upload-page__cover {
  opacity: 0.07;
  transform: translate3d(0, 0, 0) scale(1.02);
}

.upload-page:not(.upload-page--reveal) .upload-page__veil {
  opacity: 0.34;
}

.upload-page--direct-access .upload-page__cover,
.upload-page--reduced-motion .upload-page__cover {
  opacity: 0.09;
  transform: translate3d(0, 0, 0) scale(1.01);
  transition: none;
}

.upload-page--direct-access .upload-page__veil,
.upload-page--reduced-motion .upload-page__veil {
  opacity: 0.44;
  transition: none;
}

.upload-page--direct-access .upload-page__content,
.upload-page--reduced-motion .upload-page__content {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  transition: none;
}

@media (max-width: 960px) {
  .upload-page {
    padding: 72px 20px 24px;
  }

  .upload-page__cover {
    background-position: right -2.5rem top 1rem;
    background-size: min(48vw, 19rem) auto;
  }
}
</style>
