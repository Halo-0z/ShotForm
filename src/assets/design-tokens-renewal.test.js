import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

test('design token renewal defines the approved interaction and evidence colors', () => {
  assert.match(source, /--primary-color:\s*#5D7396/i)
  assert.match(source, /--accent-color:\s*#C9823D/i)
  assert.match(source, /--bg-solid:\s*#F3EEE6/i)
})

test('design token renewal encodes neutral-first structural roles for workbench surfaces', () => {
  assert.match(source, /--bg-color:\s*linear-gradient\(135deg,\s*#F3EEE6\s*0%,\s*#ECE5DA\s*42%,\s*#E7E0D4\s*100%\)/i)
  assert.match(source, /--surface-border:\s*rgba\(103,\s*114,\s*130,\s*0\.18\)/i)
  assert.match(source, /--card-bg:\s*rgba\(250,\s*247,\s*242,\s*0\.94\)/i)
  assert.match(source, /--text-primary:\s*#1C2128/i)
  assert.match(source, /--text-secondary:\s*#677282/i)
})

test('design token renewal removes purple-dominant structural language instead of only swapping a single literal', () => {
  assert.doesNotMatch(source, /#6366F1/i)
  assert.doesNotMatch(source, /#8B5CF6/i)
  assert.doesNotMatch(source, /#4F46E5/i)
  assert.doesNotMatch(source, /#818CF8/i)
  assert.doesNotMatch(source, /rgba\(99,\s*102,\s*241,\s*0\.\d+\)/i)
  assert.doesNotMatch(source, /rgba\(139,\s*92,\s*246,\s*0\.\d+\)/i)
})
