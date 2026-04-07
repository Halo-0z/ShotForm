import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const titleBarSource = readFileSync(new URL('./TitleBar.vue', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')

test('title bar consumes explicit workbench route intent instead of inferring workbench from immersive inversion', () => {
  assert.match(appSource, /route\.meta\.workbenchPage/)
  assert.match(appSource, /const isWorkbenchChrome = computed\(\(\) => Boolean\(route\.meta\.workbenchPage\)\)/)
  assert.match(appSource, /<TitleBar[\s\S]*:immersive="isImmersiveChrome"[\s\S]*:workbench="isWorkbenchChrome"/)

  assert.match(titleBarSource, /workbench\?: boolean/)
  assert.match(titleBarSource, /workbench:\s*false/)
  assert.match(titleBarSource, /workbench:\s*props\.workbench/)
  assert.doesNotMatch(titleBarSource, /'workbench': !props\.immersive/)
})
