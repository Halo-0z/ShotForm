import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/TitleBar.vue'), 'utf8')

test('title bar supports an immersive home variant', () => {
  assert.match(source, /immersive/)
  assert.match(source, /transparent/)
})

test('immersive history entry lives in the utility controls instead of the centered nav slot', () => {
  assert.match(source, /titlebar-utility/)
  assert.match(source, /v-if="props\.immersive"/)
  assert.doesNotMatch(source, /class="titlebar-center"/)
})

test('immersive title bar uses the same restrained matte language as the upload workbench', () => {
  assert.match(source, /background:\s*linear-gradient\(180deg,\s*rgba\(5,\s*7,\s*12,\s*0\.9\),\s*rgba\(5,\s*7,\s*12,\s*0\.18\)\)/)
  assert.match(source, /border-bottom:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.06\)/)
  assert.match(source, /backdrop-filter:\s*blur\(12px\) saturate\(120%\)/)
})

test('immersive title bar exposes a dedicated light-mode class instead of relying on scoped global ancestor selectors', () => {
  assert.match(source, /immersive-light/)
  assert.match(source, /useResolvedThemeState/)
  assert.match(source, /\.titlebar\.immersive\.immersive-light/)
})

test('immersive history action uses fog-route transition helper for consistent page handoff', () => {
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /from ['"]@\/composables\/useFogRouteTransition['"]/)
  assert.match(source, /navigateWithFogTransition\(router,\s*['"]\/history['"]\)/)
  assert.doesNotMatch(source, /router\.push\(['"]\/history['"]\)/)
})
