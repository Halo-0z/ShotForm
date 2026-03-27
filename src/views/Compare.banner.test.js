import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Compare.vue', import.meta.url), 'utf8')

test('compare page adds a top banner using the approved dunk artwork', () => {
  assert.match(source, /jordan-dunk\.png/)
  assert.match(source, /class="compare-hero-banner"/)
  assert.match(source, /class="compare-hero-art"/)
})
