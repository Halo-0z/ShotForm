import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./analysis.ts', import.meta.url), 'utf8')

test('analysis store exposes history AI coaching update command', () => {
  assert.match(source, /const updateHistoryAiCoaching = async \(/)
  assert.match(source, /invoke\('update_analysis_history_ai_coaching'/)
  assert.match(source, /updateHistoryAiCoaching,/)
})
