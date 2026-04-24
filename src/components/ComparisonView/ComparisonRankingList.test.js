import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ComparisonRankingList.vue', import.meta.url), 'utf8')

test('comparison ranking list translates legacy English match reasons before rendering', () => {
  assert.match(source, /const translateMatchReason = \(reason: string\) =>/)
  assert.match(source, /is the closest weighted mechanics match/)
  assert.match(source, /ranks highly because/)
  assert.match(source, /closest mechanical overlap at/)
  assert.match(source, /loading stays controlled through/)
  assert.match(source, /{{ translateMatchReason\(summary\.matchReason\) }}/)
})
