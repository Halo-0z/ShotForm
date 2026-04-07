import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Progress.vue', import.meta.url), 'utf8')

test('progress track stays a measured structural surface, not an ornamental treatment', () => {
  assert.match(source, /bg-\[color-mix\(in_srgb,var\(--text-muted\)_16%,var\(--bg-solid\)\)\]/)
  assert.match(source, /border-\[color-mix\(in_srgb,var\(--border-color\)_72%,transparent\)\]/)
  assert.match(source, /shadow-\[inset_0_1px_2px_rgba\(20,25,34,0\.12\)\]/)
  assert.doesNotMatch(source, /bg-gradient/)
})

test('progress fill remains clean and role-driven across default and quality states', () => {
  assert.match(source, /default:\s*'bg-\[var\(--primary-color\)\]'/)
  assert.match(source, /excellent:\s*'bg-\[var\(--quality-excellent\)\]'/)
  assert.match(source, /good:\s*'bg-\[var\(--quality-good\)\]'/)
  assert.match(source, /average:\s*'bg-\[var\(--quality-average\)\]'/)
  assert.match(source, /poor:\s*'bg-\[var\(--quality-poor\)\]'/)
  assert.doesNotMatch(source, /default:\s*'[^'\r\n]*accent-color[^'\r\n]*'/)
})
