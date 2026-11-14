import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Upload.vue', import.meta.url), 'utf8')
const workbenchSource = readFileSync(
  new URL('../components/upload/UploadWorkbenchPage.vue', import.meta.url),
  'utf8'
)

test('upload route renders a dedicated workbench page instead of homepage chrome', () => {
  assert.match(source, /UploadWorkbenchPage/)
  assert.doesNotMatch(source, /HomeWorkspace/)
})

test('upload route presents one clear primary task region for the workbench', () => {
  assert.match(source, /<div\s*class="upload-page__content">[\s\S]*<UploadWorkbenchPage\s*\/>/)
  assert.match(workbenchSource, /class="upload-workbench__body"/)
  assert.match(workbenchSource, /VideoTrimFilmstrip/)
  assert.match(workbenchSource, /@click="handleStartAnalysis"/)

})

test('upload route atmosphere stays quiet so content remains visually dominant', () => {
  assert.doesNotMatch(source, /filter:\s*blur\(/)
  assert.match(source, /\.upload-page__cover\s*\{[\s\S]*opacity:\s*0\.08;/)
  assert.match(source, /\.upload-page__veil\s*\{[\s\S]*opacity:\s*0\.38;/)
  assert.match(source, /\.upload-page__content\s*\{[\s\S]*z-index:\s*1;/)
})

test('upload route reveal remains smooth but not theatrical', () => {
  assert.match(source, /\.upload-page__content\s*\{[\s\S]*transition:[\s\S]*opacity\s*240ms/)
  assert.match(source, /\.upload-page__content\s*\{[\s\S]*transform:\s*translate3d\(0,\s*6px,\s*0\)/)
  assert.match(source, /\.upload-page--reveal\s*\.upload-page__content\s*\{/)
})

test('global sidebar supplies Home and History navigation', () => {
  const sidebar = readFileSync(new URL('../components/AppSidebar.vue', import.meta.url), 'utf8')
  assert.match(sidebar, /path: ["']\/["']/)
  assert.match(sidebar, /path: ["']\/history["']/)
})
