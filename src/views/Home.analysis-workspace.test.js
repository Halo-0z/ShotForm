import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve('D:/智能投篮分析/.worktrees/cinematic-home-ui/src/components/home/HomeWorkspace.vue'),
  'utf8'
)

test('video workspace preview card uses a dark workbench surface', () => {
  const secondaryBlock = source.match(/\.image-card\.secondary \{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusBlock = source.match(/\.image-container\.focus \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(secondaryBlock, /rgba\(30, 28, 48, 0\.94\)/)
  assert.match(secondaryBlock, /rgba\(18, 16, 33, 0\.92\)/)
  assert.doesNotMatch(secondaryBlock, /rgba\(255, 255, 255, 0\.98\)/)
  assert.match(focusBlock, /min-height: clamp\(320px, 42vh, 430px\)/)
})

test('keyframe cards use dark active styling instead of a bright white selection state', () => {
  const activeBlock = source.match(/\.keyframe-card\.active \{[\s\S]*?\n\}/)?.[0] ?? ''
  const hoverBlock = source.match(/\.keyframe-card:hover \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(activeBlock, /background: linear-gradient\(180deg, rgba\(37, 33, 61, 0\.96\), rgba\(25, 22, 43, 0\.94\)\)/)
  assert.match(activeBlock, /0 0 0 1px rgba\(129, 140, 248, 0\.18\)/)
  assert.doesNotMatch(activeBlock, /rgba\(255, 255, 255, 0\.96\)/)
  assert.match(hoverBlock, /background: color-mix\(in srgb, var\(--glass-sm\) 92%, transparent\)/)
})

test('upload workspace keeps stronger bottom breathing room when the focused uploader enters view', () => {
  const homePageBlock = source.match(/\.home-page \{[\s\S]*?\n\}/)?.[0] ?? ''
  const activeUploadBlock = source.match(/\.upload-section\.active-upload \{[\s\S]*?\n\}/)?.[0] ?? ''
  const uploadStageBlock = source.match(/\.upload-stage \{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedShellBlock = source.match(/\.upload-stage\.focused::after \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(homePageBlock, /padding: 24px 24px clamp\(56px, 8vh, 96px\)/)
  assert.match(activeUploadBlock, /clamp\(72px, 10vh, 132px\)/)
  assert.match(uploadStageBlock, /min-height: min\(680px, calc\(100vh - 176px\)\)/)
  assert.match(uploadStageBlock, /padding: clamp\(16px, 2\.2vh, 24px\) 16px clamp\(52px, 7vh, 96px\)/)
  assert.match(focusedShellBlock, /inset: 56px 2% clamp\(36px, 7vh, 88px\)/)
})

test('focused upload workspace compresses the top chrome so video actions stay above the fold', () => {
  const focusedHeaderBlock = source.match(/\.home-page\.focused-workspace \.home-header\.compact \{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedNavBlock = source.match(/\.home-page\.focused-workspace \.module-nav\.compact \{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedStageBlock = source.match(/\.home-page\.focused-workspace \.upload-stage\.focused \{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedSwitchBlock = source.match(/\.home-page\.focused-workspace \.upload-switch-wrap \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(source, /'focused-workspace': showUpload/)
  assert.match(focusedHeaderBlock, /gap: 4px/)
  assert.match(focusedHeaderBlock, /margin-bottom: 10px/)
  assert.match(focusedNavBlock, /margin-bottom: 16px/)
  assert.match(focusedStageBlock, /min-height: min\(612px, calc\(100vh - 252px\)\)/)
  assert.match(focusedStageBlock, /padding: 8px 14px clamp\(24px, 4vh, 48px\)/)
  assert.match(focusedSwitchBlock, /margin: 0 auto 16px/)
})

test('loaded upload workspace hides the landing chrome entirely so the primary editor and actions own the first viewport', () => {
  const loadedHeaderBlock = source.match(/\.home-page\.loaded-upload-workspace \.home-header \{[\s\S]*?\n\}/)?.[0] ?? ''
  const loadedNavBlock = source.match(/\.home-page\.loaded-upload-workspace \.module-nav \{[\s\S]*?\n\}/)?.[0] ?? ''
  const loadedStageBlock = source.match(/\.home-page\.loaded-upload-workspace \.upload-stage\.focused \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(source, /'loaded-upload-workspace': showUpload && activeModule === 'upload'/)
  assert.match(loadedHeaderBlock, /display: none/)
  assert.match(loadedNavBlock, /display: none/)
  assert.match(loadedStageBlock, /min-height: min\(640px, calc\(100vh - 112px\)\)/)
  assert.match(loadedStageBlock, /padding: 0 12px clamp\(20px, 3vh, 40px\)/)
})

test('home workspace wraps the heading and module entry area in a Jordan echo hero shell', () => {
  assert.match(source, /import HomeWorkspaceHeroArt from '@\/components\/home\/HomeWorkspaceHeroArt\.vue'/)
  assert.match(source, /class="analysis-hero-shell"/)
  assert.match(source, /class="analysis-hero-copy"/)
  assert.match(source, /<HomeWorkspaceHeroArt[\s\S]*:compact="isAnalysisWorkspace"[\s\S]*:focused="showUpload"/)
})

test('loaded upload workspace hides the hero shell with the rest of the landing chrome', () => {
  const loadedHeroBlock = source.match(/\.home-page\.loaded-upload-workspace \.analysis-hero-shell \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(loadedHeroBlock, /display: none/)
})

test('focused upload mode keeps the hero visible but compresses its spacing', () => {
  const focusedHeroBlock = source.match(/\.home-page\.focused-workspace \.analysis-hero-shell \{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(focusedHeroBlock, /padding:/)
  assert.match(focusedHeroBlock, /min-height:/)
})

test('home workspace emits module-level snap suppression so the outer hero does not yank compare and suggestion views', () => {
  assert.match(source, /scrollSnapSuppressedChange: \[suppressed: boolean\]/)
  assert.match(source, /const shouldSuppressScrollSnap = computed\(\(\) => activeModule\.value !== 'upload'\)/)
  assert.match(source, /watch\(\s*shouldSuppressScrollSnap,\s*suppressed => \{\s*emit\('scrollSnapSuppressedChange', suppressed\)/)
  assert.match(source, /\{\s*immediate: true\s*\}/)
})
