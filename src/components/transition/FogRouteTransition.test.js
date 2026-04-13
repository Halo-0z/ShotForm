import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./FogRouteTransition.vue', import.meta.url), 'utf8')

test('fog route transition renders overlay layers and reduced-motion class handling', () => {
  assert.match(source, /fog-route-transition/)
  assert.match(source, /fog-route-transition__veil/)
  assert.match(source, /fog-route-transition__mist/)
  assert.match(source, /reduced-motion/)
})

test('fog route transition avoids full-screen runtime blur filters and uses compositor-friendly hints', () => {
  assert.doesNotMatch(source, /backdrop-filter:/)
  assert.doesNotMatch(source, /filter:\s*blur\(/)
  assert.match(source, /will-change:\s*opacity,\s*transform/)
  assert.match(source, /transform:\s*translate3d/)
})
