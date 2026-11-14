import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./VideoPosePlayback.vue', import.meta.url), 'utf8')

test('VideoPosePlayback uses a dark workbench shell instead of a bright white card', () => {
  const cardBlock = source.match(/\.playback-card\.dark-mode\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const headerBlock = source.match(/\.playback-card\.dark-mode\s*\.playback-header\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(cardBlock, /rgba\(28,\s*25,\s*45,\s*0\.96\)/)
  assert.match(cardBlock, /rgba\(18,\s*16,\s*31,\s*0\.94\)/)
  assert.match(source, /['"]dark-mode['"]:\s*isDark/)
  assert.match(headerBlock, /border-bottom:\s*1px\s*solid\s*rgba\(129,\s*140,\s*248,\s*0\.1\)/)
})

test('VideoPosePlayback supports a hero variant that trims chrome and constrains the stage height for the analysis first screen', () => {
  assert.match(source, /variant\?:\s*['"]default['"]\s*\|\s*['"]hero['"]/)
  assert.match(source, /const\s*emit\s*=\s*defineEmits<\{\s*['"]update:selectedFrameIndex['"]:\s*\[index:\s*number\]\s*\}>/)
  assert.match(source, /const\s*isHeroVariant\s*=\s*computed\(\(\)\s*=>\s*props\.variant\s*===\s*['"]hero['"]\)/)
  assert.match(source, /const\s*canAutoplay\s*=\s*computed\(\(\)\s*=>\s*canAnimate\.value\)/)
  assert.match(source, /let\s*drawRequestId\s*=\s*0/)
  assert.match(source, /watch\(\s*\(\)\s*=>\s*props\.variant,\s*async\s*\(\)\s*=>\s*\{\s*isPlaying\.value\s*=\s*canAutoplay\.value[\s\S]*await\s*drawFrame\(\)[\s\S]*schedulePlayback\(\)\s*\}\s*\)/)
  assert.match(source, /playback-card--hero/)
  assert.match(source, /playback-canvas-wrap--hero/)
  assert.match(source, /v-if="!isHeroVariant"/)
  assert.doesNotMatch(source, /playback-hero-top/)
  assert.match(source, /watch\(currentFrameIndex,\s*async\s*\(index\)\s*=>\s*\{/)
  assert.match(source, /if\s*\(!isHeroVariant\.value\s*&&\s*index\s*!==\s*\(props\.selectedFrameIndex\s*\?\?\s*0\)\)\s*\{\s*emit\(['"]update:selectedFrameIndex['"],\s*index\)/)
  assert.match(source, /if\s*\(!isPlaying\.value\s*\|\|\s*!canAutoplay\.value\)\s*\{/)
  assert.match(source, /isPlaying\.value\s*=\s*canAutoplay\.value/)
  assert.match(source, /const\s*requestId\s*=\s*\+\+drawRequestId/)
  assert.match(source, /if\s*\(requestId\s*!==\s*drawRequestId\)\s*return/)
  assert.match(source, /const\s*frameIndex\s*=\s*currentFrameIndex\.value/)
  assert.match(source, /context\.fillText\(`关键帧\s*\$\{frameIndex\s*\+\s*1\}\/\$\{props\.frames\.length\}`/)
  assert.match(source, /maxDisplayHeight\s*=\s*isHeroVariant\.value\s*\?\s*Math\.min\(460,\s*Math\.max\(280,\s*Math\.round\(window\.innerHeight\s*\*\s*0\.42\)\)\)\s*:\s*720/)
  assert.match(source, /canvas\.style\.width\s*=\s*isHeroVariant\.value\s*\?\s*`min\(100%,\s*\$\{displayWidth\}px\)`\s*:\s*['"]100%['"]/)
  assert.match(source, /const\s*handleWindowResize\s*=\s*\(\)\s*=>\s*\{\s*void\s*drawFrame\(\)\s*\}/)
  assert.match(source, /window\.addEventListener\(['"]resize['"],\s*handleWindowResize\)/)
  assert.match(source, /window\.removeEventListener\(['"]resize['"],\s*handleWindowResize\)/)
  assert.match(source, /<div\s*class="playback-toolbar"/)
  assert.match(source, /v-if="frames\.length\s*>\s*1"/)
})
