import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Analysis.vue', import.meta.url), 'utf8')

test('analysis page opens with a split hero that pairs one conclusion rail with one evidence stage', () => {
  assert.match(source, /<section class="analysis-page__hero">/)
  assert.match(source, /class="analysis-page__hero-stage"/)
  assert.match(source, /class="analysis-page__hero-reasons"/)
  assert.doesNotMatch(source, /class="analysis-page__diagnosis"/)
  assert.match(source, /PAGE_COVER_ART\.analysis/)
})

test('analysis page tightens the first screen on shorter desktop windows so the evidence stage stays visible', () => {
  assert.match(source, /@media \(max-height: 900px\) and \(min-width: 1101px\)/)
  assert.match(source, /\.analysis-page__hero \{\s*padding: 22px;\s*gap: 18px;\s*grid-template-columns: minmax\(280px, 0\.88fr\) minmax\(0, 1\.12fr\);/s)
  assert.match(source, /\.analysis-page__hero-summary h2 \{\s*font-size: clamp\(24px, 2\.7vw, 36px\);/s)
})
