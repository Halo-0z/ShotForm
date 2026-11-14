import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve('src/components/home/HomeWorkspace.vue'),
  'utf8'
)

test('video workspace preview card uses a dark workbench surface', () => {
  const secondaryBlock = source.match(/\.image-card\.secondary\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusBlock = source.match(/\.image-container\.focus\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(secondaryBlock, /rgba\(30,\s*28,\s*48,\s*0\.94\)/)
  assert.match(secondaryBlock, /rgba\(18,\s*16,\s*33,\s*0\.92\)/)
  assert.doesNotMatch(secondaryBlock, /rgba\(255,\s*255,\s*255,\s*0\.98\)/)
  assert.match(focusBlock, /min-height:\s*clamp\(320px,\s*42vh,\s*430px\)/)
})

test('keyframe cards use dark active styling instead of a bright white selection state', () => {
  const activeBlock = source.match(/\.keyframe-card\.active\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const hoverBlock = source.match(/\.keyframe-card:hover\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(activeBlock, /background:\s*linear-gradient\(180deg,\s*rgba\(37,\s*33,\s*61,\s*0\.96\),\s*rgba\(25,\s*22,\s*43,\s*0\.94\)\)/)
  assert.match(activeBlock, /0\s*0\s*0\s*1px\s*rgba\(129,\s*140,\s*248,\s*0\.18\)/)
  assert.doesNotMatch(activeBlock, /rgba\(255,\s*255,\s*255,\s*0\.96\)/)
  assert.match(hoverBlock, /background:\s*color-mix\(in\s*srgb,\s*var\(--glass-sm\)\s*92%,\s*transparent\)/)
})

test('upload workspace keeps stronger bottom breathing room when the focused uploader enters view', () => {
  const homePageBlock = source.match(/\.home-page\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const activeUploadBlock = source.match(/\.upload-section\.active-upload\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const uploadStageBlock = source.match(/\.upload-stage\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedShellBlock = source.match(/\.upload-stage\.focused::after\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(homePageBlock, /padding:\s*24px\s*24px\s*clamp\(56px,\s*8vh,\s*96px\)/)
  assert.match(activeUploadBlock, /clamp\(72px,\s*10vh,\s*132px\)/)
  assert.match(uploadStageBlock, /min-height:\s*min\(680px,\s*calc\(100vh\s*-\s*176px\)\)/)
  assert.match(uploadStageBlock, /padding:\s*clamp\(16px,\s*2\.2vh,\s*24px\)\s*16px\s*clamp\(52px,\s*7vh,\s*96px\)/)
  assert.match(focusedShellBlock, /inset:\s*56px\s*2%\s*clamp\(36px,\s*7vh,\s*88px\)/)
})

test('focused upload workspace compresses the top chrome so video actions stay above the fold', () => {
  const focusedHeaderBlock = source.match(/\.home-page\.focused-workspace\s*\.home-header\.compact\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedNavBlock = source.match(/\.home-page\.focused-workspace\s*\.module-nav\.compact\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedStageBlock = source.match(/\.home-page\.focused-workspace\s*\.upload-stage\.focused\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const focusedSwitchBlock = source.match(/\.home-page\.focused-workspace\s*\.upload-switch-wrap\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(source, /['"]focused-workspace['"]:\s*showUpload/)
  assert.match(focusedHeaderBlock, /gap:\s*4px/)
  assert.match(focusedHeaderBlock, /margin-bottom:\s*10px/)
  assert.match(focusedNavBlock, /margin-bottom:\s*16px/)
  assert.match(focusedStageBlock, /min-height:\s*min\(612px,\s*calc\(100vh\s*-\s*252px\)\)/)
  assert.match(focusedStageBlock, /padding:\s*8px\s*14px\s*clamp\(24px,\s*4vh,\s*48px\)/)
  assert.match(focusedSwitchBlock, /margin:\s*0\s*auto\s*16px/)
})

test('loaded upload workspace hides the landing chrome entirely so the primary editor and actions own the first viewport', () => {
  const loadedHeaderBlock = source.match(/\.home-page\.loaded-upload-workspace\s*\.home-header\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const loadedNavBlock = source.match(/\.home-page\.loaded-upload-workspace\s*\.module-nav\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  const loadedStageBlock = source.match(/\.home-page\.loaded-upload-workspace\s*\.upload-stage\.focused\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(source, /['"]loaded-upload-workspace['"]:\s*showUpload\s*&&\s*activeModule\s*===\s*['"]upload['"]/)
  assert.match(loadedHeaderBlock, /display:\s*none/)
  assert.match(loadedNavBlock, /display:\s*none/)
  assert.match(loadedStageBlock, /min-height:\s*min\(640px,\s*calc\(100vh\s*-\s*112px\)\)/)
  assert.match(loadedStageBlock, /padding:\s*0\s*12px\s*clamp\(20px,\s*3vh,\s*40px\)/)
})

test('home workspace wraps the heading and module entry area in a Jordan echo hero shell', () => {
  assert.match(source, /import\s*HomeWorkspaceHeroArt\s*from\s*['"]@\/components\/home\/HomeWorkspaceHeroArt\.vue['"]/)
  assert.match(source, /class="analysis-hero-shell"/)
  assert.match(source, /class="analysis-hero-copy"/)
  assert.match(source, /<HomeWorkspaceHeroArt[\s\S]*:compact="isAnalysisWorkspace"[\s\S]*:focused="showUpload"/)
})

test('loaded upload workspace hides the hero shell with the rest of the landing chrome', () => {
  const loadedHeroBlock = source.match(/\.home-page\.loaded-upload-workspace\s*\.analysis-hero-shell\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(loadedHeroBlock, /display:\s*none/)
})

test('focused upload mode keeps the hero visible but compresses its spacing', () => {
  const focusedHeroBlock = source.match(/\.home-page\.focused-workspace\s*\.analysis-hero-shell\s*\{[\s\S]*?\n\}/)?.[0] ?? ''

  assert.match(focusedHeroBlock, /padding:/)
  assert.match(focusedHeroBlock, /min-height:/)
})

test('home workspace emits module-level snap suppression so the outer hero does not yank compare and suggestion views', () => {
  assert.match(source, /scrollSnapSuppressedChange:\s*\[suppressed:\s*boolean\]/)
  assert.match(source, /const\s*shouldSuppressScrollSnap\s*=\s*computed\(\(\)\s*=>\s*activeModule\.value\s*!==\s*['"]upload['"]\)/)
  assert.match(source, /watch\(\s*shouldSuppressScrollSnap,\s*\(?suppressed\)?\s*=>\s*\{\s*emit\(['"]scrollSnapSuppressedChange['"],\s*suppressed\)/)
  assert.match(source, /\{\s*immediate:\s*true\s*\}/)
})
