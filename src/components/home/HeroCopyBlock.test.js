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

test('copy block keeps a streamlined motion contract for the cover flow', () => {
  assert.match(source, /motionMode\?: 'intro' \| 'settled'/)
  assert.match(source, /motion-intro/)
  assert.doesNotMatch(source, /motion-return/)
  assert.doesNotMatch(source, /hero-copy-return/)
})

test('headline uses the cinematic display font stack for English and Chinese text', () => {
  assert.match(source, /font-family:\s*var\(--font-display\), var\(--font-display-cn\)/)
})

test('primary button uses the liquid glass treatment', () => {
  assert.match(source, /liquid-glass/)
  assert.match(source, /::before/)
})

test('primary button keeps a subtle idle glimmer before hover', () => {
  assert.match(source, /\.hero-cta::after/)
  assert.match(source, /cta-idle-drift/)
  assert.match(source, /inset:\s*0;/)
  assert.match(source, /background-size:\s*220% 100%/)
  assert.match(source, /background-position:\s*132% 50%/)
  assert.doesNotMatch(source, /width:\s*36%/)
})

test('primary button sweeps a restrained light streak on hover and respects reduced motion', () => {
  assert.match(source, /\.hero-cta:hover/)
  assert.match(source, /cta-hover-sweep/)
  assert.match(source, /animation:\s*cta-hover-sweep/)
  assert.doesNotMatch(source, /mix-blend-mode:\s*screen/)
  assert.match(source, /prefers-reduced-motion: reduce/)
})

test('copy block remaps text and CTA contrast for light mode instead of assuming a dark hero', () => {
  assert.match(source, /light-mode/)
  assert.match(source, /useResolvedThemeState/)
  assert.match(source, /--hero-copy-color:/)
  assert.match(source, /--hero-cta-background:/)
})
