# Video-Level Star Comparison And Template Editing

## Summary

This spec extends the `2026-04-18-star-comparison-rebuild-design.md` work with two product corrections:

1. `球星对比` must score against the whole analyzed shot sequence when the source is a video, not only the currently selected frame.
2. `球星模板管理` must support safe metadata editing for saved templates without overwriting the stored pose baseline.

The current compare workbench rebuild already fixes progress, terminal states, stale-detail mismatches, and session ownership. It does **not** yet solve the deeper scoring trust issue reported by the user: near-identical Curry videos can still rank Kobe ahead of a saved Curry template because the comparison target is structurally inconsistent.

## Problem Statement

The current template and comparison pipeline has a trust gap:

- saving a template from video currently persists one frame snapshot
- re-uploading a near-identical video may pick a different best frame
- comparison still scores one frame against one frame
- built-in templates and user-saved templates do not always expose the same angle dimensions
- the final ranking can therefore reward partial feature overlap instead of true motion similarity

This is why a saved Curry template can underperform against another player on a nearly identical Curry clip. The system is currently comparing unstable snapshots, not stable shot profiles.

## Goals

- make video-to-template comparison depend on the whole shot profile, not one frame
- keep image-based and legacy template comparison working through backward-compatible fallback
- make built-in templates and user templates comparable through the same canonical feature model
- expose whether a result is `视频级对比` or `单帧回退`
- support editing template metadata in the template management page
- ensure metadata editing never mutates stored pose keypoints or angle features

## Non-Goals

- building a cloud template library
- adding free-form pose editing inside the admin page
- replacing deterministic comparison with LLM scoring
- introducing a full multi-user permission system

## Current Root Cause

### Template Save Path

When saving from the current analysis result, the template page stores:

- `poseData: currentAnalysis.poseData`
- `angles: currentAnalysis.angles`

For video analysis, `currentAnalysis` is only the currently selected frame snapshot.

### Video Analysis Selection

After video analysis completes, the analysis store promotes a single frame into `currentAnalysis`, usually the frame chosen by shot-type confidence rather than by comparison stability.

### Scoring Model

The current comparison path computes weighted similarity from overlapping angle names only. This causes two problems:

- near-identical videos can diverge if the selected frame is a different shot phase
- templates with fewer angles may avoid penalties that richer templates receive

## Product Requirements

### Video-Level Comparison

If the analysis source is a video and the template contains a video profile, ranking must use the video profile as the primary scoring target.

### Canonical Feature Fairness

Comparison must use a canonical angle whitelist and explicit coverage accounting. Missing critical angles must no longer accidentally inflate similarity.

### Backward Compatibility

Legacy image templates and previously saved single-frame templates must still load and compare.

### Safe Template Editing

The template management page may edit:

- `name`
- `team`
- `description`

The template management page must not edit:

- `poseData`
- `angles`
- future video profile payloads

## Recommended Data Model

Keep `PlayerTemplate` backward compatible and add optional profile metadata.

### Frontend Shape

Suggested extension:

- `sourceType?: 'builtin' | 'image' | 'video' | 'legacy'`
- `shotType?: string | null`
- `templateProfile?: TemplateProfile | null`

`TemplateProfile`:

- `version`
- `sourceKind`
- `overallShotType`
- `representativeFrameIndex`
- `representativeTimestampMs`
- `samplesUsed`
- `coverage`
- `phaseProfiles`

`phaseProfiles` is a map keyed by normalized shot phase, for example:

- `setup`
- `coil`
- `release`
- `follow_through`

Each phase profile stores aggregated canonical angles, sample count, and confidence.

### Backend Persistence

Preferred minimal backend change:

- keep existing `pose_data_json`
- keep existing `angles_json`
- add optional `profile_json`

This allows:

- legacy templates to continue using `angles_json`
- video templates to store richer motion profiles
- image templates to stay simple

## Comparison Flow

### 1. Template Creation

#### Image Input

- save current `poseData`
- save current `angles`
- leave `profile_json` empty

#### Video Input

- build a normalized shot profile from the full analyzed frame sequence
- save a representative frame for preview compatibility
- save `angles` for legacy fallback
- save `profile_json` as the canonical video comparison target

### 2. Video Profile Builder

The video profile builder should:

- start from analyzed video frames with pose and angle outputs
- discard unusable frames below confidence thresholds
- classify each retained frame into a normalized shot phase
- aggregate canonical angles within each phase
- record sample counts and coverage
- choose one representative frame for preview display only

### 3. Ranking Logic

When comparing live analysis against templates:

- `video analysis + video template` => use video-level phase-aligned scoring
- `video analysis + legacy/image template` => use representative-frame fallback with explicit downgrade label
- `image analysis + video template` => compare against the template representative phase or representative frame
- `image analysis + image template` => keep current single-frame comparison path

### 4. Phase-Aligned Video Score

Per phase:

- align by normalized phase name
- compute canonical-angle similarity
- compute coverage factor

Overall score:

- weighted average of aligned phase scores
- phase coverage penalty when important phases are missing
- explicit fallback penalty when the comparison had to degrade to representative-frame mode

### 5. Explanation Layer

The compare result should surface:

- whether this result is `视频级对比` or `单帧回退`
- which phases were aligned
- which phases had poor coverage
- the top canonical angle gaps

## Canonical Angle Strategy

Use one shared whitelist for both built-in and user templates.

Initial canonical set should prefer stable, high-signal shooting mechanics, for example:

- `right_elbow_angle`
- `shooting_elbow_angle`
- `release_angle`
- `right_shoulder_angle`
- `shoulder_tilt`
- `trunk_tilt`
- `right_knee_angle`
- `hip_alignment`

Rules:

- built-in templates should be upgraded to this model where possible
- missing angles should count toward coverage, not silently disappear from fairness
- single-frame fallback may still compare overlapping angles, but the UI must disclose fallback mode

## Template Management Editing

This work is intentionally smaller than profile editing.

### Scope

Support editing:

- template name
- team or label
- description

### UX Rules

- enter edit mode per template card
- save and cancel must be explicit
- saving shows success or error feedback
- while editing, clarify that pose and angle data remain unchanged

### Backend Rules

Expose a dedicated metadata update command instead of overloading full template replacement.

Validation:

- `id > 0`
- `name` non-empty
- `team` non-empty
- missing template returns explicit error

## Testing Strategy

### Backend

Add tests for:

- video profile serialization and deserialization
- metadata update preserving pose and angles
- phase-aligned scoring with representative fixtures
- fallback scoring when template profile is absent
- coverage penalties for missing phases

### Frontend

Add tests for:

- template management edit mode renders and saves metadata only
- comparison UI displays `视频级对比` vs `单帧回退`
- same-video-near-duplicate fixtures rank the matching template above unrelated players

### Regression Fixtures

The first mandatory regression fixture is the user-reported Curry case:

- save a Curry template from video A
- compare near-identical video A'
- expected outcome: saved Curry template outranks unrelated players unless data quality is genuinely worse

## Acceptance Criteria

- saving a template from video persists a whole-shot profile, not only a selected frame snapshot
- re-uploading a near-identical video no longer commonly ranks unrelated players ahead of the matching saved template because of frame drift alone
- comparison results clearly indicate when they are video-level vs fallback
- canonical feature fairness reduces bias between built-in and user templates
- template management page supports editing name, team, and description
- editing template metadata never mutates stored pose or angle data

## Rollout

### Phase A

- land template metadata editing
- introduce `profile_json` model and migrations

### Phase B

- build video shot profile extraction and persistence
- add canonical angle whitelist and coverage accounting

### Phase C

- switch compare ranking to prefer video-level profiles
- add result-mode labels and regression fixtures

## Recommendation

Treat the current problem as a data-model correction, not a cosmetic scoring tweak.

If the product promise is `球星对比`, then video input must compare shooting motion over the sequence that defines the motion. Continuing to score only one selected frame will keep producing false nearest matches even after the workbench and progress system are otherwise stable.
