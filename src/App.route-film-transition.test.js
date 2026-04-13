import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./App.vue', import.meta.url), 'utf8')

test('app shell mounts the fog route transition above the router view', () => {
  assert.match(source, /FogRouteTransition/)
  assert.match(source, /<FogRouteTransition/)
})

test('app shell keeps a stable scrollbar gutter so route changes do not nudge centered pages sideways', () => {
  assert.match(source, /\.app-content\s*\{[\s\S]*scrollbar-gutter:\s*stable;/)
  assert.doesNotMatch(source, /scrollbar-gutter:\s*stable both-edges;/)
})
