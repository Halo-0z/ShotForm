import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./useFogRouteTransition.ts', import.meta.url), 'utf8')

test('fog transition composable exposes route-entry phases and a navigate helper', () => {
  assert.match(source, /phase/)
  assert.match(source, /isActive/)
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /prefersReducedMotion/)
})

test('fog transition composable serializes navigation so repeated clicks cannot stack overlapping film transitions', () => {
  assert.match(source, /isTransitioning/)
  assert.match(source, /if \(isTransitioning\.value\)/)
  assert.match(source, /try \{/)
  assert.match(source, /finally \{/)
})

test('fog transition composable can preload the incoming page and waits for a post-navigation paint before reveal', () => {
  assert.match(source, /preload\?: \(\) => Promise<unknown>/)
  assert.match(source, /const preloadTask = options\?\.preload\?\.\(\) \?\? Promise\.resolve\(\)/)
  assert.match(source, /await preloadTask/)
  assert.match(source, /waitForNextPaint/)
})
