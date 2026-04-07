import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

test('design token renewal defines the approved interaction and evidence colors', () => {
  assert.match(source, /--primary-color:\s*#5D7396/i)
  assert.match(source, /--accent-color:\s*#C9823D/i)
  assert.match(source, /--bg-solid:\s*#F3EEE6/i)
})

test('design token renewal removes purple-dominant structure colors', () => {
  assert.doesNotMatch(source, /#6366F1/i)
  assert.doesNotMatch(source, /#8B5CF6/i)
})
