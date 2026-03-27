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
