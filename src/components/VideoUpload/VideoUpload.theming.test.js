import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('VideoUpload empty state surfaces use neutral structural tokens', () => {
  assert.match(source, /v-if="!hasVideo"[\s\S]*var\(--card-bg\)/)
  assert.match(source, /v-if="!hasVideo"[\s\S]*var\(--surface-color\)/)
  assert.match(source, /v-if="!hasVideo"[\s\S]*var\(--bg-solid\)/)
})

test('VideoUpload upload panels no longer depend on bright glass treatment', () => {
  assert.doesNotMatch(source, /v-if="!hasVideo"[\s\S]*bg-white/)
  assert.doesNotMatch(source, /v-if="!hasVideo"[\s\S]*backdrop-filter:\s*blur/)
  assert.doesNotMatch(source, /rgba\(255,255,255,0\.94\)/)
  assert.doesNotMatch(source, /rgba\(248,249,255,0\.68\)/)
})

test('VideoUpload loaded workspace no longer relies on a decorative glass Card shell', () => {
  assert.match(source, /v-else[\s\S]*border border-\[color-mix\(in_srgb,var\(--surface-border\)/)
  assert.match(source, /v-else[\s\S]*var\(--card-bg\)/)
  assert.match(source, /v-else[\s\S]*var\(--bg-solid\)/)
  assert.doesNotMatch(source, /<Card class="overflow-hidden">/)
  assert.doesNotMatch(source, /<CardContent/)
})
