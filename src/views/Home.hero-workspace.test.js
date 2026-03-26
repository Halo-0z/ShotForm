import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/.worktrees/cinematic-home-ui/src/views/Home.vue'), 'utf8')

test('home route tracks hero cover vs workspace mode', () => {
  assert.match(source, /heroMode/)
  assert.match(source, /getInitialHeroMode/)
  assert.match(source, /@start="enterWorkspace"/)
})

test('home route keeps the workspace on the same page', () => {
  assert.match(source, /HomeWorkspace/)
  assert.match(source, /workspace-reveal/)
  assert.doesNotMatch(source, /router\.push\(['"]\/analysis['"]\)/)
})
