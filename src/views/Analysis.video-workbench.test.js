import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./Analysis.vue", import.meta.url), "utf8")

test("analysis video visualizer defaults to playing and starts when keyframes are available", () => {
    assert.match(source, /const\s*isPlaying\s*=\s*ref\(true\)/)
    assert.match(source, /const\s*startPlayback\s*=\s*\(\)\s*=>\s*\{[\s\S]*if\s*\(frames\.value\.length\s*<=\s*1\)/)
    assert.match(
        source,
        /watch\(\s*frames,[\s\S]*if\s*\(isPlaying\.value\)\s*\{[\s\S]*startPlayback\(\)/,
    )
    assert.match(
        source,
        /onMounted\(\(\)\s*=>\s*\{[\s\S]*if\s*\(isPlaying\.value\)\s*\{[\s\S]*startPlayback\(\)/,
    )
})

test("analysis video visualizer keeps manual pause and speed controls", () => {
    assert.match(source, /const\s*hasPlayableFrames\s*=\s*computed\(\(\)\s*=>\s*frames\.value\.length\s*>\s*1\)/)
    assert.match(source, /const\s*togglePlayback\s*=\s*\(\)\s*=>\s*\{/)
    assert.match(
        source,
        /<button\s*class="analysis-workbench__video-play-btn"\s*@click="togglePlayback"\s*>/,
    )
    assert.match(source, /<Pause\s*v-if="isPlaying\s*&&\s*hasPlayableFrames"/)
    assert.match(source, /<Play\s*v-else/)
    assert.match(source, /v-for="speed\s*in\s*\[0\.5,\s*1,\s*1\.5\]"/)
    assert.match(source, /@click="playbackSpeed\s*=\s*speed"/)
})

test("analysis timeline selection updates the inspected frame without owning autoplay", () => {
    assert.match(source, /const\s*playbackFrameIndex\s*=\s*ref\(0\)/)
    assert.match(source, /const\s*handleFrameSelect\s*=\s*\(frameIndex:\s*number\)\s*=>\s*\{/)
    assert.match(source, /analysisStore\.selectVideoFrame\(frameIndex\)/)
    assert.match(source, /playbackFrameIndex\.value\s*=\s*clampFrameIndex\(frameIndex\)/)
    assert.match(source, /@click="handleFrameSelect\(idx\)"/)
    assert.match(
        source,
        /playbackFrameIndex\.value\s*=\s*\(playbackFrameIndex\.value\s*\+\s*1\)\s*%\s*frames\.value\.length/,
    )
    assert.doesNotMatch(
        source,
        /const\s*next\s*=\s*\(currentFrameIndex\.value\s*\+\s*1\)\s*%\s*frames\.value\.length/,
    )
    assert.doesNotMatch(source, /@update:selected-frame-index=/)
})

test("analysis video defaults inspection to the best frame while playback advances independently", () => {
    assert.match(
        source,
        /const\s*bestFrameIndex\s*=\s*videoAnalysis\.value\?\.bestFrameIndex\s*\?\?\s*currentFrameIndex\.value/,
    )
    assert.match(source, /playbackFrameIndex\.value\s*=\s*clampFrameIndex\(bestFrameIndex\)/)
    assert.match(source, /最佳帧\s*\{\{\s*\(videoAnalysis\?\.bestFrameIndex\s*\?\?\s*0\)\s*\+\s*1\s*\}\}/)
})
