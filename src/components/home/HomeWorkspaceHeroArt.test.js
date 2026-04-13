import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./HomeWorkspaceHeroArt.vue', import.meta.url), 'utf8')

test('workspace hero art references the approved Jordan figure and silhouette assets', () => {
  assert.match(source, /jordan-logo-original\.png/)
  assert.match(source, /jordan-logo-shadow\.png/)
  assert.match(source, /workspace-hero-figure/)
  assert.match(source, /workspace-hero-shadow/)
})

test('workspace hero art exposes compact and focused variants for layout compression', () => {
  assert.match(source, /compact\?: boolean/)
  assert.match(source, /focused\?: boolean/)
  assert.match(source, /:class="\{ compact: props\.compact, focused: props\.focused \}"/)
})

test('workspace hero art enlarges the silhouette beyond the foreground figure and softens it into an echo layer', () => {
  const shadowBlock = source.match(/\.workspace-hero-shadow \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(shadowBlock, /width:\s*var\(--hero-shadow-width\)/)
  assert.match(shadowBlock, /opacity:\s*0\.(1|12|14|16|18)/)
  assert.match(shadowBlock, /filter:\s*blur/)
  assert.match(shadowBlock, /transform:\s*translate3d\(var\(--hero-shadow-shift-x\), var\(--hero-shadow-shift-y\), 0\)\s*scale\(1\.(1|15|2|25|3)\)/)
  assert.match(source, /\.workspace-hero-figure \{[\s\S]*?width:\s*var\(--hero-figure-width\)/)
  assert.match(source, /\.workspace-hero-figure \{[\s\S]*?transform:\s*translate3d\(var\(--hero-figure-shift-x\), var\(--hero-figure-shift-y\), 0\)/)
})

test('workspace hero art anchors the silhouette from the lower-right and shifts it down-left away from the head line', () => {
  const artBlock = source.match(/\.workspace-hero-art \{[\s\S]*?\n\}/)?.[0] ?? ''
  const shadowBlock = source.match(/\.workspace-hero-shadow \{[\s\S]*?\n\}/)?.[0] ?? ''
  const compactBlock = source.match(/\.workspace-hero-art\.compact \{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedBlock = source.match(/\.workspace-hero-art\.focused \{[\s\S]*?\n\}/)?.[0] ?? ''
  const mobileBlock = source.match(/@media \(max-width: 720px\) \{[\s\S]*?\.workspace-hero-art\.focused \{[\s\S]*?\n\s*\}/)?.[0] ?? ''

  assert.match(artBlock, /--hero-figure-width:\s*9[3-5]%/)
  assert.match(artBlock, /--hero-figure-shift-y:\s*0\.(5|55|6|65|7)rem/)
  assert.match(shadowBlock, /transform-origin:\s*8[5-9]%\s*100%/)
  assert.match(artBlock, /--hero-shadow-shift-x:\s*-2\.[0-3]rem/)
  assert.match(compactBlock, /--hero-figure-width:\s*9[1-3]%/)
  assert.match(focusedBlock, /--hero-figure-width:\s*90%/)
  assert.match(mobileBlock, /--hero-figure-width:\s*90%/)
  assert.match(mobileBlock, /--hero-shadow-shift-y:\s*1rem/)
})
