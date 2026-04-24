<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

export type HomeModuleGemKind = 'upload' | 'analysis' | 'compare' | 'suggestion'

type GemPalette = {
  glow: string
  accent: string
  accentStrong: string
  accentSoft: string
  faceTop: string
  faceLeft: string
  faceRight: string
  floatTop: string
  floatBottom: string
  detail: string
  surfaceStroke: string
  surfaceFill: string
  surfaceFillSoft: string
  lineStrong: string
  lineSoft: string
  lineDim: string
  supportStroke: string
}

const props = withDefaults(
  defineProps<{
    kind: HomeModuleGemKind
    title: string
    active?: boolean
    disabled?: boolean
  }>(),
  {
    active: false,
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'select'): void
}>()

const idBase = computed(() => `home-gem-${props.kind}`)

const isDark = ref(false)
let observer: MutationObserver | null = null

const lightPalettes: Record<HomeModuleGemKind, GemPalette> = {
  upload: {
    glow: 'rgba(115, 132, 255, 0.28)',
    accent: '#6f7dff',
    accentStrong: '#5267ff',
    accentSoft: '#81dcff',
    faceTop: '#f8fbff',
    faceLeft: '#dbe7ff',
    faceRight: '#a9c3ff',
    floatTop: '#ffffff',
    floatBottom: '#dbe7ff',
    detail: '#b4c6ff',
    surfaceStroke: 'rgba(255, 255, 255, 0.92)',
    surfaceFill: 'rgba(255, 255, 255, 0.92)',
    surfaceFillSoft: 'rgba(255, 255, 255, 0.74)',
    lineStrong: 'rgba(255, 255, 255, 0.88)',
    lineSoft: 'rgba(255, 255, 255, 0.78)',
    lineDim: 'rgba(255, 255, 255, 0.45)',
    supportStroke: 'rgba(120, 146, 206, 0.45)'
  },
  analysis: {
    glow: 'rgba(88, 184, 255, 0.26)',
    accent: '#4a97ff',
    accentStrong: '#3378ef',
    accentSoft: '#7ff0ff',
    faceTop: '#f8ffff',
    faceLeft: '#dcf7ff',
    faceRight: '#a6deff',
    floatTop: '#ffffff',
    floatBottom: '#d9f5ff',
    detail: '#95d8ff',
    surfaceStroke: 'rgba(255, 255, 255, 0.92)',
    surfaceFill: 'rgba(255, 255, 255, 0.92)',
    surfaceFillSoft: 'rgba(255, 255, 255, 0.72)',
    lineStrong: 'rgba(255, 255, 255, 0.88)',
    lineSoft: 'rgba(255, 255, 255, 0.78)',
    lineDim: 'rgba(255, 255, 255, 0.45)',
    supportStroke: 'rgba(120, 146, 206, 0.45)'
  },
  compare: {
    glow: 'rgba(201, 130, 61, 0.24)',
    accent: '#C9823D',
    accentStrong: '#A76730',
    accentSoft: '#E8A862',
    faceTop: '#fffbf5',
    faceLeft: '#f5e8d5',
    faceRight: '#e0c9a8',
    floatTop: '#ffffff',
    floatBottom: '#f5eadb',
    detail: '#d4a574',
    surfaceStroke: 'rgba(255, 255, 255, 0.92)',
    surfaceFill: 'rgba(255, 255, 255, 0.92)',
    surfaceFillSoft: 'rgba(255, 255, 255, 0.72)',
    lineStrong: 'rgba(255, 255, 255, 0.82)',
    lineSoft: 'rgba(255, 255, 255, 0.56)',
    lineDim: 'rgba(255, 255, 255, 0.45)',
    supportStroke: 'rgba(120, 146, 206, 0.45)'
  },
  suggestion: {
    glow: 'rgba(255, 165, 96, 0.25)',
    accent: '#ff9d58',
    accentStrong: '#ff7b3d',
    accentSoft: '#ffd86b',
    faceTop: '#fffdf6',
    faceLeft: '#fff0d8',
    faceRight: '#ffd3ad',
    floatTop: '#fffef8',
    floatBottom: '#fff0d8',
    detail: '#ffd6a8',
    surfaceStroke: 'rgba(255, 255, 255, 0.92)',
    surfaceFill: 'rgba(255, 255, 255, 0.94)',
    surfaceFillSoft: 'rgba(255, 255, 255, 0.85)',
    lineStrong: 'rgba(255, 255, 255, 0.94)',
    lineSoft: 'rgba(255, 255, 255, 0.88)',
    lineDim: 'rgba(255, 255, 255, 0.45)',
    supportStroke: 'rgba(120, 146, 206, 0.45)'
  }
}

const darkPalettes: Record<HomeModuleGemKind, GemPalette> = {
  upload: {
    glow: 'rgba(101, 124, 255, 0.3)',
    accent: '#88a0ff',
    accentStrong: '#5f79ff',
    accentSoft: '#78d9ff',
    faceTop: '#2d3153',
    faceLeft: '#1d2140',
    faceRight: '#334376',
    floatTop: '#434d86',
    floatBottom: '#262f5c',
    detail: '#5f75c9',
    surfaceStroke: 'rgba(196, 210, 255, 0.28)',
    surfaceFill: 'rgba(228, 235, 255, 0.16)',
    surfaceFillSoft: 'rgba(228, 235, 255, 0.2)',
    lineStrong: 'rgba(236, 242, 255, 0.84)',
    lineSoft: 'rgba(203, 213, 255, 0.58)',
    lineDim: 'rgba(132, 149, 228, 0.34)',
    supportStroke: 'rgba(104, 130, 214, 0.42)'
  },
  analysis: {
    glow: 'rgba(74, 151, 255, 0.28)',
    accent: '#72b4ff',
    accentStrong: '#3f8dff',
    accentSoft: '#79eeff',
    faceTop: '#24384f',
    faceLeft: '#18293f',
    faceRight: '#244d73',
    floatTop: '#2f5374',
    floatBottom: '#173552',
    detail: '#58a9df',
    surfaceStroke: 'rgba(185, 233, 255, 0.26)',
    surfaceFill: 'rgba(219, 247, 255, 0.14)',
    surfaceFillSoft: 'rgba(219, 247, 255, 0.18)',
    lineStrong: 'rgba(232, 248, 255, 0.84)',
    lineSoft: 'rgba(167, 221, 255, 0.56)',
    lineDim: 'rgba(101, 167, 221, 0.34)',
    supportStroke: 'rgba(109, 181, 232, 0.34)'
  },
  compare: {
    glow: 'rgba(201, 130, 61, 0.28)',
    accent: '#D4944E',
    accentStrong: '#C9823D',
    accentSoft: '#E8A862',
    faceTop: '#3d3228',
    faceLeft: '#2d241c',
    faceRight: '#5a4230',
    floatTop: '#6b5440',
    floatBottom: '#3d2e20',
    detail: '#c49560',
    surfaceStroke: 'rgba(201, 130, 61, 0.24)',
    surfaceFill: 'rgba(201, 130, 61, 0.14)',
    surfaceFillSoft: 'rgba(201, 130, 61, 0.18)',
    lineStrong: 'rgba(232, 168, 98, 0.82)',
    lineSoft: 'rgba(201, 130, 61, 0.56)',
    lineDim: 'rgba(201, 130, 61, 0.34)',
    supportStroke: 'rgba(201, 130, 61, 0.34)'
  },
  suggestion: {
    glow: 'rgba(255, 165, 96, 0.28)',
    accent: '#ffbd7b',
    accentStrong: '#ff9751',
    accentSoft: '#ffd46c',
    faceTop: '#47382f',
    faceLeft: '#30231b',
    faceRight: '#65452b',
    floatTop: '#735338',
    floatBottom: '#452f1d',
    detail: '#d09a61',
    surfaceStroke: 'rgba(255, 225, 191, 0.24)',
    surfaceFill: 'rgba(255, 239, 219, 0.14)',
    surfaceFillSoft: 'rgba(255, 239, 219, 0.18)',
    lineStrong: 'rgba(255, 244, 230, 0.84)',
    lineSoft: 'rgba(255, 219, 183, 0.58)',
    lineDim: 'rgba(222, 165, 100, 0.34)',
    supportStroke: 'rgba(218, 169, 115, 0.34)'
  }
}

const syncTheme = () => {
  if (typeof document === 'undefined') return
  isDark.value = document.documentElement.classList.contains('dark')
}

const palette = computed(() => {
  return isDark.value ? darkPalettes[props.kind] : lightPalettes[props.kind]
})

const sceneStyle = computed(() => ({
  '--gem-glow': palette.value.glow,
  '--gem-accent': palette.value.accent,
  '--gem-accent-strong': palette.value.accentStrong,
  '--gem-accent-soft': palette.value.accentSoft
}))

const onSelect = () => {
  if (!props.disabled) {
    emit('select')
  }
}

onMounted(() => {
  syncTheme()

  observer = new MutationObserver(() => {
    syncTheme()
  })

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <button
    type="button"
    class="home-module-gem"
    :class="[{ active, disabled, 'dark-mode': isDark }, `kind-${kind}`]"
    :style="sceneStyle"
    :disabled="disabled"
    @click="onSelect"
  >
    <div class="gem-scene">
      <svg class="gem-icon" viewBox="0 0 160 132" aria-hidden="true">
        <defs>
          <filter :id="`${idBase}-shadow`" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="9" :flood-color="palette.glow" flood-opacity="1" />
          </filter>
          <linearGradient :id="`${idBase}-cube-top`" x1="38" y1="58" x2="118" y2="98" gradientUnits="userSpaceOnUse">
            <stop offset="0%" :stop-color="palette.faceTop" />
            <stop offset="100%" :stop-color="palette.floatBottom" />
          </linearGradient>
          <linearGradient :id="`${idBase}-cube-left`" x1="34" y1="70" x2="82" y2="118" gradientUnits="userSpaceOnUse">
            <stop offset="0%" :stop-color="palette.faceLeft" />
            <stop offset="100%" :stop-color="palette.detail" />
          </linearGradient>
          <linearGradient :id="`${idBase}-cube-right`" x1="82" y1="66" x2="126" y2="118" gradientUnits="userSpaceOnUse">
            <stop offset="0%" :stop-color="palette.faceRight" />
            <stop offset="100%" :stop-color="palette.accentSoft" />
          </linearGradient>
          <linearGradient :id="`${idBase}-float`" x1="54" y1="20" x2="112" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" :stop-color="palette.floatTop" />
            <stop offset="100%" :stop-color="palette.floatBottom" />
          </linearGradient>
          <linearGradient :id="`${idBase}-accent`" x1="54" y1="18" x2="116" y2="84" gradientUnits="userSpaceOnUse">
            <stop offset="0%" :stop-color="palette.accentSoft" />
            <stop offset="100%" :stop-color="palette.accentStrong" />
          </linearGradient>
        </defs>

        <ellipse cx="80" cy="108" rx="44" ry="12" fill="var(--gem-glow)" opacity="0.5" />

        <g :filter="`url(#${idBase}-shadow)`">
          <polygon points="80,48 124,71 80,95 36,71" :fill="`url(#${idBase}-cube-top)`" />
          <polygon points="36,71 80,95 80,120 36,97" :fill="`url(#${idBase}-cube-left)`" />
          <polygon points="124,71 80,95 80,120 124,97" :fill="`url(#${idBase}-cube-right)`" />
          <path d="M80 48 L124 71" :stroke="palette.lineStrong" stroke-width="2" stroke-linecap="round" />
          <path d="M80 48 L36 71" :stroke="palette.lineSoft" stroke-width="2" stroke-linecap="round" />
          <path d="M80 95 L80 120" :stroke="palette.lineDim" stroke-width="2" stroke-linecap="round" />
        </g>

        <g v-if="kind === 'upload'">
          <rect x="55" y="25" width="50" height="34" rx="13" :fill="`url(#${idBase}-float)`" :stroke="palette.surfaceStroke" stroke-width="2" />
          <path d="M68 58h24c5 0 8 3 8 7v3H60v-3c0-4 3-7 8-7Z" :fill="palette.surfaceFill" />
          <path d="M80 50V34" :stroke="palette.accentStrong" stroke-width="5" stroke-linecap="round" />
          <path d="M72 41l8-8 8 8" :stroke="palette.accentStrong" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <path d="M64 72h32" :stroke="palette.accent" stroke-width="4" stroke-linecap="round" opacity="0.75" />
          <path d="M63 66h34l6 8H57l6-8Z" :fill="`url(#${idBase}-accent)`" opacity="0.88" />
          <rect x="70" y="77" width="20" height="8" rx="4" :fill="palette.surfaceFillSoft" />
          <circle cx="112" cy="38" r="4" :fill="palette.accentSoft" opacity="0.9" />
        </g>

        <g v-else-if="kind === 'analysis'">
          <rect x="54" y="24" width="52" height="36" rx="14" :fill="`url(#${idBase}-float)`" :stroke="palette.surfaceStroke" stroke-width="2" />
          <rect x="64" y="41" width="8" height="11" rx="3.5" :fill="palette.accentSoft" />
          <rect x="76" y="35" width="8" height="17" rx="3.5" :fill="palette.accent" />
          <rect x="88" y="30" width="8" height="22" rx="3.5" :fill="palette.accentStrong" />
          <path d="M61 55h38" :stroke="palette.supportStroke" stroke-width="2" stroke-linecap="round" />
          <circle cx="80" cy="78" r="10" :fill="palette.surfaceFillSoft" :stroke="palette.surfaceStroke" stroke-width="2" />
          <circle cx="80" cy="78" r="5" :fill="`url(#${idBase}-accent)`" />
          <path d="M80 66v-5M80 95v-5M68 78h-5M97 78h-5" :stroke="palette.accentStrong" stroke-width="3" stroke-linecap="round" opacity="0.8" />
          <circle cx="110" cy="37" r="4" :fill="palette.accentSoft" opacity="0.9" />
        </g>

        <g v-else-if="kind === 'compare'">
          <rect x="50" y="26" width="28" height="34" rx="11" :fill="`url(#${idBase}-float)`" :stroke="palette.surfaceStroke" stroke-width="2" />
          <rect x="82" y="22" width="30" height="38" rx="12" :fill="`url(#${idBase}-float)`" :stroke="palette.surfaceStroke" stroke-width="2" />
          <circle cx="64" cy="39" r="6" :fill="palette.accentSoft" />
          <path d="M56 51c2-5 14-5 16 0" :fill="palette.accent" opacity="0.9" />
          <circle cx="97" cy="36" r="6.5" :fill="palette.accent" />
          <path d="M88 49c2.5-5.5 16-5.5 18.5 0" :fill="palette.accentStrong" opacity="0.92" />
          <path d="M66 71l14 8 16-10" :stroke="palette.lineStrong" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M68 73l12 7" :stroke="palette.lineSoft" stroke-width="6" stroke-linecap="round" />
          <circle cx="117" cy="33" r="4" :fill="palette.accentSoft" opacity="0.9" />
        </g>

        <g v-else>
          <rect x="55" y="24" width="50" height="36" rx="14" :fill="`url(#${idBase}-float)`" :stroke="palette.surfaceStroke" stroke-width="2" />
          <path d="M80 31c-7 0-12 5-12 11 0 4 2 7 5 9v5h14v-5c3-2 5-5 5-9 0-6-5-11-12-11Z" :fill="`url(#${idBase}-accent)`" />
          <rect x="74" y="57" width="12" height="4.5" rx="2.25" :fill="palette.surfaceFillSoft" />
          <path d="M80 27v-5M66 33l-4-4M94 33l4-4" :stroke="palette.accentStrong" stroke-width="3.5" stroke-linecap="round" />
          <path d="M62 73c6-1 11 3 18 3 8 0 11-4 18-3" :stroke="palette.lineSoft" stroke-width="3" stroke-linecap="round" />
          <path d="M70 81l7 6 14-16" :stroke="palette.lineStrong" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="112" cy="37" r="4" :fill="palette.accentSoft" opacity="0.92" />
        </g>
      </svg>
    </div>

    <span class="gem-title">{{ title }}</span>
  </button>
</template>

<style scoped>
.home-module-gem {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  min-height: 152px;
  padding: 16px 14px 14px;
  border-radius: 24px;
  border: 1px solid rgba(130, 151, 217, 0.2);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.78)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.5), transparent 62%);
  box-shadow:
    0 18px 38px rgba(149, 157, 211, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 0 rgba(136, 152, 220, 0.08);
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1),
    border-color 220ms ease,
    background 220ms ease;
}

.home-module-gem::before {
  content: '';
  position: absolute;
  inset: 10px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0));
  opacity: 0.9;
  pointer-events: none;
}

.home-module-gem:hover:not(.disabled) {
  transform: translateY(-5px);
  border-color: color-mix(in srgb, var(--gem-accent) 28%, rgba(130, 151, 217, 0.3));
  box-shadow:
    0 24px 42px color-mix(in srgb, var(--gem-glow) 72%, rgba(149, 157, 211, 0.18)),
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    inset 0 -1px 0 rgba(136, 152, 220, 0.1);
}

.home-module-gem.active {
  border-color: color-mix(in srgb, var(--gem-accent) 42%, rgba(130, 151, 217, 0.35));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 255, 0.86)),
    linear-gradient(135deg, color-mix(in srgb, var(--gem-accent-soft) 18%, transparent), transparent 62%);
  box-shadow:
    0 26px 44px color-mix(in srgb, var(--gem-glow) 82%, rgba(149, 157, 211, 0.2)),
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(136, 152, 220, 0.12);
}

.home-module-gem.disabled {
  opacity: 0.62;
  filter: grayscale(0.08) saturate(0.84);
  cursor: not-allowed;
}

.gem-scene {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gem-icon {
  width: min(100%, 138px);
  height: auto;
  overflow: visible;
}

.gem-title {
  position: relative;
  z-index: 1;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  color: color-mix(in srgb, var(--gem-accent-strong) 30%, var(--text-primary));
  letter-spacing: 0.02em;
}

.home-module-gem.active .gem-title {
  color: color-mix(in srgb, var(--gem-accent-strong) 44%, var(--text-primary));
}

.home-module-gem.dark-mode {
  border-color: color-mix(in srgb, var(--gem-accent) 14%, rgba(139, 92, 246, 0.2));
  background:
    linear-gradient(180deg, rgba(46, 42, 74, 0.9), rgba(32, 29, 53, 0.84)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 62%);
  box-shadow:
    0 22px 44px rgba(6, 5, 16, 0.42),
    0 0 0 1px rgba(255, 255, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
}

.home-module-gem.dark-mode::before {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
  opacity: 0.65;
}

.home-module-gem.dark-mode:hover:not(.disabled) {
  border-color: color-mix(in srgb, var(--gem-accent) 34%, rgba(129, 140, 248, 0.24));
  box-shadow:
    0 28px 54px rgba(6, 5, 16, 0.5),
    0 0 28px color-mix(in srgb, var(--gem-glow) 46%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(0, 0, 0, 0.22);
}

.home-module-gem.dark-mode.active {
  border-color: color-mix(in srgb, var(--gem-accent) 42%, rgba(129, 140, 248, 0.32));
  background:
    linear-gradient(180deg, rgba(58, 53, 92, 0.94), rgba(36, 32, 60, 0.9)),
    linear-gradient(135deg, color-mix(in srgb, var(--gem-accent-soft) 16%, transparent), transparent 62%);
  box-shadow:
    0 30px 58px rgba(6, 5, 16, 0.54),
    0 0 34px color-mix(in srgb, var(--gem-glow) 56%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(0, 0, 0, 0.24);
}

.home-module-gem.dark-mode.disabled {
  opacity: 1;
  filter: saturate(0.78);
  background:
    linear-gradient(180deg, rgba(35, 33, 54, 0.92), rgba(24, 22, 40, 0.88)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent 62%);
  border-color: rgba(140, 130, 186, 0.22);
  box-shadow:
    0 16px 34px rgba(6, 5, 16, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.home-module-gem.dark-mode .gem-title {
  color: rgba(248, 250, 255, 0.96);
  text-shadow: 0 1px 0 rgba(6, 8, 18, 0.34);
}

.home-module-gem.dark-mode.active .gem-title {
  color: rgba(255, 255, 255, 0.98);
}

.home-module-gem.dark-mode.disabled .gem-title {
  color: rgba(214, 219, 235, 0.82);
  text-shadow: none;
}

.home-module-gem.dark-mode.disabled .gem-icon {
  opacity: 0.88;
  filter: drop-shadow(0 8px 18px color-mix(in srgb, var(--gem-glow) 22%, transparent));
}

.home-module-gem.dark-mode .gem-icon {
  filter: drop-shadow(0 10px 22px color-mix(in srgb, var(--gem-glow) 32%, transparent));
}

@media (max-width: 720px) {
  .home-module-gem {
    min-height: 138px;
    padding: 14px 12px 12px;
    border-radius: 20px;
  }

  .gem-icon {
    width: min(100%, 122px);
  }

  .gem-title {
    font-size: 15px;
  }
}
</style>
