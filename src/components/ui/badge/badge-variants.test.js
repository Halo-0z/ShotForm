import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('badge semantics keep semantic colors mapped to semantic states', () => {
  assert.match(source, /excellent:\s*"[^"\r\n]*var\(--color-success-bg\)[^"\r\n]*var\(--quality-excellent\)[^"\r\n]*var\(--color-success-border\)[^"\r\n]*"/)
  assert.match(source, /average:\s*"[^"\r\n]*var\(--color-warning-bg\)[^"\r\n]*var\(--quality-average\)[^"\r\n]*var\(--color-warning-border\)[^"\r\n]*"/)
  assert.match(source, /poor:\s*"[^"\r\n]*var\(--color-danger-bg\)[^"\r\n]*var\(--quality-poor\)[^"\r\n]*var\(--color-danger-border\)[^"\r\n]*"/)
  assert.match(source, /destructive:\s*"[^"\r\n]*var\(--color-danger-bg\)[^"\r\n]*var\(--color-danger\)[^"\r\n]*var\(--color-danger-border\)[^"\r\n]*"/)
})

test('badge defaults stay structural and evidence cues do not inherit generic accent styling', () => {
  assert.match(source, /default:\s*"[^"\r\n]*var\(--glass-sm\)[^"\r\n]*var\(--text-secondary\)[^"\r\n]*var\(--surface-border\)[^"\r\n]*"/)
  assert.match(source, /secondary:\s*"[^"\r\n]*var\(--glass-xs\)[^"\r\n]*var\(--text-muted\)[^"\r\n]*var\(--border-color\)[^"\r\n]*"/)
  assert.doesNotMatch(source, /excellent:\s*"[^"\r\n]*var\(--accent-color\)[^"\r\n]*"/)
  assert.doesNotMatch(source, /good:\s*"[^"\r\n]*var\(--accent-color\)[^"\r\n]*"/)
  assert.doesNotMatch(source, /average:\s*"[^"\r\n]*var\(--accent-color\)[^"\r\n]*"/)
  assert.doesNotMatch(source, /poor:\s*"[^"\r\n]*var\(--accent-color\)[^"\r\n]*"/)
})
