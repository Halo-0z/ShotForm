import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const componentPath = resolve('D:/智能投篮分析/src/components/HomeModuleGem.vue')
const source = readFileSync(componentPath, 'utf8')

test('HomeModuleGem defines a dark-specific icon palette', () => {
  assert.match(source, /const isDark = ref\(false\)/)
  assert.match(source, /MutationObserver/)
  assert.match(
    source,
    /return isDark\.value \? darkPalettes\[props\.kind\] : lightPalettes\[props\.kind\]/
  )
  assert.match(source, /'dark-mode': isDark/)
})

test('HomeModuleGem uses high-contrast dark title colors', () => {
  assert.match(source, /\.home-module-gem\.dark-mode \.gem-title \{\s*color: rgba\(248, 250, 255, 0\.96\);/m)
  assert.match(
    source,
    /\.home-module-gem\.dark-mode\.active \.gem-title \{\s*color: rgba\(255, 255, 255, 0\.98\);/m
  )
  assert.doesNotMatch(source, /:global\(\.dark\) \.home-module-gem/)
})
