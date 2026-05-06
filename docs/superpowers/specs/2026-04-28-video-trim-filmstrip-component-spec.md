# Video Trim Filmstrip Component Spec

## Goal

Extract the video trim timeline from `src/components/VideoUpload/index.vue` into a dedicated component that renders a clear single-canvas filmstrip and isolates selection visuals from slider interaction.

## Problem

The current trim timeline is embedded inside `VideoUpload/index.vue`. Thumbnail generation, rail sizing, selection styling, range inputs, and error/loading states are coupled in one component. Recent local fixes improved parts of the issue but the rail can still look like a blurred overlay because low-level frame rendering and selection chrome are not isolated.

## Scope

- Create a dedicated route-level upload component for the timeline filmstrip.
- Keep existing `/upload` behavior and parent upload flow unchanged.
- Keep trim start/end values owned by `VideoUpload/index.vue`.
- Move filmstrip frame rendering, rail measurement, loading/error state, and selection rail markup into the new component.
- Preserve the current analysis payload: `trimStartMs`, `trimEndMs`, `durationMs`, `filePath`, `previewUrl`.

## Non-Goals

- Do not rewrite upload routing.
- Do not change video analysis backend behavior.
- Do not add multi-range trimming.
- Do not add a new design system or new dependency.
- Do not reintroduce `HomeWorkspace.vue`.

## Component Contract

Create `src/components/VideoUpload/VideoTrimFilmstrip.vue`.

Props:

- `previewUrl: string`
- `durationMs: number`
- `trimStartMs: number`
- `trimEndMs: number`
- `minClipMs?: number`
- `compact?: boolean`
- `disabled?: boolean`

Emits:

- `update:trimStartMs`, payload `number`
- `update:trimEndMs`, payload `number`

Behavior:

- Parent passes current trim values and receives updates.
- Component clamps start to `0 <= start <= end - minClipMs`.
- Component clamps end to `start + minClipMs <= end <= durationMs`.
- Component clamps both emitted values to the usable media range, including videos shorter than `minClipMs`.
- When disabled, range inputs and retry controls are disabled.
- Component rerenders the filmstrip when `previewUrl`, `durationMs`, rail width, or rail height changes.
- Component cancels stale filmstrip rendering when a new video or new render begins.

## Rendering Requirements

- Use an offscreen `<video>` inside `VideoTrimFilmstrip.vue` only for frame capture.
- Render the filmstrip as one visible `<canvas>`, not a DOM strip of thumbnail `<img>` elements.
- Size the canvas with DPR awareness:
    - visible canvas size follows the measured rail size
    - canvas backing size is `railSize * devicePixelRatio`, capped at `3`
    - draw using `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`
- Draw each sampled frame with contain scaling (`Math.min`) so the 16:9 video frame remains visible instead of being center-cropped into vertical cells.
- Do not use `toDataURL`, per-frame `<img>` nodes, `object-fit: cover`, or fixed vertical thumbnail cells for the filmstrip.
- Do not use `filter: blur`, `backdrop-filter`, or large blurred `box-shadow` on the thumbnail layer.
- The thumbnail layer must never sit under a large translucent selected-window overlay.
- Selection visuals must be separate from interaction controls:
    - render layer: thumbnails and very light inactive-region dimming
    - selection layer: start/end boundary markers
    - input layer: two transparent range inputs
- The selected span should look like a trim range, not a modal/card floating over the image.
- Use matte workbench styling from `DESIGN.md`; avoid glass-on-glass effects.

## Test Requirements

Update or add tests under `src/components/VideoUpload/`.

Required assertions:

- `VideoUpload/index.vue` imports and renders `VideoTrimFilmstrip`.
- `VideoUpload/index.vue` no longer contains timeline frame generation or filmstrip CSS.
- `VideoTrimFilmstrip.vue` uses a DPR-aware visible canvas surface.
- `VideoTrimFilmstrip.vue` does not contain `timelineFrames`, `toDataURL`, thumbnail track classes, or `object-fit: cover`.
- `VideoTrimFilmstrip.vue` draws contained full frames with `Math.min(frameCellWidth / videoW, railHeight / videoH)`.
- `VideoTrimFilmstrip.vue` does not contain `backdrop-filter`, `filter: blur`, or `0 0 16px` filmstrip selection shadow.
- `VideoTrimFilmstrip.vue` exposes `update:trimStartMs` and `update:trimEndMs`.
- `VideoTrimFilmstrip.vue` accepts a `disabled` prop and applies it to range inputs/retry controls.
- Trim update helpers clamp values to avoid `trimEndMs > durationMs` for very short videos.
- Existing `VideoUpload` CTA and payload behavior remain unchanged.

## Acceptance Criteria

- The uploaded video preview still plays and trims normally.
- The timeline filmstrip remains visibly sharp on high-DPI displays.
- The rail shows full landscape frame content instead of repeated center-cropped vertical thumbnails.
- The selected range does not appear as a large blurred/frosted rectangle.
- `VideoUpload/index.vue` is smaller and no longer owns filmstrip internals.
- Targeted `VideoUpload` tests pass.
- `npm run build` passes.

## Escalation Outcome

The initial extracted component still rendered visibly blurred thumbnails because the rail used center-cropped vertical `<img>` cells. The accepted implementation is the escalated single canvas-rendered filmstrip surface described above.
