import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('ImageUpload drop zone uses neutral structural surfaces instead of glass blur treatment', () => {
  assert.match(source, /v-if="!previewUrl"[\s\S]*color-mix\(in_srgb,var\(--surface-border\)/)
  assert.match(source, /v-if="!previewUrl"[\s\S]*var\(--card-bg\)/)
  assert.match(source, /v-if="!previewUrl"[\s\S]*var\(--surface-color\)/)
  assert.match(source, /v-if="!previewUrl"[\s\S]*var\(--bg-solid\)/)
  assert.doesNotMatch(source, /v-if="!previewUrl"[\s\S]*backdrop-blur-sm/)
  assert.doesNotMatch(source, /v-if="!previewUrl"[\s\S]*var\(--glass-/)
})

test('ImageUpload loaded preview surface avoids decorative glass card shells', () => {
  assert.match(source, /v-else[\s\S]*border border-\[color-mix\(in_srgb,var\(--surface-border\)/)
  assert.match(source, /v-else[\s\S]*var\(--card-bg\)/)
  assert.match(source, /v-else[\s\S]*var\(--bg-solid\)/)
  assert.doesNotMatch(source, /<Card/)
  assert.doesNotMatch(source, /<CardContent/)
})

test('ImageUpload helper pill and crop dialog stay in the neutral workbench material system', () => {
  assert.match(source, /rounded-full[\s\S]*var\(--surface-color\)/)
  assert.match(source, /rounded-full[\s\S]*var\(--bg-solid\)/)
  assert.match(source, /<DialogContent[\s\S]*var\(--card-bg\)/)
  assert.match(source, /<DialogContent[\s\S]*var\(--bg-solid\)/)
  assert.doesNotMatch(source, /<DialogContent[\s\S]*var\(--glass-/)
})
