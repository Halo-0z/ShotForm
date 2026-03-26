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

test('hero stage keeps an atmospheric fallback when no video source is available', () => {
  assert.match(source, /hero-atmosphere-fallback/)
  assert.match(source, /luka2\.png/)
})
