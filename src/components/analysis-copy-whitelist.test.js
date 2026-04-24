import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const homeWorkspace = readFileSync(new URL('./home/HomeWorkspace.vue', import.meta.url), 'utf8')
const suggestionPanel = readFileSync(new URL('./SuggestionPanel/index.vue', import.meta.url), 'utf8')
const comparisonView = readFileSync(new URL('./ComparisonView/index.vue', import.meta.url), 'utf8')
const comparisonRankingList = readFileSync(new URL('./ComparisonView/ComparisonRankingList.vue', import.meta.url), 'utf8')
const comparisonDetailPane = readFileSync(new URL('./ComparisonView/ComparisonDetailPane.vue', import.meta.url), 'utf8')
const analysisView = readFileSync(new URL('../views/Analysis.vue', import.meta.url), 'utf8')

test('HomeWorkspace marks generated analysis text and numeric results as copyable', () => {
  assert.match(homeWorkspace, /class="summary-text" data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="guidance-text" data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="reason-item solid"[\s\S]*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="reason-item"[\s\S]*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="shot-type-badge"[\s\S]*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="confidence-value" data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="video-summary-value" data-allow-copy="true"/)
})

test('SuggestionPanel only whitelists generated coaching content', () => {
  assert.match(suggestionPanel, /class="summary-text" data-allow-copy="true"/)
  assert.match(suggestionPanel, /class="body-part" data-allow-copy="true"/)
  assert.match(suggestionPanel, /class="issue-text" data-allow-copy="true"/)
  assert.match(suggestionPanel, /class="advice-text" data-allow-copy="true"/)
})

test('ComparisonView exposes comparison outputs through copyable result nodes', () => {
  assert.match(comparisonView, /<ComparisonDetailPane/)
  assert.match(comparisonView, /<ComparisonRankingList/)
  assert.match(comparisonDetailPane, /class="score-value" data-allow-copy="true"/)
  assert.match(comparisonDetailPane, /class="score-player" data-allow-copy="true" data-compare-detail-player/)
  assert.match(comparisonDetailPane, /role="cell"[\s\S]*data-allow-copy="true"[\s\S]*\{\{ row\.userValue\.toFixed\(1\) \}\}°/)
  assert.match(comparisonDetailPane, /role="cell" data-allow-copy="true">\{\{ row\.playerValue\.toFixed\(1\) \}\}°/)
  assert.match(comparisonDetailPane, /class="difference-pill"[\s\S]*data-allow-copy="true"[\s\S]*\{\{ formatSignedDegrees\(row\.difference\) \}\}/)
  assert.match(comparisonRankingList, /class="comparison-ranking-card__name" data-allow-copy="true"/)
  assert.match(comparisonRankingList, /class="comparison-ranking-card__reason" data-allow-copy="true"/)
  assert.match(comparisonDetailPane, /class="learning-bridge__gap" data-allow-copy="true"/)
})

test('Analysis view preserves copy access for analysis results on the dedicated route', () => {
  assert.match(analysisView, /class="px-5 py-2 text-base"[\s\S]*data-allow-copy="true"[\s\S]*\{\{ getShotTypeName\(analysisStore\.currentAnalysis\.shotType\) \}\}/)
  assert.match(analysisView, /class="text-sm font-medium text-\[var\(--text-primary\)\]" data-allow-copy="true"/)
  assert.match(analysisView, /class="border-l-2 border-\[var\(--primary-color\)\]\/30 pl-3 text-sm text-\[var\(--text-secondary\)\]"[\s\S]*data-allow-copy="true"/)
})
