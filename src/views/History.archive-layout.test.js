import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./History.vue', import.meta.url), 'utf8')

test('history page uses an archive list with session metadata and resume actions instead of a generic card grid', () => {
  assert.match(source, /class="history-session-row__timestamp"/)
  assert.match(source, /class="history-session-row__actions"/)
  assert.match(source, /class="history-session-row__resume"/)
  assert.match(source, /继续分析/)
  assert.doesNotMatch(source, /class="history-grid"/)
})
