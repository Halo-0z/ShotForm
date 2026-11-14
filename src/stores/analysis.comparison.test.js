import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./analysis.ts', import.meta.url), 'utf8')

test('analysis store caches the selected comparison and restores it from history', () => {
  assert.match(source, /const\s*currentComparison\s*=\s*ref<ComparisonResult\s*\|\s*null>\(null\)/)
  assert.match(source, /const\s*setCurrentComparison\s*=\s*\(comparison:\s*ComparisonResult\s*\|\s*null\)\s*=>/)
  assert.match(source, /applyCurrentComparisonSnapshot\(normalizedRecord\.comparison\s*\?\?\s*null\)/)
  assert.match(source, /comparison:\s*buildHistoryComparisonPayload\(currentComparisonSnapshot\.value/)
})

test('analysis store exposes history comparison update plumbing', () => {
  assert.match(source, /const\s*updateHistoryComparison\s*=\s*async\s*\(/)
  assert.match(source, /invoke\(['"]update_analysis_history_comparison['"]/)
  assert.match(source, /updateHistoryComparison,/)
})
