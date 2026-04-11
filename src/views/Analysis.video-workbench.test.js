import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Analysis.vue', import.meta.url), 'utf8')

test('analysis page promotes video pose playback into the hero evidence stage for video analyses', () => {
  assert.match(source, /import VideoPosePlayback from '@\/components\/VideoPosePlayback\.vue'/)
  assert.match(source, /const currentVideoAnalysis = computed\(\(\) => analysisStore\.currentVideoAnalysis\)/)
  assert.match(source, /class="analysis-page__hero-stage"[\s\S]*<VideoPosePlayback[\s\S]*v-if="currentVideoAnalysis"[\s\S]*variant="hero"[\s\S]*:frames="currentVideoAnalysis\.frames"[\s\S]*:selected-frame-index="analysisStore\.currentVideoFrameIndex"/)
  assert.doesNotMatch(source, /@update:selected-frame-index=/)
  assert.doesNotMatch(source, /<Badge v-if="currentVideoAnalysis && currentVideoFrame" variant="secondary">/)
})

test('analysis page keeps the detailed evidence workbench below the hero for keyframe and angle review', () => {
  assert.match(source, /const selectVideoFrame = \(index: number\) => \{/)
  assert.match(source, /analysisStore\.selectVideoFrame\(index\)/)
  assert.match(source, /<section class="analysis-page__workbench">[\s\S]*<AngleChart :angles="analysisStore\.currentAnalysis!\.angles"/)
  assert.match(source, /class="keyframe-strip filmstrip"/)
  assert.match(source, /v-for="\(frame, index\) in currentVideoAnalysis\.frames"/)
  assert.match(source, /:class="\{ active: index === analysisStore\.currentVideoFrameIndex \}"/)
  assert.match(source, /@click="selectVideoFrame\(index\)"/)
})

test('autoplaying hero playback no longer drags the evidence workbench with it', () => {
  assert.doesNotMatch(source, /@update:selected-frame-index=/)
})

test('video analysis summary stays anchored to the overall video verdict instead of the autoplaying frame analysis', () => {
  assert.match(source, /currentVideoAnalysis\.value\.overallShotType/)
  assert.match(source, /currentVideoAnalysis\.value\.overallShotTypeConfidence/)
  assert.match(source, /currentVideoAnalysis\.value\?\.overallReasons/)
  assert.match(source, /return `当前判断：\$\{getShotTypeName\(currentVideoAnalysis\.value\.overallShotType\)\}`/)
})

