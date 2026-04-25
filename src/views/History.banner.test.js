import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./History.vue', import.meta.url), 'utf8')

test('history page uses subdued atmosphere with approved archival artwork', () => {
  assert.match(source, /PAGE_COVER_ART\.history/)
  assert.match(source, /class="history-page__cover"/)
  assert.match(source, /class="history-archive"/)
  assert.match(source, /class="history-session-row"/)
  assert.doesNotMatch(source, /class="history-grid"/)
  assert.doesNotMatch(source, /class="history-hero-banner"/)
})
