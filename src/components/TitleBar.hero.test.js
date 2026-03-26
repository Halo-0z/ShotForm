import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/TitleBar.vue'), 'utf8')

test('title bar supports an immersive home variant', () => {
  assert.match(source, /immersive/)
  assert.match(source, /transparent/)
})
