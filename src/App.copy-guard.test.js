import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve('src/App.vue'),
  'utf8'
)

test('App wires the shared copy guard into document copy and cut events', () => {
  assert.match(source, /from\s*['"]@\/lib\/copy-guard\.js['"]/)
  assert.match(source, /createCopyGuardHandlers/)
  assert.match(source, /document\.addEventListener\(['"]copy['"],\s*handleCopy\)/)
  assert.match(source, /document\.addEventListener\(['"]cut['"],\s*handleCut\)/)
  assert.match(source, /document\.removeEventListener\(['"]copy['"],\s*handleCopy\)/)
  assert.match(source, /document\.removeEventListener\(['"]cut['"],\s*handleCut\)/)
})

test('App applies the copy-locked class to the application shell', () => {
  assert.match(source, /COPY_LOCK_CLASS/)
  assert.match(source, /class="app-container"/)
  assert.match(source, /COPY_LOCK_CLASS/)
  assert.match(source, /\.app-copy-locked/)
  assert.match(source, /\[data-allow-copy=['"]true['"]\]/)
})
