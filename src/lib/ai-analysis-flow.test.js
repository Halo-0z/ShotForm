import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getStoredAutoAiPreference,
  shouldAutoGenerateAiReview,
  getAiReviewState,
  getAiCoachingState
} from './ai-analysis-flow.js'

test('defaults auto ai preference to false when storage is empty', () => {
  assert.equal(getStoredAutoAiPreference(null), false)
})

test('does not auto-generate ai review when cached review exists', () => {
  assert.equal(
    shouldAutoGenerateAiReview(true, { aiReview: { title: 'cached' } }),
    false
  )
})

test('marks analysis without review as idle', () => {
  assert.equal(getAiReviewState({ aiReview: null }), 'idle')
})

test('marks coaching cache as cached when summary and suggestions exist', () => {
  assert.equal(
    getAiCoachingState({
      aiCoachingSummary: 'cached',
      aiCoachingSuggestions: [{ bodyPart: 'wrist' }]
    }),
    'cached'
  )
})
