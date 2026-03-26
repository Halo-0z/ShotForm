import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/src/components/VideoPosePlayback.vue'), 'utf8')

test('VideoPosePlayback uses a dark workbench shell instead of a bright white card', () => {
  const cardBlock = source.match(/\.playback-card\.dark-mode \{[\s\S]*?\n\}/)?.[0] ?? ''
  const headerBlock = source.match(/\.playback-card\.dark-mode \.playback-header \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(cardBlock, /rgba\(28, 25, 45, 0\.96\)/)
  assert.match(cardBlock, /rgba\(18, 16, 31, 0\.94\)/)
  assert.match(source, /'dark-mode': isDark/)
  assert.match(headerBlock, /border-bottom: 1px solid rgba\(129, 140, 248, 0\.1\)/)
})
