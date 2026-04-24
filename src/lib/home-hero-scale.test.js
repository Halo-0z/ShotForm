import test from 'node:test'
import assert from 'node:assert/strict'

import { getHeroFigureScale } from './home-hero-scale.js'

test('getHeroFigureScale returns 1 when current or baseline metrics are missing', () => {
  assert.equal(getHeroFigureScale(null, { width: 926, height: 2288 }), 1)
  assert.equal(getHeroFigureScale({ width: 498, height: 1541 }, null), 1)
})

test('getHeroFigureScale normalizes a figure to Luka visual height based on aspect ratio', () => {
  const luka = { width: 926, height: 2288 }
  const kobe = { width: 498, height: 1541 }
  const jordan = { width: 465, height: 1646 }

  assert.equal(getHeroFigureScale(luka, luka), 1)
  assert.equal(getHeroFigureScale(kobe, luka).toFixed(3), '0.798')
  assert.equal(getHeroFigureScale(jordan, luka).toFixed(3), '0.698')
})

test('getHeroFigureScale compensates for figures that hit the viewport height cap before scale is applied', () => {
  const luka = { width: 926, height: 2288 }
  const jordan = { width: 465, height: 1646 }
  const layoutFrame = { shellWidth: 392, availableHeight: 1215 }

  assert.equal(getHeroFigureScale(jordan, luka, layoutFrame).toFixed(3), '0.797')
})
