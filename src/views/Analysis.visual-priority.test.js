import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Analysis.vue', import.meta.url), 'utf8')

test('analysis page gives the first screen one dominant conclusion zone and one dominant evidence zone', () => {
  assert.match(source, /class="analysis-page__hero"/)
  assert.match(source, /class="analysis-page__hero-summary"/)
  assert.match(source, /class="analysis-page__hero-stage"/)
  assert.match(source, /class="analysis-page__hero-reasons"/)
  assert.doesNotMatch(source, /analysis-page__next-steps/)
  assert.doesNotMatch(source, /analysis-page__summary-stats/)
})
