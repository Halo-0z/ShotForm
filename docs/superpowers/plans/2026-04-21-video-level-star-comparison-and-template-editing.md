# Video-Level Star Comparison And Template Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make star comparison trustworthy for video inputs by comparing whole-shot profiles, while keeping template metadata editing safe and backward compatible.

**Architecture:** Add an optional video template profile beside the existing single-frame template data, then update save and compare flows to prefer phase-aligned video scoring when both sides have profiles. Keep legacy `poseData` and `angles` as fallback so old templates and image analysis continue to work.

**Tech Stack:** Vue 3, Pinia, Tauri v2 commands, Rust, SQLx SQLite, Node test runner, Cargo tests, Vite build.

---

## File Map

- Modify `src-tauri/src/models/types.rs`: add serializable template profile types and optional profile field on `PlayerTemplate`.
- Modify `src-tauri/src/database/models.rs`: map optional `profile_json` column.
- Modify `src-tauri/src/database/repository.rs`: migrate `profile_json`, save/load/update profile data, preserve metadata-only update behavior.
- Modify `src-tauri/src/analysis/comparison.rs`: add canonical angle coverage helpers and video-profile-aware scoring.
- Modify `src-tauri/src/commands/analysis.rs`: build live video profiles from analyzed frames and pass them into compare workbench.
- Modify `src-tauri/src/commands/database.rs`: accept optional profile when saving templates.
- Modify `src/types/index.ts`: mirror profile types in frontend.
- Modify `src/stores/analysis.ts`: retain current video analysis profile context for template saving and comparison identity.
- Modify `src/views/Templates.vue`: when current source is video, save template with a video profile; keep metadata editing unchanged.
- Modify `src/components/ComparisonView/ComparisonRankingList.vue` and `src/components/ComparisonView/ComparisonDetailPane.vue`: display comparison mode labels.
- Add or modify tests in `src-tauri/src/analysis/comparison.rs`, `src-tauri/src/database/repository.rs`, `src/views/Templates.management.test.js`, and comparison browser/runtime tests.

## Task 1: Persist Optional Template Profiles

**Files:**
- Modify: `src-tauri/src/models/types.rs`
- Modify: `src-tauri/src/database/models.rs`
- Modify: `src-tauri/src/database/repository.rs`
- Test: `src-tauri/src/database/repository.rs`

- [ ] **Step 1: Write failing repository test for profile persistence**

Add a Rust test that creates a `PlayerTemplate` with a non-empty `template_profile`, saves it, reloads templates, and asserts the profile survives round-trip.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml saves_and_restores_player_template_profile
```

Expected: fail because `template_profile` and `profile_json` do not exist yet.

- [ ] **Step 3: Add model types**

Add minimal structs:

- `PlayerTemplateProfile`
- `PhaseAngleProfile`
- `CanonicalAngleProfile`
- `ComparisonMode`

Add `#[serde(default)] pub template_profile: Option<PlayerTemplateProfile>` to `PlayerTemplate`.

- [ ] **Step 4: Add SQLite column migration**

Add `profile_json TEXT` to `player_templates` through an idempotent migration helper similar to the existing history column migration.

- [ ] **Step 5: Save and load optional profile JSON**

Update `save_player_template`, default seeding, and `get_player_templates` to serialize and deserialize the optional profile.

- [ ] **Step 6: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml saves_and_restores_player_template_profile
cargo test --manifest-path src-tauri\Cargo.toml update_player_template_metadata_preserves_pose_and_angles
```

Expected: both pass.

## Task 2: Build Video Profiles From Analyzed Frames

**Files:**
- Modify: `src-tauri/src/commands/analysis.rs`
- Modify: `src-tauri/src/analysis/comparison.rs`
- Test: `src-tauri/src/commands/analysis.rs`

- [ ] **Step 1: Write failing unit test for profile builder**

Add a Rust test with three synthetic `ShotAnalysis` frames representing different phases. Assert the builder returns phase buckets with sample counts and canonical angle averages.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml builds_template_profile_from_video_frames
```

Expected: fail because the builder does not exist.

- [ ] **Step 3: Implement canonical angle extraction**

Create a focused helper that selects supported angles by name and ignores low-confidence or missing values.

- [ ] **Step 4: Implement phase grouping**

Use existing shot-type and frame metadata where available. If no explicit phase exists, infer a simple phase from frame position as a first milestone: early third `setup`, middle third `release`, final third `follow_through`.

- [ ] **Step 5: Aggregate phase profiles**

Average canonical angle values per phase, count samples, and compute coverage.

- [ ] **Step 6: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml builds_template_profile_from_video_frames
```

Expected: pass.

## Task 3: Save Video Templates As Whole-Shot Profiles

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/analysis.ts`
- Modify: `src/views/Templates.vue`
- Test: `src/views/Templates.management.test.js`

- [ ] **Step 1: Write failing frontend static test**

Assert `Templates.vue` includes `templateProfile` in the saved template payload when video analysis frames are available.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
node --test src/views/Templates.management.test.js
```

Expected: fail on missing video profile payload.

- [ ] **Step 3: Expose video profile data to the template page**

Make the analysis store expose enough current video context for the template page to save the whole-shot profile.

- [ ] **Step 4: Update save payload**

When `analysisStore.currentVideoAnalysis` exists, include `templateProfile`. Keep `poseData` and `angles` populated from the representative/current frame for legacy compatibility.

- [ ] **Step 5: Verify**

Run:

```powershell
node --test src/views/Templates.management.test.js
npm run build
```

Expected: targeted tests and build pass.

## Task 4: Add Video-Level Comparison Scoring

**Files:**
- Modify: `src-tauri/src/analysis/comparison.rs`
- Modify: `src-tauri/src/commands/analysis.rs`
- Test: `src-tauri/src/analysis/comparison.rs`

- [ ] **Step 1: Write failing scoring regression**

Add a Rust fixture where a live Curry-like video profile and saved Curry template profile share phase-aligned canonical angles, while a Kobe-like template only overlaps partially. Assert Curry ranks above Kobe.

- [ ] **Step 2: Run the failing test**

Run:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml video_profile_match_outranks_partial_single_frame_overlap
```

Expected: fail because current ranking still uses single-frame angle overlap.

- [ ] **Step 3: Add comparison mode to summary/detail payload**

Expose `comparison_mode` or equivalent result metadata so UI can distinguish `video_level` and `single_frame_fallback`.

- [ ] **Step 4: Prefer video-profile scoring**

If both analysis and template have profiles, compute phase-aligned score. Otherwise use existing single-frame comparison and mark fallback mode.

- [ ] **Step 5: Add coverage penalty**

Apply a deterministic penalty when critical phases or canonical angles are missing.

- [ ] **Step 6: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri\Cargo.toml video_profile_match_outranks_partial_single_frame_overlap
cargo test --manifest-path src-tauri\Cargo.toml
```

Expected: all Rust tests pass.

## Task 5: Display Comparison Mode Labels

**Files:**
- Modify: `src/components/ComparisonView/ComparisonRankingList.vue`
- Modify: `src/components/ComparisonView/ComparisonDetailPane.vue`
- Modify: `src/types/index.ts`
- Test: `tests/render/compare.browser-runtime.spec.ts`

- [ ] **Step 1: Write failing browser/runtime assertion**

Assert a video-profile result displays `视频级对比` and a fallback result displays `单帧回退`.

- [ ] **Step 2: Run failing render test**

Run:

```powershell
npx playwright test --config=playwright.upload.config.ts tests/render/compare.browser-runtime.spec.ts
```

Expected: fail because labels do not render yet.

- [ ] **Step 3: Render labels in ranked cards and detail pane**

Add a small badge using existing comparison UI styling. Do not redesign the whole workbench.

- [ ] **Step 4: Verify**

Run:

```powershell
npx playwright test --config=playwright.upload.config.ts tests/render/compare.browser-runtime.spec.ts
npm run build
```

Expected: render test and build pass.

## Task 6: Final Verification

**Files:**
- No new files unless test failures require focused fixes.

- [ ] **Step 1: Run targeted template tests**

```powershell
node --test src/views/Templates.management.test.js
```

- [ ] **Step 2: Run full Rust tests**

```powershell
cargo test --manifest-path src-tauri\Cargo.toml
```

- [ ] **Step 3: Run frontend build**

```powershell
npm run build
```

- [ ] **Step 4: Run comparison browser regression**

```powershell
npx playwright test --config=playwright.upload.config.ts tests/render/compare.browser-runtime.spec.ts
```

- [ ] **Step 5: Document known unrelated frontend static failures**

If `npm test` still fails on pre-existing static assertions unrelated to this worktree task, list them explicitly instead of claiming full frontend suite pass.

## Acceptance Checklist

- [ ] Video templates persist whole-shot profiles.
- [ ] Image and legacy templates still compare through fallback.
- [ ] Metadata editing still updates only name, team, and description.
- [ ] Near-identical video profile fixture ranks the matching saved template first.
- [ ] Compare UI discloses video-level vs fallback mode.
- [ ] Rust tests pass.
- [ ] Frontend build passes.
