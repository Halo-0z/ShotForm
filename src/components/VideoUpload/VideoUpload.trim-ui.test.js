import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('VideoUpload trimming uses a filmstrip rail with a selected clip window and iOS-style handles', () => {
  assert.match(source, /timelineFrames = ref<string\[\]>\(\[\]\)/)
  assert.match(source, /clip-range-thumbnails/)
  assert.match(source, /v-for="\(frame, index\) in timelineFrames"/)
  assert.match(source, /clip-range-mask clip-range-mask-start/)
  assert.match(source, /clip-range-mask clip-range-mask-end/)
  assert.match(source, /clip-range-window/)
  assert.match(source, /clip-range-grip clip-range-grip-start/)
  assert.match(source, /clip-range-grip clip-range-grip-end/)
})

test('VideoUpload falls back to a hidden browser file input when Tauri dialog APIs are unavailable', () => {
  assert.match(source, /const browserFileInputRef = ref<HTMLInputElement \| null>\(null\)/)
  assert.match(source, /const hasTauriRuntime = \(\) =>/)
  assert.match(source, /if \(!hasTauriRuntime\(\)\) \{/)
  assert.match(source, /browserFileInputRef\.value\?\.click\(\)/)
  assert.match(source, /ref="browserFileInputRef"/)
  assert.match(source, /@change="handleBrowserVideoChange"/)
})

test('VideoUpload uses a hidden capture video and exposes thumbnail generation failures instead of silently leaving placeholders', () => {
  assert.match(source, /const timelineCaptureVideoRef = ref<HTMLVideoElement \| null>\(null\)/)
  assert.match(source, /const timelineGenerationError = ref\(''\)/)
  assert.match(source, /const captureVideo = timelineCaptureVideoRef\.value/)
  assert.match(source, /timelineGenerationError\.value = ''/)
  assert.match(source, /const message = error instanceof Error \? error\.message : 'timeline frame generation failed'/)
  assert.match(source, /timelineGenerationError\.value = message/)
  assert.match(source, /ref="timelineCaptureVideoRef"/)
  assert.match(source, /fixed -left-\[9999px\] top-0 h-auto w-\[240px\] max-w-none opacity-0/)
  assert.match(source, /v-else-if="isGeneratingTimelineFrames"/)
  assert.match(source, /v-else-if="timelineGenerationError"/)
})

test('VideoUpload waits for capture video events with a timeout so the placeholder rail cannot hang forever', () => {
  assert.match(source, /const timeoutId = window\.setTimeout\(\(\) => \{/)
  assert.match(source, /reject\(new Error\(`video \$\{eventName\} timed out`\)\)/)
  assert.match(source, /window\.clearTimeout\(timeoutId\)/)
})

test('VideoUpload waits for a decoded frame after load and seek so Tauri does not draw soft intermediate thumbnails', () => {
  assert.match(source, /const waitForRenderedVideoFrame = \(video: HTMLVideoElement\) => new Promise<void>\(\(resolve\) => \{/)
  assert.match(source, /if \(typeof video\.requestVideoFrameCallback === 'function'\)/)
  assert.match(source, /video\.requestVideoFrameCallback\(\(\) => resolve\(\)\)/)
  assert.match(source, /window\.requestAnimationFrame\(\(\) => \{/)
  assert.match(source, /await waitForRenderedVideoFrame\(video\)/)
  assert.match(source, /await waitForRenderedVideoFrame\(captureVideo\)/)
})

test('VideoUpload empty state shell stays neutral and token-driven without legacy sentinel debt', () => {
  assert.match(source, /v-if="!hasVideo"[\s\S]*border border-\[color-mix\(in_srgb,var\(--surface-border\)_82%,transparent\)\][\s\S]*bg-\[linear-gradient\(180deg,color-mix\(in_srgb,var\(--card-bg\)_96%,var\(--background\)\),color-mix\(in_srgb,var\(--bg-solid\)_94%,var\(--surface-color\)\)\)\][\s\S]*shadow-\[0_14px_30px_rgba\(24,29,38,0\.08\),inset_0_1px_0_color-mix\(in_srgb,var\(--border-light\)_56%,transparent\)\]/)
  assert.match(source, /relative grid min-h-\[360px\] place-items-center rounded-\[1\.75rem\] border border-dashed border-\[color-mix\(in_srgb,var\(--surface-border\)_84%,transparent\)\][\s\S]*bg-\[linear-gradient\(180deg,color-mix\(in_srgb,var\(--card-bg\)_94%,var\(--surface-color\)\),color-mix\(in_srgb,var\(--bg-solid\)_92%,var\(--background\)\)\)\][\s\S]*shadow-\[0_10px_24px_rgba\(24,29,38,0\.08\),inset_0_1px_0_color-mix\(in_srgb,var\(--border-light\)_62%,transparent\)\]/)
  assert.doesNotMatch(source, /legacy-empty-shell-regression-sentinel/)
  assert.doesNotMatch(source, /v-if="!hasVideo"[\s\S]*bg-white/)
  assert.doesNotMatch(source, /v-if="!hasVideo"[\s\S]*backdrop-filter:\s*blur/)
})

test('VideoUpload summary, helper note, and clip shell stay matte and token-driven', () => {
  assert.match(source, /const summaryPanelClass = computed\(\(\) => props\.compact \?/)
  assert.match(source, /summaryPanelClass = computed\(\(\) => props\.compact \?[\s\S]*var\(--surface-border\)[\s\S]*var\(--surface-color\)[\s\S]*var\(--bg-solid\)[\s\S]*var\(--border-light\)/)
  assert.match(source, /const helperNoteClass = computed\(\(\) => props\.compact \?/)
  assert.match(source, /helperNoteClass = computed\(\(\) => props\.compact \?[\s\S]*var\(--surface-border\)[\s\S]*var\(--surface-color\)[\s\S]*var\(--bg-solid\)[\s\S]*var\(--border-light\)/)
  assert.match(source, /\.clip-range-shell\s*\{[\s\S]*--clip-range-gutter:[\s\S]*--clip-frame-width:[\s\S]*border:\s*1px solid color-mix\(in srgb, var\(--surface-border\) 80%, transparent\);[\s\S]*background:[\s\S]*var\(--surface-color\) 88%, transparent[\s\S]*var\(--bg-solid\) 94%, transparent[\s\S]*box-shadow:[\s\S]*rgba\(24, 29, 38, 0\.13\)/)
  assert.match(source, /\.clip-range-rail\s*\{[\s\S]*background:\s*color-mix\(in srgb, var\(--bg-solid\) 84%, black\);[\s\S]*box-shadow:[\s\S]*var\(--surface-border\) 70%, transparent/)
  assert.match(source, /\.clip-range-window\s*\{[\s\S]*border-top:\s*1px solid color-mix\(in srgb, var\(--accent-color\) 38%, white\);[\s\S]*border-bottom:\s*1px solid color-mix\(in srgb, var\(--accent-color\) 24%, transparent\);[\s\S]*box-shadow:[\s\S]*var\(--accent-color\) 14%, transparent/)
  assert.match(source, /\.clip-range-grip\s*\{[\s\S]*border:\s*1px solid color-mix\(in srgb, var\(--accent-color\) 36%, white\);[\s\S]*background:[\s\S]*var\(--accent-color\)/)
  assert.match(source, /\.clip-range-error-retry\s*\{[\s\S]*border:\s*1px solid color-mix\(in srgb, var\(--accent-color\) 26%, transparent\);[\s\S]*background:\s*color-mix\(in srgb, var\(--accent-color\) 10%, transparent\)/)
  assert.doesNotMatch(source, /summaryPanelClass = computed[\s\S]*bg-white/)
  assert.doesNotMatch(source, /helperNoteClass = computed[\s\S]*bg-white/)
})

test('VideoUpload trimming gives start and end handles separate interactive hit regions', () => {
  assert.match(source, /const trimMidpointPercent = computed\(\(\) => \(trimStartPercent\.value \+ trimEndPercent\.value\) \/ 2\)/)
  assert.match(source, /const clipStartInputStyle = computed\(\(\) => \(\{/)
  assert.match(source, /const clipEndInputStyle = computed\(\(\) => \(\{/)
  assert.match(source, /class="clip-range-input clip-range-input-start"[\s\S]*:style="clipStartInputStyle"/)
  assert.match(source, /class="clip-range-input clip-range-input-end"[\s\S]*:style="clipEndInputStyle"/)
})

test('VideoUpload trim rail keeps a padded stage and dims inactive areas without blurring thumbnails', () => {
  assert.match(source, /clip-range-stage/)
  assert.match(source, /clip-range-filmstrip/)
  assert.match(source, /--clip-range-gutter:/)
  assert.match(source, /--clip-frame-width:/)
  assert.match(source, /grid-auto-columns: var\(--clip-frame-width\);/)
  assert.doesNotMatch(source, /grid-auto-columns: minmax\(3\.6rem, 1fr\);/)
  assert.doesNotMatch(source, /backdrop-filter:\s*blur/)
  assert.doesNotMatch(source, /\.clip-range-thumbnails-loading \{\s*opacity:\s*0\.82;/)
  assert.doesNotMatch(source, /\.clip-range-filmstrip \{[\s\S]*linear-gradient\(180deg, rgba\(255, 255, 255, 0\.03\), rgba\(255, 255, 255, 0\.01\)\)/)
  assert.doesNotMatch(source, /\.clip-range-frame \{[\s\S]*linear-gradient\(180deg, rgba\(255, 255, 255, 0\.04\), rgba\(255, 255, 255, 0\.01\)\)/)
})

test('VideoUpload filmstrip generates denser thumbnails using the rendered rail width and crops each frame to a focused filmstrip window', () => {
  assert.match(source, /const timelineFilmstripRef = ref<HTMLElement \| null>\(null\)/)
  assert.match(source, /const timelineRailWidth = ref\(0\)/)
  assert.match(source, /const targetTimelineFrameWidth = 36/)
  assert.match(source, /const targetTimelineFrameHeight = 68/)
  assert.match(source, /const captureCount = Math\.min\(48, Math\.max\(18, Math\.ceil\(timelineRailWidth\.value \/ targetTimelineFrameWidth\) \+ 4\)\)/)
  assert.match(source, /const renderScale = Math\.max\(2, typeof window !== 'undefined' \? window\.devicePixelRatio \|\| 1 : 1\)/)
  assert.match(source, /const timelineAspectRatio = canvas\.width \/ canvas\.height/)
  assert.match(source, /const videoAspectRatio = videoWidth \/ videoHeight/)
  assert.match(source, /let sourceWidth = videoWidth/)
  assert.match(source, /let sourceHeight = videoHeight/)
  assert.match(source, /let sourceX = 0/)
  assert.match(source, /let sourceY = 0/)
  assert.match(source, /if \(videoAspectRatio > timelineAspectRatio\)/)
  assert.match(source, /sourceWidth = videoHeight \* timelineAspectRatio/)
  assert.match(source, /sourceX = \(videoWidth - sourceWidth\) \/ 2/)
  assert.match(source, /sourceHeight = videoWidth \/ timelineAspectRatio/)
  assert.match(source, /sourceY = \(videoHeight - sourceHeight\) \/ 2/)
  assert.match(source, /context\.fillRect\(0, 0, canvas\.width, canvas\.height\)/)
  assert.match(source, /context\.drawImage\(captureVideo, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas\.width, canvas\.height\)/)
  assert.match(source, /canvas\.toDataURL\('image\/png'\)/)
})

test('VideoUpload trim controls support 10ms adjustments and centisecond readouts', () => {
  assert.match(source, /const formatPreciseTime = \(milliseconds: number\) =>/)
  assert.match(source, /step="10"/)
  assert.match(source, /\{\{ formatPreciseTime\(trimStartMs\) \}\} - \{\{ formatPreciseTime\(trimEndMs\) \}\}/)
  assert.match(source, /\{\{ formatPreciseTime\(clipDurationMs\) \}\}/)
  assert.match(source, /centiseconds/)
})

test('VideoUpload exposes a compact workspace variant that tightens the loaded editor layout', () => {
  assert.match(source, /compact\?: boolean/)
  assert.match(source, /compact: false/)
  assert.match(source, /const uploadWorkspaceClass = computed\(\(\) => props\.compact \? 'space-y-3 animate-slide-up' : 'space-y-4 animate-slide-up'/)
  assert.match(source, /const cardContentClass = computed\(\(\) => props\.compact \? 'space-y-4 p-4' : 'space-y-5 p-5'/)
  assert.match(source, /const workspaceGridClass = computed\(\(\) => props\.compact \? 'grid gap-4 xl:grid-cols-\[minmax\(320px,480px\)_1fr\]' : 'grid gap-5 xl:grid-cols-\[minmax\(360px,520px\)_1fr\]'/)
  assert.match(source, /const detailColumnClass = computed\(\(\) => props\.compact \? 'flex min-h-full flex-col gap-3' : 'space-y-4'/)
  assert.match(source, /const videoPreviewClass = computed\(\(\) => props\.compact \? 'aspect-\[16\/8\.1\] max-h-\[320px\] w-full bg-black object-contain' : 'aspect-video w-full bg-black object-contain'/)
})

test('VideoUpload compact mode removes redundant reading panels and pulls preview into the primary action rail', () => {
  assert.match(source, /const compactHelperText = computed\(\(\) => props\.compact\s*\?/)
  assert.match(source, /const actionRowClass = computed\(\(\) => props\.compact \? 'mt-auto flex flex-wrap items-center gap-2 border-t border-\[[^\]]*surface-border[^\]]*\] pt-3'/)
  assert.match(source, /<template v-if="!props\.compact">/)
  assert.match(source, /text-xs leading-5 text-\[var\(--text-muted\)\]/)
})

test('VideoUpload empty state promotes the picker with a dedicated upload-cta button variant instead of the shared default button', () => {
  assert.match(source, /<Button variant="upload-cta" size="lg" class="min-w-44" :disabled="isBusy" @click="pickVideo">/)
  assert.doesNotMatch(source, /<Button size="lg" class="min-w-44" :disabled="isBusy" @click="pickVideo">/)
})
