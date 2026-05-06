# Video Trim Filmstrip Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the video trim timeline into a dedicated component with a crisp DPR-aware single-canvas filmstrip and separated render/selection/input layers.

**Architecture:** `VideoUpload/index.vue` keeps upload, preview, analysis CTA, and trim state ownership. `VideoTrimFilmstrip.vue` owns offscreen capture, canvas filmstrip rendering, rail layout, range interaction, loading/error UI, and emits trim updates back to the parent.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, existing Node `node:test` source assertions, current CSS variables from `DESIGN.md`.

---

## File Structure

- Create `src/components/VideoUpload/VideoTrimFilmstrip.vue`
    - Owns canvas filmstrip rendering and trim rail UI.
    - Props: `previewUrl`, `durationMs`, `trimStartMs`, `trimEndMs`, `minClipMs`, `compact`, `disabled`.
    - Emits: `update:trimStartMs`, `update:trimEndMs`.
- Modify `src/components/VideoUpload/index.vue`
    - Remove timeline generation refs/computed/watch/CSS.
    - Render `VideoTrimFilmstrip` in the existing trim panel.
    - Keep summary text, preview controls, CTA, and emitted analysis payload unchanged.
- Modify `src/components/VideoUpload/VideoUpload.trim-ui.test.js`
    - Assert parent renders the new component and no longer owns filmstrip internals.
    - Assert the new component owns the DPR canvas surface, no cropped thumbnail image strip, no blur filter, no large selection shadow.
- Modify `src/components/VideoUpload/VideoUpload.theming.test.js`
    - Keep existing neutral material assertions stable if extraction changes source scan boundaries.

## Task 1: Add Component Contract Tests

**Files:**

- Modify: `src/components/VideoUpload/VideoUpload.trim-ui.test.js`

- [ ] **Step 1: Write failing parent extraction assertions**

Add assertions that `VideoUpload/index.vue` imports and renders `VideoTrimFilmstrip`, and no longer contains `generateTimelineFrames`, `timelineFrames`, or `.clip-range-filmstrip`.

- [ ] **Step 2: Write failing component ownership assertions**

Read `VideoTrimFilmstrip.vue` in the test and assert:

```js
assert.match(
    filmstripSource,
    /defineProps<\{[\s\S]*previewUrl: string[\s\S]*durationMs: number[\s\S]*trimStartMs: number[\s\S]*trimEndMs: number/,
)
assert.match(filmstripSource, /defineEmits<\{[\s\S]*update:trimStartMs[\s\S]*update:trimEndMs/)
assert.match(filmstripSource, /disabled\?: boolean/)
assert.match(filmstripSource, /:disabled="disabled"/)
assert.match(filmstripSource, /ref="filmstripCanvasRef"/)
assert.match(filmstripSource, /canvas\.width = Math\.round\(railWidth \* filmstripCanvasDpr\)/)
assert.match(
    filmstripSource,
    /ctx\.setTransform\(filmstripCanvasDpr, 0, 0, filmstripCanvasDpr, 0, 0\)/,
)
assert.match(
    filmstripSource,
    /const scale = Math\.min\(frameCellWidth \/ videoW, railHeight \/ videoH\)/,
)
assert.doesNotMatch(
    filmstripSource,
    /timelineFrames|toDataURL|video-trim-filmstrip__thumbnail-track|video-trim-filmstrip__frame-image/,
)
assert.doesNotMatch(filmstripSource, /backdrop-filter|filter:\s*blur|0 0 16px/)
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
node --test src/components/VideoUpload/VideoUpload.trim-ui.test.js
```

Expected: FAIL because `VideoTrimFilmstrip.vue` does not exist and parent does not import/render it.

## Task 2: Create `VideoTrimFilmstrip.vue`

**Files:**

- Create: `src/components/VideoUpload/VideoTrimFilmstrip.vue`

- [ ] **Step 1: Move render logic**

Move the hidden capture video, rail size observer, loading/error state, `waitForVideoEvent`, `seekVideoWithRetry`, and DPR canvas rendering into the new component. Render one visible canvas and draw sampled video frames into rail cells.

- [ ] **Step 2: Implement component props/emits**

Clamp and emit updates:

```ts
const emitTrimStart = (nextValue: number) => {
    emit(
        "update:trimStartMs",
        Math.min(nextValue, Math.max(0, props.trimEndMs - effectiveMinClipMs.value)),
    )
}

const emitTrimEnd = (nextValue: number) => {
    emit(
        "update:trimEndMs",
        Math.min(
            Math.max(nextValue, props.trimStartMs + effectiveMinClipMs.value),
            sliderMaxMs.value,
        ),
    )
}
```

Clamp to the real media range as well as the UI range. Very short videos must not emit `trimEndMs > durationMs`.

- [ ] **Step 3: Keep render layers separated**

Use stable layer names:

- `.video-trim-filmstrip__rail`
- `.video-trim-filmstrip__frames`
- `.video-trim-filmstrip__canvas`
- `.video-trim-filmstrip__selection-layer`
- `.video-trim-filmstrip__input`

Do not use DOM thumbnail images, `object-fit: cover`, `backdrop-filter`, `filter: blur`, or large blurred selection shadows.

- [ ] **Step 4: Run component contract test**

Run:

```bash
node --test src/components/VideoUpload/VideoUpload.trim-ui.test.js
```

Expected: Parent assertions may still fail until Task 3, but component ownership assertions should pass.

## Task 3: Wire Parent To Component

**Files:**

- Modify: `src/components/VideoUpload/index.vue`

- [ ] **Step 1: Import component**

Add:

```ts
import VideoTrimFilmstrip from "@/components/VideoUpload/VideoTrimFilmstrip.vue"
```

- [ ] **Step 2: Remove parent-owned timeline internals**

Remove:

- `timelineCaptureVideoRef`
- `timelineFilmstripRef`
- `timelineFrames`
- `isGeneratingTimelineFrames`
- `timelineGenerationError`
- `timelineRailWidth`
- `timelineGenerationId`
- `timelineResizeObserver`
- filmstrip style computed values
- timeline generation watchers
- filmstrip CSS block

- [ ] **Step 3: Render component in trim shell**

Use:

```vue
<VideoTrimFilmstrip
    v-model:trim-start-ms="trimStartMs"
    v-model:trim-end-ms="trimEndMs"
    :preview-url="previewUrl"
    :duration-ms="durationMs"
    :min-clip-ms="minClipMs"
    :compact="props.compact"
    :disabled="isBusy"
/>
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
node --test src/components/VideoUpload/VideoUpload.trim-ui.test.js src/components/VideoUpload/VideoUpload.theming.test.js
```

Expected: PASS.

## Task 4: Verify Integration

**Files:**

- No required edits unless tests reveal a regression.

- [ ] **Step 1: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 2: Start dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Expected: `/upload` loads and the video trim rail is usable.

- [ ] **Step 3: Manual visual check**

Upload a short video and inspect:

- thumbnails are sharper than the current screenshot
- no large floating frosted rectangle covers the filmstrip
- drag handles still update start/end labels
- preview segment still loops within selected range
