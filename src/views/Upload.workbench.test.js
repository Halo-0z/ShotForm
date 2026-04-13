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
  assert.match(source, /<div class="upload-page__content">[\s\S]*<UploadWorkbenchPage \/>/)
  assert.match(
    workbenchSource,
    /<section class="upload-workbench__main(?: upload-workbench__deck)?">[\s\S]*upload-workbench__mode-strip[\s\S]*upload-workbench__surface[\s\S]*upload-workbench__status-rail/
  )
})

test('upload route atmosphere stays quiet so content remains visually dominant', () => {
  assert.doesNotMatch(source, /filter:\s*blur\(/)
  assert.match(source, /\.upload-page__cover\s*\{[\s\S]*opacity:\s*0\.08;/)
  assert.match(source, /\.upload-page__veil\s*\{[\s\S]*opacity:\s*0\.38;/)
  assert.match(source, /\.upload-page__content\s*\{[\s\S]*z-index:\s*1;/)
})

test('upload route reveal remains smooth but not theatrical', () => {
  assert.match(source, /\.upload-page__content\s*\{[\s\S]*transition:[\s\S]*opacity 240ms/)
  assert.match(source, /\.upload-page__content\s*\{[\s\S]*transform:\s*translate3d\(0,\s*6px,\s*0\)/)
  assert.match(source, /\.upload-page--reveal \.upload-page__content\s*\{/)
})

test('upload workbench keeps Home and History actions visible but secondary', () => {
  assert.match(workbenchSource, /<Button variant="ghost" size="sm" @click="goHome">/)
  assert.match(workbenchSource, /<Button variant="outline" size="sm" @click="goHistory">/)
  assert.doesNotMatch(workbenchSource, /variant="default" size="sm" @click="goHome"/)
  assert.doesNotMatch(workbenchSource, /variant="default" size="sm" @click="goHistory"/)
})
