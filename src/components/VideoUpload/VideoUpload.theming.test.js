import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/src/components/VideoUpload/index.vue'), 'utf8')

test('VideoUpload empty state uses theme-driven glass surfaces', () => {
  assert.match(source, /bg-\[linear-gradient\(180deg,var\(--glass-lg\),var\(--glass-md\)\)\]/)
  assert.match(source, /bg-\[linear-gradient\(180deg,var\(--glass-md\),var\(--glass-xs\)\)\]/)
  assert.match(source, /bg-\[linear-gradient\(180deg,var\(--glass-lg\),color-mix\(in_srgb,var\(--glass-sm\)_92%,transparent\)\)\]/)
})

test('VideoUpload empty state no longer hardcodes bright white panel gradients', () => {
  assert.doesNotMatch(source, /rgba\(255,255,255,0\.94\)/)
  assert.doesNotMatch(source, /rgba\(248,249,255,0\.68\)/)
})
