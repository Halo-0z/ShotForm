import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./CinematicHeroStage.vue', import.meta.url), 'utf8')

test('hero stage includes a full-screen autoplaying background video layer', () => {
  assert.match(source, /<video[\s\S]*autoplay[\s\S]*muted[\s\S]*loop[\s\S]*playsinline/)
  assert.match(source, /class="hero-video"/)
  assert.match(source, /object-cover/)
})

test('hero stage keeps a poster layer available while the background video loads', () => {
  assert.match(source, /posterSrc/)
  assert.match(source, /:poster="posterSrc"/)
  assert.match(source, /class="hero-video-poster"/)
  assert.doesNotMatch(source, /v-else class="hero-video-poster"/)
})

test('hero stage binds the silhouette layer to the current carousel figure instead of a static Luka fallback', () => {
  assert.match(source, /const currentPosterFigureSrc = computed\(\(\) =>/)
  assert.match(source, /const currentPosterFigureStyle = computed\(\(\) => \{/)
  assert.match(source, /props\.figureSrc \? props\.figureSrc : currentFigureSrc\.value/)
  assert.match(source, /<div[\s\S]*class="hero-poster-figure hero-poster-figure-active"[\s\S]*:style="currentPosterFigureStyle"/)
})

test('hero stage derives per-figure normalization scales so front figure and silhouette stay aligned to the Luka baseline', () => {
  assert.match(source, /import\s+\{\s*getHeroFigureScale\s*\}\s+from\s+'@\/lib\/home-hero-scale\.js'/)
  assert.match(source, /const figureMetrics = ref<Record<string, \{ width: number; height: number \}>>\(\{\}\)/)
  assert.match(source, /const currentFigureScale = computed\(\(\) =>/)
  assert.match(source, /const previousFigureScale = computed\(\(\) =>/)
  assert.match(source, /const normalizeFigureScale = \(figure: HeroFigure, scale: number\) =>/)
  assert.match(source, /'--hero-poster-scale': String\(scale \* \(figure\.posterScale \?\? 1\)\)/)
  assert.match(source, /'--hero-figure-scale-x': String\(figure\.flip \? -visualScale : visualScale\)/)
  assert.match(source, /background-size: calc\(var\(--hero-poster-width\) \* var\(--hero-poster-scale, 1\)\) auto;/)
})

test('hero stage applies Jordan-specific visual compensation so the subject fills the same vertical band as Luka', () => {
  assert.match(source, /src:\s*'\/hero\/jordan-shot-2\.png'[\s\S]*?visualScale:\s*1\.04/)
  assert.match(source, /src:\s*'\/hero\/jordan-shot-2\.png'[\s\S]*?posterScale:\s*0\.92/)
  assert.match(source, /src:\s*'\/hero\/jordan-shot-2\.png'[\s\S]*?liftY:\s*'clamp\(0\.3rem, 1vh, 0\.8rem\)'/)
  assert.match(source, /'--hero-figure-lift-y': figure\.liftY \?\? '0px'/)
  assert.match(source, /calc\(0px - var\(--hero-figure-lift-y, 0px\)\)/)
  assert.match(source, /--hero-poster-lift-y/)
})

test('hero stage opts out of autoplay motion when reduced motion is requested', () => {
  assert.match(source, /reduceMotion\?: boolean/)
  assert.match(source, /!props\.reduceMotion/)
})

test('hero stage can enter a lighter handoff mode that stops the autoplay video during route transition', () => {
  assert.match(source, /transitioningOut\?: boolean/)
  assert.match(source, /!props\.transitioningOut/)
  assert.match(source, /'is-transitioning-out': props\.transitioningOut/)
})

test('hero stage keeps an atmospheric fallback when no video source is available', () => {
  assert.match(source, /hero-atmosphere-fallback/)
  assert.match(source, /luka2\.png/)
})

test('hero stage keeps the home cover as a single composition without slide-rotation swap plumbing', () => {
  assert.doesNotMatch(source, /slideId\?: boolean|slideId\?: string/)
  assert.doesNotMatch(source, /workspaceActive\?: boolean/)
  assert.doesNotMatch(source, /hero-poster-swap/)
  assert.doesNotMatch(source, /hero-figure-swap/)
  assert.doesNotMatch(source, /\.hero-stage\.slide-/)
})

test('hero stage defines a dedicated light-mode pastel aurora treatment for the home cover', () => {
  assert.match(source, /light-mode/)
  assert.match(source, /useResolvedThemeState/)
  assert.match(source, /--hero-stage-background:/)
  assert.match(source, /--hero-grain-opacity:/)
  assert.match(source, /hero-grain/)
})

test('hero stage reserves top and bottom clearances and scales the player composition with the window', () => {
  assert.match(source, /--hero-top-safe-clearance/)
  assert.match(source, /--hero-bottom-safe-clearance/)
  assert.match(source, /--hero-figure-width:\s*clamp/)
  assert.match(source, /--hero-poster-width:\s*clamp/)
  assert.match(source, /max-height:\s*calc\(100vh - var\(--hero-top-safe-clearance\) - var\(--hero-bottom-safe-clearance\)\)/)
})

test('hero stage keeps only the readable cover figures in the home carousel and excludes the washed-out Durant asset', () => {
  assert.doesNotMatch(source, /\/hero\/durant-shot\.png/)
})

test('hero stage keeps the previous figure as explicit state so no unrelated figure fades on first paint', () => {
  assert.match(source, /const previousFigure = ref<HeroFigure \| null>\(null\)/)
  assert.match(source, /const hasPreviousFigure = computed\(\(\) => Boolean\(previousFigure\.value\)/)
  assert.match(source, /previousFigure\.value = currentFigure\.value/)
  assert.match(source, /v-if="hasPreviousFigure && previousFigure"/)
  assert.doesNotMatch(source, /const prevFigure = computed/)
})

test('hero stage preloads and decodes carousel images before the autoplay interval starts', () => {
  assert.match(source, /const carouselReady = ref\(false\)/)
  assert.match(source, /const loadFigureMetrics = async \(src: string\)/)
  assert.match(source, /await image\.decode\(\)/)
  assert.match(source, /await preloadImages\(\)/)
  assert.match(source, /carouselReady\.value = true/)
  assert.match(source, /if \(!carouselReady\.value \|\| effectiveFigures\.value\.length <= 1 \|\| props\.reduceMotion\) return/)
})

test('hero stage avoids animating non-interpolable per-figure background and shadow variables during carousel swaps', () => {
  assert.doesNotMatch(source, /const currentThemeVars = computed/)
  assert.doesNotMatch(source, /:style="currentThemeVars"/)
  assert.doesNotMatch(source, /--hero-figure-shadow 1200ms/)
  assert.doesNotMatch(source, /transition: background 1200ms/)
})

test('hero foreground images animate only compositor-friendly opacity and transform', () => {
  assert.doesNotMatch(source, /\.hero-figure \{[\s\S]*?filter:\s*var\(--hero-figure-shadow\)/)
  assert.match(source, /\.hero-figure \{[\s\S]*?will-change:\s*opacity, transform/)
  assert.match(source, /\.hero-figure \{[\s\S]*?backface-visibility:\s*hidden/)
  assert.match(source, /\.hero-figure \{[\s\S]*?contain:\s*paint/)
})

test('hero carousel figure keyframes avoid overshoot scale pulses during crossfade', () => {
  assert.doesNotMatch(source, /calc\(var\(--hero-figure-scale-[xy], 1\) \* 1\.0[1-9]\)/)
  assert.doesNotMatch(source, /calc\(var\(--hero-figure-scale-[xy], 1\) \* 1\.[1-9]\d*\)/)
  assert.doesNotMatch(source, /@keyframes hero-float-in[\s\S]*?scale\([\s\S]*?\* 1\.01/)
  assert.doesNotMatch(source, /@keyframes hero-float-out[\s\S]*?scale\([\s\S]*?\* 1\.03/)
})

test('hero carousel figure crossfade keeps player scale fixed after the slide changes', () => {
  const figureKeyframes = source.match(/@keyframes hero-float-in[\s\S]*?@media \(max-width: 900px\)/)?.[0] ?? ''

  assert.match(figureKeyframes, /@keyframes hero-float-in/)
  assert.match(figureKeyframes, /@keyframes hero-float-out/)
  assert.doesNotMatch(figureKeyframes, /calc\(var\(--hero-figure-scale-[xy], 1\) \* 0\.\d+\)/)
  assert.doesNotMatch(figureKeyframes, /calc\(var\(--hero-figure-scale-[xy], 1\) \* 1\.\d+\)/)
})

test('hero poster figure crossfade does not scale the shadow layer during carousel swaps', () => {
  const posterKeyframes = source.match(/@keyframes hero-poster-fade-in[\s\S]*?@keyframes hero-float-in/)?.[0] ?? ''

  assert.match(posterKeyframes, /@keyframes hero-poster-fade-in/)
  assert.match(posterKeyframes, /@keyframes hero-poster-fade-out/)
  assert.doesNotMatch(posterKeyframes, /scale\((?!1\))/)
  assert.doesNotMatch(posterKeyframes, /scale\(1\.0[1-9]\)/)
})

test('hero stage does not pause the passive carousel when the full-screen cover is hovered', () => {
  assert.doesNotMatch(source, /const isPaused = ref/)
  assert.doesNotMatch(source, /handleMouseEnter/)
  assert.doesNotMatch(source, /handleMouseLeave/)
  assert.doesNotMatch(source, /@mouseenter=/)
  assert.doesNotMatch(source, /@mouseleave=/)
  assert.doesNotMatch(source, /if \(isPaused\.value \|\|/)
})
