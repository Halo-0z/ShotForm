import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/.worktrees/cinematic-home-ui/src/assets/index.css'), 'utf8')

test('global theme defines the cinematic dark foundation and display fonts', () => {
  assert.match(source, /Instrument Serif/)
  assert.match(source, /ZCOOL XiaoWei/)
  assert.match(source, /--hero-bg:/)
  assert.match(source, /--hero-text:/)
})

test('global theme includes reduced-motion handling for the hero', () => {
  assert.match(source, /prefers-reduced-motion: reduce/)
})
