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
  assert.match(source, /['"]\/upload['"]/)
  assert.match(source, /@start="handleStartAnalysis"/)
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
