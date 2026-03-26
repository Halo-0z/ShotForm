import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./HeroCopyBlock.vue', import.meta.url), 'utf8')

test('copy block uses the approved CTA and staggered delays', () => {
  assert.match(source, /\u5f00\u59cb\u5206\u6790/)
  assert.match(source, /0\.2s/)
  assert.match(source, /0\.4s/)
  assert.match(source, /fade-rise/)
})

test('headline uses the cinematic display font stack for English and Chinese text', () => {
  assert.match(source, /font-family:\s*var\(--font-display\), var\(--font-display-cn\)/)
})

test('primary button uses the liquid glass treatment', () => {
  assert.match(source, /liquid-glass/)
  assert.match(source, /::before/)
})
