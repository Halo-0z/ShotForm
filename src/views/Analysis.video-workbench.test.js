import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("./Analysis.vue", import.meta.url), "utf8")

test("analysis video visualizer defaults to playing and starts when keyframes are available", () => {
    assert.match(source, /const isPlaying = ref\(true\)/)
    assert.match(source, /const startPlayback = \(\) => \{[\s\S]*if \(frames\.value\.length <= 1\)/)
    assert.match(
        source,
        /watch\(\s*frames,[\s\S]*if \(isPlaying\.value\) \{[\s\S]*startPlayback\(\)/,
    )
    assert.match(
        source,
        /onMounted\(\(\) => \{[\s\S]*if \(isPlaying\.value\) \{[\s\S]*startPlayback\(\)/,
    )
})

test("analysis video visualizer keeps manual pause and speed controls", () => {
    assert.match(source, /const hasPlayableFrames = computed\(\(\) => frames\.value\.length > 1\)/)
    assert.match(source, /const togglePlayback = \(\) => \{/)
    assert.match(
        source,
        /<button class="analysis-workbench__video-play-btn" @click="togglePlayback">/,
    )
    assert.match(source, /<Pause v-if="isPlaying && hasPlayableFrames"/)
    assert.match(source, /<Play v-else/)
    assert.match(source, /v-for="speed in \[0\.5, 1, 1\.5\]"/)
    assert.match(source, /@click="playbackSpeed = speed"/)
})

test("analysis timeline selection updates the inspected frame without owning autoplay", () => {
    assert.match(source, /const playbackFrameIndex = ref\(0\)/)
    assert.match(source, /const handleFrameSelect = \(frameIndex: number\) => \{/)
    assert.match(source, /analysisStore\.selectVideoFrame\(frameIndex\)/)
    assert.match(source, /playbackFrameIndex\.value = clampFrameIndex\(frameIndex\)/)
    assert.match(source, /@click="handleFrameSelect\(idx\)"/)
    assert.match(
        source,
        /playbackFrameIndex\.value = \(playbackFrameIndex\.value \+ 1\) % frames\.value\.length/,
    )
    assert.doesNotMatch(
        source,
        /const next = \(currentFrameIndex\.value \+ 1\) % frames\.value\.length/,
    )
    assert.doesNotMatch(source, /@update:selected-frame-index=/)
})

test("analysis video defaults inspection to the best frame while playback advances independently", () => {
    assert.match(
        source,
        /const bestFrameIndex = videoAnalysis\.value\?\.bestFrameIndex \?\? currentFrameIndex\.value/,
    )
    assert.match(source, /playbackFrameIndex\.value = clampFrameIndex\(bestFrameIndex\)/)
    assert.match(source, /最佳帧 \{\{ \(videoAnalysis\?\.bestFrameIndex \?\? 0\) \+ 1 \}\}/)
})
