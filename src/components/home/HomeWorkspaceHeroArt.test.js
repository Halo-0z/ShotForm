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

  assert.match(shadowBlock, /opacity:\s*0\.(1|12|14|16|18)/)
  assert.match(shadowBlock, /filter:\s*blur/)
  assert.match(shadowBlock, /transform:\s*translate3d\([^)]*\)\s*scale\(1\.(1|15|2|25|3)\)/)
})
