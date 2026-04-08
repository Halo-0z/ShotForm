import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('VideoUpload browser mode keeps a hidden file input fallback and handles selected files', () => {
  assert.match(source, /const browserFileInputRef = ref<HTMLInputElement \| null>\(null\)/)
  assert.match(source, /if \(!hasTauriRuntime\(\)\) \{[\s\S]*browserFileInputRef\.value\?\.click\(\)/)
  assert.match(source, /const handleBrowserVideoChange = \(event: Event\) =>/)
  assert.match(source, /const file = target\.files\?\.\[0\]/)
  assert.match(source, /applySelectedVideoFile\(file\)/)
  assert.match(source, /type="file"[\s\S]*accept="video\/mp4,video\/quicktime,video\/x-msvideo,video\/webm,.mp4,.mov,.avi,.webm,.m4v"[\s\S]*@change="handleBrowserVideoChange"/)
})

test('VideoUpload loaded workspace renders preview video and trim rail controls', () => {
  assert.match(source, /<div v-else :class="uploadWorkspaceClass">/)
  assert.match(source, /<video[\s\S]*ref="videoRef"[\s\S]*:src="previewUrl"[\s\S]*controls/)
  assert.match(source, /<video[\s\S]*ref="timelineCaptureVideoRef"[\s\S]*class="pointer-events-none fixed -left-\[9999px\]/)
  assert.match(source, /class="clip-range-filmstrip" :ref="bindTimelineFilmstrip"/)
  assert.match(source, /class="clip-range-input clip-range-input-start"/)
  assert.match(source, /class="clip-range-input clip-range-input-end"/)
  assert.match(source, /class="clip-range-grip clip-range-grip-start"/)
  assert.match(source, /class="clip-range-grip clip-range-grip-end"/)
})

test('VideoUpload timeline generation handles render waits, timeout protection, and retryable errors', () => {
  assert.match(source, /const waitForVideoEvent = \(video: HTMLVideoElement, eventName: 'loadeddata' \| 'seeked'\) => new Promise<void>/)
  assert.match(source, /reject\(new Error\(`video \$\{eventName\} timed out`\)\)/)
  assert.match(source, /const waitForRenderedVideoFrame = \(video: HTMLVideoElement\) => new Promise<void>/)
  assert.match(source, /if \(typeof video\.requestVideoFrameCallback === 'function'\)/)
  assert.match(source, /await waitForRenderedVideoFrame\(captureVideo\)/)
  assert.match(source, /const message = error instanceof Error \? error\.message : 'timeline frame generation failed'/)
  assert.match(source, /timelineGenerationError\.value = message/)
  assert.match(source, /class="clip-range-error-retry" @click="generateTimelineFrames"/)
})

test('VideoUpload trim interaction keeps fine-grained controls and emits confirmed payload only when valid', () => {
  assert.match(source, /const canConfirmVideoSelection = \(\{[\s\S]*durationMs > 0 && !isBusy/)
  assert.match(source, /step="10"/)
  assert.match(source, /const formatPreciseTime = \(milliseconds: number\) =>/)
  assert.match(source, /emit\('video-loaded', buildVideoLoadedPayload\(\{[\s\S]*trimStartMs:[\s\S]*trimEndMs:[\s\S]*durationMs:/)
})

test('VideoUpload compact mode keeps neutral workbench layout classes and action wiring', () => {
  assert.match(source, /compact\?: boolean/)
  assert.match(source, /compact: false/)
  assert.match(source, /const uploadWorkspaceClass = computed\(\(\) => props\.compact \? 'space-y-3 animate-slide-up' : 'space-y-4 animate-slide-up'\)/)
  assert.match(source, /const actionRowClass = computed\(\(\) => props\.compact \? 'mt-auto flex flex-wrap items-center gap-2 border-t border-\[color-mix\(in_srgb,var\(--surface-border\)_80%,transparent\)\] pt-3'/)
  assert.match(source, /<Button\s+v-if="props\.compact"[\s\S]*@click="toggleClipPreview"/)
  assert.match(source, /<Button :disabled="isBusy \|\| durationMs <= 0" size="lg" @click="confirmVideo">/)
})

test('VideoUpload empty state avoids stale sentinels and keeps upload CTA variant contract', () => {
  assert.match(source, /<Button variant="upload-cta" size="lg" class="min-w-44" :disabled="isBusy" @click="pickVideo">/)
  assert.doesNotMatch(source, /legacy-empty-shell-regression-sentinel/)
})
