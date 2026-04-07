import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./TitleBar.vue', import.meta.url), 'utf8')

test('title bar keeps immersive and workbench chrome visually distinct but related', () => {
  assert.match(source, /'workbench': !props\.immersive/)
  assert.match(source, /immersive-light/)
  assert.match(source, /\.titlebar\.workbench/)
  assert.match(source, /color-mix\(in srgb, var\(--surface-color\)/)
})
