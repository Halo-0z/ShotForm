import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/components/ChartComponents/AngleChart.vue'), 'utf8')

test('AngleChart reduces x-axis label crowding for dense dark-mode workspaces', () => {
  assert.match(source, /interval:\s*['"]auto['"]/)
  assert.match(source, /hideOverlap:\s*true/)
  assert.match(source, /rotate:\s*18/)
  assert.match(source, /height:\s*332px/)
})
