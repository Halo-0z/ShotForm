import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./UploadWorkbenchPage.vue', import.meta.url), 'utf8')

test('upload workbench uses neutral structural materials for ordinary layout regions', () => {
  assert.match(source, /\.upload-workbench__rail\s*\{[\s\S]*var\(--card-bg\)/)
  assert.match(source, /\.upload-workbench__main\s*\{[\s\S]*var\(--card-bg\)/)
  assert.match(source, /\.upload-workbench__surface\s*\{[\s\S]*var\(--bg-solid\)/)
  assert.match(source, /\.upload-workbench__status-rail\s*\{[\s\S]*var\(--surface-color\)/)
})

test('upload workbench mode switch, main surface, and status rail share one coherent material system', () => {
  assert.match(source, /\.upload-workbench__mode-strip\s*\{[\s\S]*border:\s*1px solid color-mix\(in srgb, var\(--surface-border\)/)
  assert.match(source, /\.upload-workbench__surface\s*\{[\s\S]*border:\s*1px solid color-mix\(in srgb, var\(--surface-border\)/)
  assert.match(source, /\.upload-workbench__status-rail\s*\{[\s\S]*border:\s*1px solid color-mix\(in srgb, var\(--surface-border\)/)
})

test('upload workbench avoids stacked decorative glass shells', () => {
  assert.doesNotMatch(source, /var\(--glass-(?:xs|sm|md|lg)\)/)
  assert.doesNotMatch(source, /backdrop-filter:\s*blur/)
  assert.doesNotMatch(source, /0 24px 64px/)
  assert.doesNotMatch(source, /0 18px 42px/)
})
