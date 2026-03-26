import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./CinematicHeroStage.vue', import.meta.url), 'utf8')

test('hero stage includes a full-screen autoplaying background video layer', () => {
  assert.match(source, /<video[\s\S]*autoplay[\s\S]*muted[\s\S]*loop[\s\S]*playsinline/)
  assert.match(source, /class="hero-video"/)
  assert.match(source, /object-cover/)
})

test('hero stage keeps an atmospheric fallback when no video source is available', () => {
  assert.match(source, /hero-atmosphere-fallback/)
  assert.match(source, /luka2\.png/)
})
