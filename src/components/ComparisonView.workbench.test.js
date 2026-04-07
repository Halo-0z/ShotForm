import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ComparisonView/index.vue', import.meta.url), 'utf8')

test('comparison view loads ranked matches and renders a workbench instead of a blank selector-first flow', () => {
  assert.match(source, /compare_against_all_players/)
  assert.match(source, /class="comparison-ranking"/)
  assert.match(source, /class="comparison-ranking-card"/)
  assert.match(source, /class="comparison-learning-bridge"/)
  assert.match(source, /analysisStore\.setCurrentComparison\(/)
})

test('comparison view falls back to legacy template loading when ranked comparison is unavailable', () => {
  assert.match(source, /const withTimeout = async </)
  assert.match(source, /const loadFallbackWorkbench = async \(/)
  assert.match(source, /withTimeout\(\s*invoke<ComparisonWorkbenchResult>\('compare_against_all_players'/)
  assert.match(source, /Promise\.allSettled\(/)
  assert.match(source, /invoke<PlayerTemplate\[]>\('get_player_templates'/)
  assert.match(source, /withTimeout\(\s*invoke<ComparisonResult>\('compare_with_player'/)
  assert.match(source, /const fallbackSummaries = fallbackResults/)
})

test('comparison view exposes a retry path when ranking fails or times out', () => {
  assert.match(source, /const retryWorkbench = async \(\) =>/)
  assert.match(source, /class="comparison-retry"/)
  assert.match(source, /@click="void retryWorkbench\(\)"/)
})
