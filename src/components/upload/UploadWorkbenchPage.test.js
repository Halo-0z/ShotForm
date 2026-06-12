import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./UploadWorkbenchPage.vue", import.meta.url), "utf8")

test("upload workbench keeps dropzone, preview, trim section, and actions in one coherent page", () => {
    assert.match(source, /upload-workbench__body/)
    assert.match(source, /upload-workbench__dropzone/)
    assert.match(source, /upload-workbench__preview-area/)
    assert.match(source, /upload-workbench__info-panel/)
    assert.match(source, /upload-workbench__trim-section/)
    assert.match(source, /upload-workbench__footer/)
    assert.match(source, /upload-workbench__actions/)
    assert.match(
        source,
        /<section[\s\S]*class="upload-workbench__body"[\s\S]*upload-workbench__dropzone[\s\S]*upload-workbench__preview-area[\s\S]*upload-workbench__trim-section[\s\S]*upload-workbench__footer/,
    )
})

test("upload workbench delegates video trimming to the shared filmstrip component", () => {
    assert.match(source, /import \{ formatTime \} from "@\/lib\/analysis-utils"/)
    assert.match(source, /formatTime\(durationMs\)/)
    assert.match(
        source,
        /import VideoTrimFilmstrip from "@\/components\/VideoUpload\/VideoTrimFilmstrip\.vue"/,
    )
    assert.match(source, /<VideoTrimFilmstrip/)
    assert.match(source, /v-model:trim-start-ms="trimStartMs"/)
    assert.match(source, /v-model:trim-end-ms="trimEndMs"/)
    assert.match(source, /:current-time-ms="currentTimeMs"/)
    assert.match(source, /@preview="togglePlay"/)
    assert.doesNotMatch(source, /timelineFrames/)
    assert.doesNotMatch(source, /upload-workbench__trim-filmstrip/)
    assert.doesNotMatch(source, /upload-workbench__trim-rail/)
})

test("upload workbench analyzes loaded media and hands off to the analysis route", () => {
    assert.match(source, /analysisStore\.analyzeImage/)
    assert.match(source, /analysisStore\.analyzeVideo/)
    assert.match(source, /navigateWithFogTransition/)
    assert.match(source, /navigateWithFogTransition\(router,\s*"\/analysis"/)
})

test("upload workbench guards Tauri-only analysis when opened in a plain browser runtime", () => {
    assert.match(source, /import.*hasTauriRuntime.*from.*@\/lib\/tauri-runtime/)
    assert.match(source, /if \(!hasTauriRuntime\(\)\) \{/)
    assert.match(source, /handoffError\.value = .*分析需在桌面端完成/)
    assert.match(source, /window\.alert\(handoffError\.value\)/)
})

test("upload workbench keeps browser file fallback and mode-aware file handling", () => {
    assert.match(source, /const uploadMode = ref<"image" \| "video">\("video"\)/)
    assert.match(source, /browserFileInputRef/)
    assert.match(source, /handleBrowserFileChange/)
    assert.match(source, /if \(uploadMode\.value === "video"\) \{/)
    assert.match(source, /uploadMode\.value = "image"/)
    assert.match(source, /uploadMode\.value = "video"/)
    assert.match(source, /:accept=/)
    assert.match(source, /uploadMode === "video"/)
})
