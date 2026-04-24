import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STAGE_TIMEOUT_MS,
  TOTAL_TIMEOUT_MS,
  acceptProgressEvent,
  createProgressState,
  shouldStageTimeout,
  shouldTotalTimeout
} from './comparison-progress.js'

test('acceptProgressEvent keeps progress monotonic across stage regressions and lower percents', () => {
  const initial = createProgressState({
    stage: 'loading_templates',
    percent: 25,
    message: 'Loading templates',
    updatedAt: 100
  })

  const regressed = acceptProgressEvent(initial, {
    requestId: 'req-1',
    analysisKey: 'analysis-1',
    stage: 'preparing',
    percent: 10,
    message: 'Preparing',
    updatedAt: 200
  })

  assert.equal(regressed.stage, 'loading_templates')
  assert.equal(regressed.percent, 25)
  assert.equal(regressed.updatedAt, 100)

  const advanced = acceptProgressEvent(regressed, {
    requestId: 'req-1',
    analysisKey: 'analysis-1',
    stage: 'validating_templates',
    percent: 20,
    message: 'Validating templates',
    updatedAt: 300
  })

  assert.equal(advanced.stage, 'validating_templates')
  assert.equal(advanced.percent, 25)
  assert.equal(advanced.updatedAt, 300)
})

test('acceptProgressEvent ignores mismatched request identity when active identity is supplied', () => {
  const initial = createProgressState({
    stage: 'preparing',
    percent: 5,
    updatedAt: 100
  })

  const ignored = acceptProgressEvent(
    initial,
    {
      requestId: 'req-2',
      analysisKey: 'analysis-9',
      stage: 'loading_templates',
      percent: 25,
      message: 'Wrong request',
      updatedAt: 250
    },
    {
      requestId: 'req-1',
      analysisKey: 'analysis-1'
    }
  )

  assert.deepEqual(ignored, initial)
})

test('acceptProgressEvent supports terminal ready and failed stages without regressing percent', () => {
  const state = createProgressState({
    stage: 'building_default_detail',
    percent: 88,
    message: 'Building detail',
    updatedAt: 100
  })

  const ready = acceptProgressEvent(state, {
    requestId: 'req-1',
    analysisKey: 'analysis-1',
    stage: 'ready',
    percent: 96,
    message: 'Ready',
    updatedAt: 110
  })

  assert.equal(ready.stage, 'ready')
  assert.equal(ready.percent, 100)

  const failed = acceptProgressEvent(state, {
    requestId: 'req-1',
    analysisKey: 'analysis-1',
    stage: 'failed',
    percent: 45,
    message: 'Failed',
    updatedAt: 120
  })

  assert.equal(failed.stage, 'failed')
  assert.equal(failed.percent, 88)
  assert.equal(failed.message, 'Failed')
})

test('timeout helpers only trigger for active non-terminal work', () => {
  const active = createProgressState({
    stage: 'ranking_players',
    percent: 68,
    updatedAt: 1_000
  })

  assert.equal(shouldStageTimeout(active, 1_000 + STAGE_TIMEOUT_MS - 1), false)
  assert.equal(shouldStageTimeout(active, 1_000 + STAGE_TIMEOUT_MS), true)

  const terminal = createProgressState({
    stage: 'ready',
    percent: 100,
    updatedAt: 1_000
  })

  assert.equal(shouldStageTimeout(terminal, 1_000 + STAGE_TIMEOUT_MS + 5), false)
  assert.equal(shouldTotalTimeout(5_000, 5_000 + TOTAL_TIMEOUT_MS - 1), false)
  assert.equal(shouldTotalTimeout(5_000, 5_000 + TOTAL_TIMEOUT_MS), true)
})
