import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/src/views/Home.vue'), 'utf8')

test('video workspace preview card uses a dark workbench surface', () => {
  const secondaryBlock = source.match(/\.image-card\.secondary \{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusBlock = source.match(/\.image-container\.focus \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(secondaryBlock, /rgba\(30, 28, 48, 0\.94\)/)
  assert.match(secondaryBlock, /rgba\(18, 16, 33, 0\.92\)/)
  assert.doesNotMatch(secondaryBlock, /rgba\(255, 255, 255, 0\.98\)/)
  assert.match(focusBlock, /min-height: clamp\(320px, 42vh, 430px\)/)
})

test('keyframe cards use dark active styling instead of a bright white selection state', () => {
  const activeBlock = source.match(/\.keyframe-card\.active \{[\s\S]*?\n\}/)?.[0] ?? ''
  const hoverBlock = source.match(/\.keyframe-card:hover \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(activeBlock, /background: linear-gradient\(180deg, rgba\(37, 33, 61, 0\.96\), rgba\(25, 22, 43, 0\.94\)\)/)
  assert.match(activeBlock, /0 0 0 1px rgba\(129, 140, 248, 0\.18\)/)
  assert.doesNotMatch(activeBlock, /rgba\(255, 255, 255, 0\.96\)/)
  assert.match(hoverBlock, /background: color-mix\(in srgb, var\(--glass-sm\) 92%, transparent\)/)
})
