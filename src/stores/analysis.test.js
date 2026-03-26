import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const storePath = resolve('D:/智能投篮分析/src/stores/analysis.ts')
const source = readFileSync(storePath, 'utf8')

test('analysis store exposes history AI coaching update command', () => {
  assert.match(source, /const updateHistoryAiCoaching = async \(/)
  assert.match(source, /invoke\('update_analysis_history_ai_coaching'/)
  assert.match(source, /updateHistoryAiCoaching,/)
})
