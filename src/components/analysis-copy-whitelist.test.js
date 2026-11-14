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
  assert.match(homeWorkspace, /class="summary-text"\s*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="guidance-text"\s*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="reason-item\s*solid"[\s\S]*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="reason-item"[\s\S]*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="shot-type-badge"[\s\S]*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="confidence-value"\s*data-allow-copy="true"/)
  assert.match(homeWorkspace, /class="video-summary-value"\s*data-allow-copy="true"/)
})

test('SuggestionPanel only whitelists generated coaching content', () => {
  assert.match(suggestionPanel, /class="summary-text"\s*data-allow-copy="true"/)
  assert.match(suggestionPanel, /class="body-part"\s*data-allow-copy="true"/)
  assert.match(suggestionPanel, /class="issue-text"\s*data-allow-copy="true"/)
  assert.match(suggestionPanel, /class="advice-text"\s*data-allow-copy="true"/)
})

test('ComparisonView exposes comparison outputs through copyable result nodes', () => {
  assert.match(comparisonView, /<ComparisonDetailPane/)
  assert.match(comparisonView, /<ComparisonRankingList/)
  assert.match(comparisonDetailPane, /class="score-value"\s*data-allow-copy="true"/)
  assert.match(comparisonDetailPane, /class="score-player"\s*data-allow-copy="true"\s*data-compare-detail-player/)
  assert.match(comparisonDetailPane, /role="cell"[\s\S]*data-allow-copy="true"[\s\S]*\{\{\s*row\.userValue\.toFixed\(1\)\s*\}\}°/)
  assert.match(comparisonDetailPane, /role="cell"\s*data-allow-copy="true">\{\{\s*row\.playerValue\.toFixed\(1\)\s*\}\}°/)
  assert.match(comparisonDetailPane, /class="difference-pill"[\s\S]*data-allow-copy="true"[\s\S]*\{\{\s*formatSignedDegrees\(row\.difference\)\s*\}\}/)
  assert.match(comparisonRankingList, /class="comparison-ranking-card__name"\s*data-allow-copy="true"/)
  assert.match(comparisonRankingList, /class="comparison-ranking-card__reason"\s*data-allow-copy="true"/)
  assert.match(comparisonDetailPane, /class="learning-bridge__gap"\s*data-allow-copy="true"/)
})

test('Analysis results remain copyable in the dedicated workbench', () => {
  assert.match(analysisView, /class="analysis-workbench__body" data-allow-copy="true"/)
  assert.match(analysisView, /shotTypeName/)
  assert.match(analysisView, /analysisReasons/)
})
