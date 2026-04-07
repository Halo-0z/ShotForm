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
