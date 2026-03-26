import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve('D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/HomeWorkspace.vue'),
  'utf8'
)

test('Home workspace remaps the legacy glass variables onto a dark cinematic palette', () => {
  const homePageBlock = source.match(/\.home-page \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(homePageBlock, /--glass-md:\s*rgba\(255, 255, 255, 0\.1[0-9]*\)/)
  assert.match(homePageBlock, /--text-primary:\s*var\(--hero-text\)/)
  assert.match(homePageBlock, /--surface-border:\s*rgba\(255, 255, 255, 0\.1[0-9]*\)/)
})

test('Home upload switch uses theme variables instead of light-only glass values', () => {
  const switchBlock = source.match(/\.upload-switch \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(switchBlock, /background:\s*linear-gradient\(180deg, var\(--glass-md\), var\(--glass-sm\)\),/m)
  assert.match(switchBlock, /inset 0 1px 0 color-mix\(in srgb, var\(--border-light\) 82%, transparent\)/)
  assert.doesNotMatch(switchBlock, /rgba\(255, 255, 255, 0\.96\)/)
  assert.doesNotMatch(switchBlock, /rgba\(248, 249, 255, 0\.84\)/)
})
