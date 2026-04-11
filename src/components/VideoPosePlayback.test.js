import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./VideoPosePlayback.vue', import.meta.url), 'utf8')

test('VideoPosePlayback uses a dark workbench shell instead of a bright white card', () => {
  const cardBlock = source.match(/\.playback-card\.dark-mode \{[\s\S]*?\n\}/)?.[0] ?? ''
  const headerBlock = source.match(/\.playback-card\.dark-mode \.playback-header \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(cardBlock, /rgba\(28, 25, 45, 0\.96\)/)
  assert.match(cardBlock, /rgba\(18, 16, 31, 0\.94\)/)
  assert.match(source, /'dark-mode': isDark/)
  assert.match(headerBlock, /border-bottom: 1px solid rgba\(129, 140, 248, 0\.1\)/)
})

test('VideoPosePlayback supports a hero variant that trims chrome and constrains the stage height for the analysis first screen', () => {
  assert.match(source, /variant\?: 'default' \| 'hero'/)
  assert.match(source, /const emit = defineEmits<\{\s*'update:selectedFrameIndex': \[index: number\]\s*\}>/)
  assert.match(source, /const isHeroVariant = computed\(\(\) => props\.variant === 'hero'\)/)
  assert.match(source, /const canAutoplay = computed\(\(\) => canAnimate\.value && !isHeroVariant\.value\)/)
  assert.match(source, /let drawRequestId = 0/)
  assert.match(source, /watch\(\s*\(\) => props\.variant,\s*async \(\) => \{\s*isPlaying\.value = canAutoplay\.value[\s\S]*await drawFrame\(\)[\s\S]*schedulePlayback\(\)\s*\}\s*\)/)
  assert.match(source, /playback-card--hero/)
  assert.match(source, /playback-canvas-wrap--hero/)
  assert.match(source, /v-if="!isHeroVariant"/)
  assert.doesNotMatch(source, /playback-hero-top/)
  assert.match(source, /watch\(currentFrameIndex, async \(index\) => \{/)
  assert.match(source, /if \(!isHeroVariant\.value && index !== \(props\.selectedFrameIndex \?\? 0\)\) \{\s*emit\('update:selectedFrameIndex', index\)/)
  assert.match(source, /if \(!isPlaying\.value \|\| !canAutoplay\.value\) \{/)
  assert.match(source, /isPlaying\.value = canAutoplay\.value/)
  assert.match(source, /const requestId = \+\+drawRequestId/)
  assert.match(source, /if \(requestId !== drawRequestId\) return/)
  assert.match(source, /const frameIndex = currentFrameIndex\.value/)
  assert.match(source, /context\.fillText\(`关键帧 \$\{frameIndex \+ 1\}\/\$\{props\.frames\.length\}`/)
  assert.match(source, /maxDisplayHeight = isHeroVariant\.value\s*\?\s*Math\.min\(460, Math\.max\(280, Math\.round\(window\.innerHeight \* 0\.42\)\)\)\s*:\s*720/)
  assert.match(source, /canvas\.style\.width = isHeroVariant\.value \? `min\(100%, \$\{displayWidth\}px\)` : '100%'/)
  assert.match(source, /const handleWindowResize = \(\) => \{\s*void drawFrame\(\)\s*\}/)
  assert.match(source, /window\.addEventListener\('resize', handleWindowResize\)/)
  assert.match(source, /window\.removeEventListener\('resize', handleWindowResize\)/)
  assert.match(source, /<div v-if="!isHeroVariant" class="playback-toolbar"/)
  assert.match(source, /v-if="frames\.length > 1 && !isHeroVariant"/)
})
