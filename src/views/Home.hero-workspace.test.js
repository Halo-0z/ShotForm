import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Home.vue', import.meta.url), 'utf8')

test('home route is a cover-only page without competing workbench modules', () => {
  assert.doesNotMatch(source, /import\s+HomeWorkspace/)
  assert.doesNotMatch(source, /import\s+UploadWorkbenchPage/)
  assert.doesNotMatch(source, /useAnalysisStore/)
  assert.doesNotMatch(source, /workspace-reveal|workspace-surface|workbench__/)
  assert.doesNotMatch(source, /<HomeWorkspace|<UploadWorkbenchPage/)
})

test('home route sends the CTA through fog navigation into /upload', () => {
  assert.match(source, /useRouter/)
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /['"]\/upload['"]/)
  assert.doesNotMatch(source, /['"]\/analysis['"]/)
  assert.match(source, /@start="handleStartAnalysis"/)
})

test('home route keeps a single cinematic cover block with dominant copy and CTA', () => {
  assert.equal((source.match(/<CinematicHeroStage/g) ?? []).length, 1)
  assert.equal((source.match(/<HeroCopyBlock/g) ?? []).length, 1)
  assert.match(source, /CinematicHeroStage/)
  assert.match(source, /HeroCopyBlock/)
  assert.match(source, /<div class="hero-stage-inner">/)
  assert.match(source, /:headline="HOME_HERO_COPY\.headline"/)
  assert.match(source, /:subtitle="HOME_HERO_COPY\.subtitle"/)
  assert.match(source, /:cta="HOME_HERO_COPY\.cta"/)
  assert.match(source, /@start="handleStartAnalysis"/)
  assert.doesNotMatch(source, /<section class="workspace-reveal"/)
})
