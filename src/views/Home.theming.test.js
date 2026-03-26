import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/src/views/Home.vue'), 'utf8')

test('Home upload switch uses theme variables instead of light-only glass values', () => {
  const switchBlock = source.match(/\.upload-switch \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(switchBlock, /background:\s*linear-gradient\(180deg, var\(--glass-md\), var\(--glass-sm\)\),/m)
  assert.match(switchBlock, /inset 0 1px 0 color-mix\(in srgb, var\(--border-light\) 82%, transparent\)/)
  assert.doesNotMatch(switchBlock, /rgba\(255, 255, 255, 0\.96\)/)
  assert.doesNotMatch(switchBlock, /rgba\(248, 249, 255, 0\.84\)/)
})
