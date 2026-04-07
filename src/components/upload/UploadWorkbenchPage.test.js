import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./UploadWorkbenchPage.vue', import.meta.url), 'utf8')

test('upload workbench exposes a compact utility bar, media switcher, editor surface, and stable action area', () => {
  assert.match(source, /upload-workbench__rail/)
  assert.match(source, /upload-workbench__deck/)
  assert.match(source, /upload-workbench__mode-strip/)
  assert.match(source, /upload-workbench__surface/)
  assert.match(source, /upload-workbench__status-rail/)
  assert.match(source, /upload-workbench__action-buttons/)
})

test('upload workbench does not render homepage feature-card navigation', () => {
  assert.doesNotMatch(source, /涓婁紶绱犳潗/)
  assert.doesNotMatch(source, /鐞冩槦瀵规瘮/)
  assert.doesNotMatch(source, /鐭寤鸿/)
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
  assert.match(source, /if \(!hasTauriRuntime\(\)\) \{/)
  assert.match(source, /handoffError\.value = browserModeMessage/)
})

test('upload workbench mode switch gives the selected mode its own segmented-active button semantics', () => {
  assert.match(source, /upload-workbench__mode-strip/)
  assert.match(source, /uploadMode === 'image' \? 'segmented-active' : 'secondary'/)
  assert.match(source, /uploadMode === 'video' \? 'segmented-active' : 'secondary'/)
  assert.doesNotMatch(source, /uploadMode === 'image' \? 'default' : 'secondary'/)
  assert.doesNotMatch(source, /uploadMode === 'video' \? 'default' : 'secondary'/)
})
