import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./UploadWorkbenchPage.vue', import.meta.url), 'utf8')

test('upload workbench keeps rail, mode switch, main surface, and status in one coherent page', () => {
  assert.match(source, /upload-workbench__rail/)
  assert.match(source, /upload-workbench__main/)
  assert.match(source, /upload-workbench__mode-strip/)
  assert.match(source, /upload-workbench__surface/)
  assert.match(source, /upload-workbench__status-rail/)
  assert.match(source, /upload-workbench__action-buttons/)
  assert.match(
    source,
    /<section class="upload-workbench__main(?: upload-workbench__deck)?">[\s\S]*upload-workbench__mode-strip[\s\S]*upload-workbench__surface[\s\S]*upload-workbench__status-rail/
  )
})

test('upload workbench keeps Home and History in a visible but utility-level rail', () => {
  assert.match(source, /<Button variant="ghost" size="sm" @click="goHome">/)
  assert.match(source, /<Button variant="outline" size="sm" @click="goHistory">/)
  assert.doesNotMatch(source, /<Button variant="default" size="sm" @click="goHome">/)
  assert.doesNotMatch(source, /<Button variant="default" size="sm" @click="goHistory">/)
})

test('upload workbench reuses the dedicated image and video upload tools', () => {
  assert.match(source, /ImageUpload/)
  assert.match(source, /VideoUpload/)
  assert.match(source, /uploadMode === 'image'/)
})

test('upload workbench analyzes loaded media and hands off to the analysis route', () => {
  assert.match(source, /analysisStore\.analyzeImage/)
  assert.match(source, /analysisStore\.analyzeVideo/)
  assert.match(source, /navigateWithFogTransition/)
  assert.match(source, /navigateWithFogTransition\(router,\s*'\/analysis'/)
})

test('upload workbench guards Tauri-only analysis when opened in a plain browser runtime', () => {
  assert.match(source, /const hasTauriRuntime = \(\) =>/)
  assert.match(source, /__TAURI_INTERNALS__/)
  assert.match(source, /const browserModeMessage =/)
  assert.match(source, /const isBrowserPreviewMode = computed\(\(\) => !hasTauriRuntime\(\)\)/)
  assert.match(source, /v-if="isBrowserPreviewMode"/)
  assert.match(source, /data-browser-preview-note/)
  assert.match(source, /if \(!hasTauriRuntime\(\)\) \{/)
  assert.match(source, /handoffError\.value = browserModeMessage/)
  assert.match(source, /:desktop-analysis-available="!isBrowserPreviewMode"/)
})

test('upload workbench mode switch gives the selected mode segmented-active semantics', () => {
  assert.match(source, /upload-workbench__mode-strip/)
  assert.match(source, /uploadMode === 'image' \? 'segmented-active' : 'secondary'/)
  assert.match(source, /uploadMode === 'video' \? 'segmented-active' : 'secondary'/)
  assert.doesNotMatch(source, /uploadMode === 'image' \? 'default' : 'secondary'/)
  assert.doesNotMatch(source, /uploadMode === 'video' \? 'default' : 'secondary'/)
})
