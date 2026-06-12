import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./index.vue", import.meta.url), "utf8")
const filmstripSource = readFileSync(new URL("./VideoTrimFilmstrip.vue", import.meta.url), "utf8")

test("VideoUpload browser mode keeps a hidden file input fallback and handles selected files", () => {
    assert.match(source, /const browserFileInputRef = ref<HTMLInputElement \| null>\(null\)/)
    assert.match(
        source,
        /if \(!hasTauriRuntime\(\)\) \{[\s\S]*browserFileInputRef\.value\?\.click\(\)/,
    )
    assert.match(source, /const handleBrowserVideoChange = \(event: Event\) =>/)
    assert.match(source, /const file = target\.files\?\.\[0\]/)
    assert.match(source, /applySelectedVideoFile\(file\)/)
    assert.match(
        source,
        /type="file"[\s\S]*accept="video\/mp4,video\/quicktime,video\/x-msvideo,video\/webm,.mp4,.mov,.avi,.webm,.m4v"[\s\S]*@change="handleBrowserVideoChange"/,
    )
})

test("VideoUpload loaded workspace renders preview video and trim rail controls", () => {
    assert.match(source, /<div v-else :class="uploadWorkspaceClass">/)
    assert.match(
        source,
        /<video[\s\S]*ref="videoRef"[\s\S]*:src="previewUrl"[\s\S]*@timeupdate="onVideoTimeUpdate"/,
    )
    assert.match(source, /import VideoTrimFilmstrip from "\.\/VideoTrimFilmstrip\.vue"/)
    assert.match(
        source,
        /<VideoTrimFilmstrip[\s\S]*v-model:trim-start-ms="trimStartMs"[\s\S]*v-model:trim-end-ms="trimEndMs"/,
    )
    assert.match(source, /:current-time-ms="currentTimeMs"/)
    assert.match(source, /@preview="toggleClipPreview"/)
    assert.doesNotMatch(source, /class="clip-range-filmstrip"/)
    assert.doesNotMatch(source, /timelineFrames/)
})

test("VideoTrimFilmstrip owns canvas rendering, status feedback, and retryable errors", () => {
    assert.match(filmstripSource, /const waitForVideoEvent = \(/)
    assert.match(filmstripSource, /timed out after \$\{timeoutMs\}ms/)
    assert.match(
        filmstripSource,
        /const filmstripCanvasDpr = typeof window !== "undefined" \? window\.devicePixelRatio \|\| 1 : 1/,
    )
    assert.match(
        filmstripSource,
        /ctx\.setTransform\(filmstripCanvasDpr, 0, 0, filmstripCanvasDpr, 0, 0\)/,
    )
    assert.match(
        filmstripSource,
        /const scale = Math\.min\(frameCellWidth \/ bitmap\.width, railHeight \/ bitmap\.height\)/,
    )
    assert.match(filmstripSource, /class="video-trim-filmstrip__error-retry"/)
    assert.match(filmstripSource, /class="video-trim-filmstrip__playhead"/)
    assert.match(filmstripSource, /片段偏短/)
    assert.match(filmstripSource, /适合分析/)
    assert.match(filmstripSource, /设为起点/)
    assert.doesNotMatch(filmstripSource, /toDataURL/)
    assert.doesNotMatch(filmstripSource, /object-fit:\s*cover/)
})

test("VideoUpload trim interaction keeps fine-grained controls and emits confirmed payload only when valid", () => {
    assert.match(source, /const canConfirmVideoSelection = \(\{[\s\S]*durationMs > 0 && !isBusy/)
    assert.match(filmstripSource, /step="10"/)
    assert.match(source, /const formatPreciseTime = \(milliseconds: number\) =>/)
    assert.match(filmstripSource, /const setTrimStartFromPlayhead = \(\) =>/)
    assert.match(filmstripSource, /const setTrimEndFromPlayhead = \(\) =>/)
    assert.match(
        source,
        /"video-loaded"[\s\S]*buildVideoLoadedPayload\(\{[\s\S]*trimStartMs:[\s\S]*trimEndMs:[\s\S]*durationMs:/,
    )
})

test("VideoUpload compact mode keeps neutral workbench layout classes and action wiring", () => {
    assert.match(source, /compact\?: boolean/)
    assert.match(source, /compact: false/)
    assert.match(
        source,
        /const uploadWorkspaceClass = computed\(\(\) =>[\s\S]*props\.compact \? "space-y-3 animate-slide-up" : "space-y-4 animate-slide-up"/,
    )
    assert.match(
        source,
        /const actionRowClass = computed\(\(\) =>[\s\S]*"mt-auto flex flex-wrap items-center gap-2 border-t border-\[color-mix\(in_srgb,var\(--surface-border\)_80%,transparent\)\] pt-3"/,
    )
    assert.match(source, /:compact="props\.compact"/)
    assert.match(
        source,
        /getVideoAnalysisCtaState\(\{[\s\S]*desktopAnalysisAvailable: props\.desktopAnalysisAvailable/,
    )
    assert.match(source, /data-analysis-cta="video"/)
    assert.match(source, /:disabled="analysisCtaState\.disabled"/)
    assert.match(source, /@click="confirmVideo"/)
})

test("VideoUpload empty state avoids stale sentinels and keeps upload CTA variant contract", () => {
    assert.match(
        source,
        /<Button[\s\S]*variant="upload-cta"[\s\S]*size="lg"[\s\S]*class="min-w-44"[\s\S]*:disabled="isBusy"[\s\S]*@click="pickVideo"/,
    )
    assert.doesNotMatch(source, /legacy-empty-shell-regression-sentinel/)
})
