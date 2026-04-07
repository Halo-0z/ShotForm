import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./analysis.ts', import.meta.url), 'utf8')

test('analysis store caches the selected comparison and restores it from history', () => {
  assert.match(source, /const currentComparison = ref<ComparisonResult \| null>\(null\)/)
  assert.match(source, /const setCurrentComparison = \(comparison: ComparisonResult \| null\) =>/)
  assert.match(source, /currentComparison\.value = normalizedRecord\.comparison \?\? null/)
  assert.match(source, /comparison: currentComparison\.value/)
})

test('analysis store exposes history comparison update plumbing', () => {
  assert.match(source, /const updateHistoryComparison = async \(/)
  assert.match(source, /invoke\('update_analysis_history_comparison'/)
  assert.match(source, /updateHistoryComparison,/)
})
