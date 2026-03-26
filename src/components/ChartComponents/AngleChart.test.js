import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/src/components/ChartComponents/AngleChart.vue'), 'utf8')

test('AngleChart reduces x-axis label crowding for dense dark-mode workspaces', () => {
  assert.match(source, /interval: 'auto'/)
  assert.match(source, /hideOverlap: true/)
  assert.match(source, /rotate: 18/)
  assert.match(source, /height: 332px/)
})
