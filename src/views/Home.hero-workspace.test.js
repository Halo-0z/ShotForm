import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Home.vue', import.meta.url), 'utf8')

test('home route is a cover-only page that does not render upload-workbench structure', () => {
  assert.doesNotMatch(source, /HomeWorkspace/)
  assert.doesNotMatch(source, /getHomeScrollSnapTarget/)
  assert.doesNotMatch(source, /scrollWorkspaceIntoView/)
  assert.doesNotMatch(source, /workspace-active/)
})

test('home route sends the CTA through fog navigation into /upload', () => {
  assert.match(source, /useRouter/)
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /const preloadUploadPage = \(\) => import\('@\/views\/Upload\.vue'\)/)
  assert.match(source, /preload:\s*preloadUploadPage/)
  assert.match(source, /['"]\/upload['"]/)
  assert.match(source, /@start="handleStartAnalysis"/)
})

test('home route warms the upload route before the CTA is clicked so the fog transition does not parse the next page mid-animation', () => {
  assert.match(source, /const scheduleUploadPreload = \(\) =>/)
  assert.match(source, /requestIdleCallback/)
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*void preloadUploadPage\(\)/)
  assert.match(source, /onMounted\(\(\) => \{/)
  assert.match(source, /scheduleUploadPreload\(\)/)
})

test('home route keeps cover copy and CTA as the dominant opening hierarchy', () => {
  assert.match(source, /CinematicHeroStage/)
  assert.match(source, /HeroCopyBlock/)
  assert.match(source, /<div class="hero-stage-inner">/)
  assert.match(source, /:headline="HOME_HERO_COPY\.headline"/)
  assert.match(source, /:subtitle="HOME_HERO_COPY\.subtitle"/)
  assert.match(source, /:cta="HOME_HERO_COPY\.cta"/)
  assert.match(source, /@start="handleStartAnalysis"/)
})

test('home route rotates through a curated set of hero player silhouettes', () => {
  assert.match(source, /HOME_HERO_SLIDES/)
  assert.match(source, /HOME_HERO_ROTATION_MS/)
  assert.match(source, /const activeHeroIndex = ref\(0\)/)
  assert.match(source, /const activeHeroSlide = computed\(\(\) => HOME_HERO_SLIDES\[activeHeroIndex\.value\]/)
  assert.match(source, /setInterval\(/)
  assert.match(source, /clearInterval\(/)
  assert.match(source, /:figure-src="activeHeroSlide\.figureSrc"/)
  assert.match(source, /:poster-src="activeHeroSlide\.posterSrc \?\? activeHeroSlide\.figureSrc"/)
})

test('home route keeps reduced-motion awareness for the cinematic cover', () => {
  assert.match(source, /reduceMotion/)
  assert.match(source, /shouldReduceHeroMotion/)
  assert.match(source, /:reduce-motion="reduceMotion"/)
})

test('home route tells the cinematic hero to enter a lighter exit state once the CTA handoff starts', () => {
  assert.match(source, /const isTransitioningToUpload = ref\(false\)/)
  assert.match(source, /isTransitioningToUpload\.value = true/)
  assert.match(source, /:transitioning-out="isTransitioningToUpload"/)
})
