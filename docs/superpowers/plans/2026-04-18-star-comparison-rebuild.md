# Star Comparison Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current patch-heavy player-comparison flow with a backend-built comparison workbench, a dedicated compare store, real staged progress, and history-safe snapshot persistence.

**Architecture:** Rust owns the canonical compare workbench build, ranking math, progress emission, and persisted snapshot DTOs. Frontend compare logic is split into pure JS session/progress helpers, a thin Tauri service, a Pinia compare store, and a thin Vue shell with presentational subcomponents. Browser runtime tests use an explicit preview seam instead of trying to call Tauri from Playwright.

**Tech Stack:** Vue 3 SFCs, Pinia, Vue Router, node:test for pure JS helpers, Playwright render tests, Tauri 2 commands and events, Rust unit tests, SQLite via `sqlx`, Vite build

---

## File Structure

### Existing Files To Modify

- `src/types/index.ts`
  - Replace the old `ComparisonResult`-only workbench contract with the rebuilt snapshot/progress/detail DTOs mirrored from Rust.
- `src/stores/analysis.ts`
  - Keep analysis ownership, but change comparison persistence from `ComparisonResult` to the full compare snapshot and preserve history-safe restore/update behavior.
- `src/views/Analysis.vue`
  - Mount the rebuilt compare shell with an explicit surface owner id for the embedded tab.
- `src/views/Compare.vue`
  - Mount the same compare shell with a standalone surface owner id and preview-friendly behavior.
- `src/components/ComparisonView/index.vue`
  - Stop owning template loading, local ranking, local detail recomputation, fake progress, and retry orchestration; become a thin store-driven shell.
- `src/components/analysis-copy-whitelist.test.js`
  - Update copy-safe selectors after the compare shell is split into dedicated subcomponents.
- `src-tauri/src/models/types.rs`
  - Add the new compare snapshot, detail payload, learning bridge, and progress event DTOs shared by commands and history persistence.
- `src-tauri/src/analysis/comparison.rs`
  - Become the single source of truth for ranking, detail payload construction, learning-bridge copy, and full workbench assembly.
- `src-tauri/src/commands/analysis.rs`
  - Add the canonical `build_compare_workbench` command and `compare-progress` emission helper; keep old compare commands only until cleanup.
- `src-tauri/src/commands/database.rs`
  - Update history persistence commands to accept the rebuilt compare snapshot shape.
- `src-tauri/src/database/repository.rs`
  - Serialize/deserialize the rebuilt snapshot JSON, preserve lazy template seeding, and wrap legacy `ComparisonResult` rows into a compatible snapshot.
- `src-tauri/src/lib.rs`
  - Register the new canonical compare command and remove legacy registrations during cleanup.

### New Files To Create

- `src/lib/comparison-progress.js`
  - Pure JS stage-order, percent monotonicity, and timeout helpers that node:test can execute without Vue or Tauri.
- `src/lib/comparison-session.js`
  - Pure JS compare-session controller for request ids, stale-guarding, ready/empty/error terminal transitions, cached restore, and atomic player selection.
- `src/lib/comparison-history.js`
  - Pure JS helpers that normalize stored compare snapshots, handle legacy fallback wrapping, and build history-safe persistence payloads.
- `src/lib/comparison-service.ts`
  - Thin invoke/listen wrapper for `build_compare_workbench` and `compare-progress`.
- `src/lib/comparison-preview.ts`
  - Browser-preview-only fixture adapter so Playwright can exercise loading, ready, empty, and error UI without Tauri.
- `src/stores/comparison.ts`
  - Pinia wrapper around the pure session/controller helpers and the Tauri service.
- `src/components/ComparisonView/ComparisonProgress.vue`
  - Progress bar, stage text, retry button, and test selectors.
- `src/components/ComparisonView/ComparisonRankingList.vue`
  - Ranked cards, committed selection styling, and click-to-select behavior.
- `src/components/ComparisonView/ComparisonDetailPane.vue`
  - Similarity dashboard, radar chart, differences table, and learning bridge from the selected detail payload.
- `src/lib/comparison-progress.test.js`
  - Behavior tests for stage validation, monotonic progress, and timeout transitions.
- `src/lib/comparison-session.test.js`
  - Behavior tests for compare lifecycle, stale suppression, cached restore, empty/error transitions, and atomic player switching.
- `src/lib/comparison-history.test.js`
  - Behavior tests for snapshot persistence payloads and legacy-history fallback wrapping.
- `src/stores/analysis.compare-integration.test.js`
  - Integration coverage for analysis-store history bridging and compare-session persistence with fake dependencies.
- `tests/render/compare.browser-runtime.spec.ts`
  - Playwright coverage for compare loading, ready, empty, error, and atomic player switching via preview fixtures.

### Files To Delete During Cleanup

- `src/components/ComparisonView.workbench.test.js`
  - Obsolete source-grep assertions that lock the old local-ranking architecture in place.
- `src/stores/analysis.comparison.test.js`
  - Obsolete source-grep assertions tied to the old `ComparisonResult` history contract.

### Responsibility Boundaries

- `comparison.rs` is the canonical ranking/detail engine. Do not keep a second runtime implementation in `ComparisonView` or `comparison-service.ts`.
- `analysis.rs` emits progress and marshals commands, but does not duplicate ranking heuristics outside `PoseComparator`.
- `comparison-progress.js` and `comparison-session.js` are the behavior test surface. The Pinia store should wrap them, not reimplement them.
- `analysis.ts` keeps analysis ownership and history persistence plumbing, but compare orchestration belongs in `comparison.ts`.
- `ComparisonView/index.vue` renders store state only. It should not own request ids, timeout math, or template-loading fallbacks.
- `comparison-preview.ts` exists only for browser preview and render tests. It must not shadow the desktop Tauri path when `window.__TAURI_INTERNALS__` is available.
- The rebuilt history contract persists a full compare snapshot, not a single selected `ComparisonResult`.

## Task 1: Introduce Shared Compare Snapshot Contracts And History Compatibility

**Files:**
- Modify: `src-tauri/src/models/types.rs`
- Modify: `src-tauri/src/database/repository.rs`
- Modify: `src-tauri/src/commands/database.rs`
- Modify: `src/types/index.ts`
- Modify: `src/stores/analysis.ts`
- Create: `src/lib/comparison-history.js`
- Create: `src/lib/comparison-history.test.js`

- [ ] **Step 1: Write the failing history-contract tests**

Add Rust tests in `src-tauri/src/database/repository.rs` and JS tests in `src/lib/comparison-history.test.js` such as:

```rust
#[tokio::test]
async fn wraps_legacy_comparison_result_rows_into_snapshot_shape() {
    let pool = setup_in_memory_pool().await;
    let history_id = insert_history_row_with_legacy_comparison(&pool).await;

    let rows = get_analysis_history(&pool).await.unwrap();
    let snapshot = rows.into_iter().find(|row| row.id == history_id).unwrap().comparison.unwrap();

    assert_eq!(snapshot.selected_player_id, Some(snapshot.selected_detail.as_ref().unwrap().result.player.id));
    assert!(!snapshot.summaries.is_empty());
}

#[tokio::test]
async fn saves_and_restores_full_compare_snapshot_json() {
    let pool = setup_in_memory_pool().await;
    let history_id = insert_history_row(&pool).await;

    update_analysis_history_comparison(&pool, history_id, Some(&sample_snapshot())).await.unwrap();
    let rows = get_analysis_history(&pool).await.unwrap();

    assert_eq!(rows[0].comparison.as_ref().unwrap().selected_player_id, Some(23));
}
```

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHistoryComparisonPayload,
  wrapLegacyComparisonResult
} from './comparison-history.js'

test('buildHistoryComparisonPayload keeps selected player, summaries, and learning bridge content', () => {
  const payload = buildHistoryComparisonPayload(sampleSnapshot())
  assert.equal(payload.selectedPlayerId, 23)
  assert.equal(payload.selectedDetail.learningBridge.gaps.length, 3)
})

test('wrapLegacyComparisonResult creates a one-player snapshot fallback', () => {
  const snapshot = wrapLegacyComparisonResult(sampleLegacyResult())
  assert.equal(snapshot.summaries.length, 1)
  assert.equal(snapshot.selectedPlayerId, snapshot.selectedDetail.result.player.id)
})
```

- [ ] **Step 2: Run the contract tests to verify they fail**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
node --test "src/lib/comparison-history.test.js"
```

Expected:

- Rust FAIL because the history layer still deserializes `comparison_json` as `ComparisonResult`
- JS FAIL because the snapshot helpers do not exist yet

- [ ] **Step 3: Implement the shared snapshot types and legacy wrapping**

In `src-tauri/src/models/types.rs`, add compare snapshot DTOs like:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonLearningGap {
    pub title: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonLearningBridge {
    pub intro: String,
    pub gaps: Vec<ComparisonLearningGap>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonDetailPayload {
    pub result: ComparisonResult,
    pub learning_bridge: ComparisonLearningBridge,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonWorkbenchSnapshot {
    pub analysis_key: String,
    pub summaries: Vec<ComparisonSummary>,
    pub details_by_player_id: std::collections::BTreeMap<i64, ComparisonDetailPayload>,
    pub selected_player_id: Option<i64>,
    pub selected_detail: Option<ComparisonDetailPayload>,
}
```

Update `AnalysisHistory` in Rust and TS so `comparison` is `ComparisonWorkbenchSnapshot | null`, not `ComparisonResult | null`.

In `src-tauri/src/database/repository.rs`:

- change `save_analysis_history` and `update_analysis_history_comparison` to serialize `ComparisonWorkbenchSnapshot`
- add a helper that tries `ComparisonWorkbenchSnapshot` first, then falls back to legacy `ComparisonResult` JSON and wraps it into a one-player snapshot

In `src/lib/comparison-history.js`:

- add `wrapLegacyComparisonResult(legacyResult)`
- add `buildHistoryComparisonPayload(snapshot)`
- add `isSameHistorySnapshotIdentity(snapshot, { historyId, analysisKey })`

Update `src/stores/analysis.ts` so:

- `currentComparison` stores the new snapshot type
- `setCurrentComparison` and `updateHistoryComparison` accept the new snapshot shape
- `setCurrentHistoryRecord` restores the new snapshot without losing backward compatibility

- [ ] **Step 4: Run the contract tests to verify they pass**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
node --test "src/lib/comparison-history.test.js"
```

Expected:

- PASS for history snapshot serialization and legacy wrapping
- no regression in existing history repository tests

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/models/types.rs src-tauri/src/database/repository.rs src-tauri/src/commands/database.rs src/types/index.ts src/stores/analysis.ts src/lib/comparison-history.js src/lib/comparison-history.test.js
git commit -m "feat: add compare snapshot history contract"
```

## Task 2: Build The Canonical Rust Compare Workbench Command And Progress Events

**Files:**
- Modify: `src-tauri/src/models/types.rs`
- Modify: `src-tauri/src/analysis/comparison.rs`
- Modify: `src-tauri/src/commands/analysis.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing Rust workbench tests**

Extend `src-tauri/src/analysis/comparison.rs` with tests like:

```rust
#[test]
fn builds_workbench_snapshot_with_rankings_details_and_default_selection() {
    let comparator = PoseComparator::new();
    let analysis = sample_analysis();
    let players = vec![closer_player(), farther_player()];

    let snapshot = comparator.build_workbench_snapshot("analysis-key-1", &analysis, &players);

    assert_eq!(snapshot.analysis_key, "analysis-key-1");
    assert_eq!(snapshot.summaries.len(), 2);
    assert_eq!(snapshot.selected_player_id, Some(snapshot.summaries[0].player.id));
    assert_eq!(snapshot.details_by_player_id.len(), 2);
    assert!(snapshot.selected_detail.is_some());
}

#[test]
fn returns_empty_snapshot_when_no_valid_templates_remain() {
    let comparator = PoseComparator::new();
    let snapshot = comparator.build_workbench_snapshot("analysis-key-1", &sample_analysis(), &[]);

    assert!(snapshot.summaries.is_empty());
    assert!(snapshot.selected_detail.is_none());
}

#[test]
fn matches_reference_fixture_for_weighted_similarity_and_top_detail_copy() {
    let comparator = PoseComparator::new();
    let analysis = sample_analysis();
    let player = closer_player();

    let detail = comparator.build_detail_payload(comparator.compare(&analysis, &player));

    assert!((detail.result.similarity - 0.87).abs() < 0.05);
    assert!(!detail.learning_bridge.intro.is_empty());
    assert!(!detail.learning_bridge.gaps.is_empty());
}
```

Use fixture values copied from the current deterministic frontend references as the locked parity baseline:

- `src/lib/comparison-workbench.js` for similarity score and top-difference ordering
- the current `ComparisonView/index.vue` learning-bridge logic for intro/gap copy until that copy is moved behind a dedicated shared baseline

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected:

- FAIL because `build_workbench_snapshot`, learning-bridge payloads, and canonical command progress helpers do not exist yet
- FAIL because the Rust output does not yet match the locked frontend parity fixture

- [ ] **Step 3: Implement the workbench builder and canonical command**

In `src-tauri/src/analysis/comparison.rs`:

- add `build_learning_bridge(result: &ComparisonResult) -> ComparisonLearningBridge`
- add `build_detail_payload(result: ComparisonResult) -> ComparisonDetailPayload`
- add `build_workbench_snapshot(analysis_key, analysis, players) -> ComparisonWorkbenchSnapshot`
- add golden fixture parity coverage using the current deterministic reference behavior as the locked baseline
- reuse existing weighted similarity and summary logic; do not duplicate the math anywhere else

In `src-tauri/src/commands/analysis.rs`:

- add `CompareProgressEvent` emission helper:

```rust
fn emit_compare_progress(
    app_handle: &AppHandle,
    request_id: &str,
    analysis_key: &str,
    stage: &str,
    percent: u8,
    message: &str,
) {
    let _ = app_handle.emit("compare-progress", CompareProgressEvent {
        request_id: request_id.to_string(),
        analysis_key: analysis_key.to_string(),
        stage: stage.to_string(),
        percent,
        message: message.to_string(),
    });
}
```

- add the canonical command:

```rust
#[tauri::command]
pub async fn build_compare_workbench(
    app_handle: AppHandle,
    request_id: String,
    analysis_key: String,
    analysis: ShotAnalysis,
) -> Result<ComparisonWorkbenchSnapshot, String> {
    // emit preparing -> loading_templates -> validating_templates -> ranking_players -> building_default_detail
    // load DB templates once
    // return full snapshot
}
```

- keep `compare_with_player` and `compare_against_all_players` temporarily, but stop expanding them

Register `build_compare_workbench` in `src-tauri/src/lib.rs`.

- [ ] **Step 4: Run the Rust tests to verify they pass**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected:

- PASS for the new workbench snapshot tests
- PASS for the locked parity fixture tests
- PASS for existing comparison math tests

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/models/types.rs src-tauri/src/analysis/comparison.rs src-tauri/src/commands/analysis.rs src-tauri/src/lib.rs
git commit -m "feat: add canonical compare workbench command"
```

## Task 3: Add Testable Frontend Progress And Session Primitives

**Files:**
- Create: `src/lib/comparison-progress.js`
- Create: `src/lib/comparison-session.js`
- Create: `src/lib/comparison-progress.test.js`
- Create: `src/lib/comparison-session.test.js`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing JS behavior tests**

Create `src/lib/comparison-progress.test.js` with tests like:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptProgressEvent,
  createProgressState,
  shouldStageTimeout
} from './comparison-progress.js'

test('acceptProgressEvent ignores lower-percent or mismatched events', () => {
  const state = createProgressState()
  const accepted = acceptProgressEvent(state, {
    requestId: 'req-1',
    analysisKey: 'key-1',
    stage: 'loading_templates',
    percent: 25
  })
  const ignored = acceptProgressEvent(accepted, {
    requestId: 'req-1',
    analysisKey: 'key-1',
    stage: 'preparing',
    percent: 10
  })

  assert.equal(ignored.percent, 25)
  assert.equal(ignored.stage, 'loading_templates')
})
```

Create `src/lib/comparison-session.test.js` with tests like:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createComparisonSessionController } from './comparison-session.js'

test('late success from a superseded request is ignored', async () => {
  const controller = createComparisonSessionController(fakeDeps())
  const first = controller.startRequest(sampleInput('key-1'))
  const second = controller.startRequest(sampleInput('key-2'))

  controller.completeRequest(first.requestId, sampleSnapshot('key-1'))
  controller.completeRequest(second.requestId, sampleSnapshot('key-2'))

  assert.equal(controller.getState().analysisKey, 'key-2')
})

test('player switching commits selection and detail atomically from precomputed details', () => {
  const controller = createComparisonSessionController(fakeDeps())
  controller.hydrateReady(sampleSnapshot('key-1'))

  controller.selectPlayer(34)

  assert.equal(controller.getState().selectedPlayerId, 34)
  assert.equal(controller.getState().selectedDetail.result.player.id, 34)
})
```

- [ ] **Step 2: Run the JS tests to verify they fail**

Run:

```powershell
node --test "src/lib/comparison-progress.test.js" "src/lib/comparison-session.test.js"
```

Expected:

- FAIL because the progress and session helpers do not exist yet

- [ ] **Step 3: Implement the pure JS helpers**

In `src/lib/comparison-progress.js`, add:

```js
export const STAGE_TIMEOUT_MS = 8_000
export const TOTAL_TIMEOUT_MS = 20_000

export const createProgressState = () => ({
  stage: 'idle',
  percent: 0,
  message: '',
  updatedAt: 0
})
```

Implement:

- `acceptProgressEvent(state, event, activeIdentity)`
- `shouldStageTimeout(state, now)`
- `shouldTotalTimeout(startedAt, now)`

In `src/lib/comparison-session.js`, add a pure controller that owns:

- `requestId`
- full compare identity: `source`, `sessionId`, `videoPath?`, `frameIndex?`, `historyId?`, `analysisKey`
- visible status (`idle | preparing | ... | ready | empty | error`)
- internal `cancelled` handling
- `rankedSummaries`
- `detailsByPlayerId`
- `selectedPlayerId`
- `selectedDetail`
- stale-response rejection
- cached `ready` restore by full normalized identity, not `analysisKey` alone

Do not import Vue, Pinia, or Tauri in these files.

- [ ] **Step 4: Run the JS tests to verify they pass**

Run:

```powershell
node --test "src/lib/comparison-progress.test.js" "src/lib/comparison-session.test.js"
```

Expected:

- PASS for monotonic progress, timeout policy, cached restore, stale suppression, and atomic player selection

- [ ] **Step 5: Commit**

```powershell
git add src/lib/comparison-progress.js src/lib/comparison-session.js src/lib/comparison-progress.test.js src/lib/comparison-session.test.js src/types/index.ts
git commit -m "feat: add compare session primitives"
```

## Task 4: Wire The Tauri Service And Pinia Compare Store

**Files:**
- Create: `src/lib/comparison-service.ts`
- Create: `src/stores/comparison.ts`
- Create: `src/stores/analysis.compare-integration.test.js`
- Modify: `src/stores/analysis.ts`

- [ ] **Step 1: Write the failing integration-style JS tests against the session/controller seams**

Extend `src/lib/comparison-session.test.js` with scenarios like:

```js
test('request timeout transitions the active session to error', async () => {
  const controller = createComparisonSessionController(fakeDeps({ now: () => 20_001 }))
  const request = controller.startRequest(sampleInput('key-1'))

  controller.tick(request.startedAt + 20_001)

  assert.equal(controller.getState().status, 'error')
})

test('cached ready state is reused only when the full identity matches', () => {
  const controller = createComparisonSessionController(fakeDeps())
  controller.cacheReady(sampleSnapshot('key-1'))

  controller.startRequest(sampleInput('key-2'))

  assert.equal(controller.getState().status, 'preparing')
})
```

Create `src/stores/analysis.compare-integration.test.js` with cases like:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createComparisonSessionController } from '../lib/comparison-session.js'
import { createFakeAnalysisBridge } from './test-helpers/createFakeAnalysisBridge.js'

test('active ready snapshot persists only when history id and full identity still match', () => {
  const bridge = createFakeAnalysisBridge({ currentHistoryId: 9 })
  const controller = createComparisonSessionController(fakeDeps({ analysisBridge: bridge }))

  controller.completeRequest('req-1', sampleSnapshot('key-1', { historyId: 9, frameIndex: 3 }))

  assert.equal(bridge.persistCalls.length, 1)
  assert.equal(bridge.persistCalls[0].historyId, 9)
})
```

- [ ] **Step 2: Run the JS tests to verify the service/store wiring requirements still fail**

Run:

```powershell
node --test "src/lib/comparison-session.test.js" "src/lib/comparison-history.test.js" "src/stores/analysis.compare-integration.test.js"
npm run build
```

Expected:

- JS FAIL until the service/store integration callbacks exist
- or TS build FAIL because `comparison-service.ts` / `comparison.ts` / route wiring are still missing

- [ ] **Step 3: Implement the service and store wiring**

In `src/lib/comparison-service.ts`, expose:

```ts
export interface ComparisonService {
  buildWorkbench(args: {
    requestId: string
    identity: {
      source: 'image' | 'video-frame'
      sessionId: string
      videoPath?: string
      frameIndex?: number
      historyId?: number | null
      analysisKey: string
    }
    analysis: ShotAnalysis
  }): Promise<ComparisonWorkbenchSnapshot>
  listenToProgress(
    handler: (event: CompareProgressEvent) => void
  ): Promise<() => void>
}
```

The default implementation should:

- call `invoke('build_compare_workbench', ...)`
- listen for `compare-progress`
- pass the full normalized identity fields through the invoke payload instead of only `analysisKey`
- no-op in browser preview mode and delegate to preview fixtures there instead

In `src/stores/comparison.ts`:

- wrap the pure session controller
- expose `ensureWorkbench`, `retry`, `releaseSurface`, `claimSurface`, and `selectPlayer`
- persist the active ready snapshot to `analysisStore.updateHistoryComparison(...)` only when the request is still current and the full compare identity still matches the active analysis bridge state
- never recompute player detail via a second backend call
- treat `source + sessionId + videoPath + frameIndex + historyId + analysisKey` as the cache key for restore, stale suppression, and surface ownership

Do not wire parent-route props yet. The `surfaceId` and normalized-identity prop work belongs in Task 5 when `ComparisonView/index.vue` is actually refactored to accept those props.

- [ ] **Step 4: Run the JS tests and build to verify they pass**

Run:

```powershell
node --test "src/lib/comparison-session.test.js" "src/lib/comparison-history.test.js" "src/stores/analysis.compare-integration.test.js"
npm run build
```

Expected:

- PASS for session/history tests
- PASS for the new analysis-store integration test
- PASS for TypeScript build after service/store wiring

- [ ] **Step 5: Commit**

```powershell
git add src/lib/comparison-service.ts src/stores/comparison.ts src/stores/analysis.ts src/stores/analysis.compare-integration.test.js src/views/Analysis.vue src/views/Compare.vue src/lib/comparison-session.test.js
git commit -m "feat: wire compare store and tauri service"
```

## Task 5: Split The Compare UI And Add Browser Preview Fixtures

**Files:**
- Modify: `src/components/ComparisonView/index.vue`
- Modify: `src/components/analysis-copy-whitelist.test.js`
- Modify: `src/views/Analysis.vue`
- Create: `src/components/ComparisonView/ComparisonProgress.vue`
- Create: `src/components/ComparisonView/ComparisonRankingList.vue`
- Create: `src/components/ComparisonView/ComparisonDetailPane.vue`
- Create: `src/lib/comparison-preview.ts`
- Modify: `src/views/Compare.vue`
- Create: `tests/render/compare.browser-runtime.spec.ts`

- [ ] **Step 1: Write the failing Playwright runtime spec**

Create `tests/render/compare.browser-runtime.spec.ts` with tests like:

```ts
import { expect, test } from '@playwright/test'

test('compare loading preview shows a real progress bar and stage text', async ({ page }) => {
  await page.goto('/compare?comparePreview=loading')
  await expect(page.locator('[data-compare-progress]')).toBeVisible()
  await expect(page.locator('[data-compare-stage]')).toContainText('加载')
})

test('compare ready preview switches visible detail atomically when selecting another player', async ({ page }) => {
  await page.goto('/compare?comparePreview=ready')
  await page.getByRole('button', { name: /Curry/ }).click()
  await expect(page.locator('[data-compare-selected-player]')).toContainText('Curry')
  await expect(page.locator('[data-compare-detail-player]')).toContainText('Curry')
})
```

- [ ] **Step 2: Run the Playwright spec to verify it fails**

Run:

```powershell
npx playwright test --config=playwright.upload.config.ts tests/render/compare.browser-runtime.spec.ts
```

Expected:

- FAIL because the compare preview seam and the split UI components do not exist yet

- [ ] **Step 3: Implement the UI split and preview seam**

Create `src/lib/comparison-preview.ts` to:

- detect browser preview mode with the same `window.__TAURI_INTERNALS__` check pattern used by upload workbench code
- read query params such as `comparePreview=loading|ready|empty|error`
- return deterministic fixture snapshots/progress events for Playwright

Refactor `src/components/ComparisonView/index.vue` so it:

- only claims/releases the compare surface
- calls the compare store
- renders `ComparisonProgress`, `ComparisonRankingList`, and `ComparisonDetailPane`
- accepts a stable `surfaceId` prop and a fully normalized compare identity object from the parent route
- exposes stable selectors like:

```html
<section data-compare-progress>
<p data-compare-stage>
<button data-compare-card="23">
<div data-compare-detail-player>
<div data-compare-empty>
<div data-compare-error>
```

Remove from `ComparisonView/index.vue`:

- `loadTemplates`
- `loadSharedWorkbench`
- `loadComparison`
- `buildLocalWorkbench`
- `comparePlayerLocally`
- fake elapsed progress calculation
- the manual “refresh current frame” orchestration

Update `src/components/analysis-copy-whitelist.test.js` so the compare copy whitelist follows the new subcomponent selectors instead of the old monolithic `ComparisonView` markup.

Update `Analysis.vue` and `Compare.vue` so they:

- pass stable `surfaceId` values such as `analysis-tab` and `compare-route`
- build the normalized compare identity from `currentVideoPath`, `currentVideoFrameIndex`, `currentHistoryId`, and the current analysis payload before handing it to `ComparisonView`
- keep `active` semantics explicit so the compare store can release hidden ownership

- [ ] **Step 4: Run the Playwright spec and build to verify they pass**

Run:

```powershell
npx playwright test --config=playwright.upload.config.ts tests/render/compare.browser-runtime.spec.ts
node --test "src/components/analysis-copy-whitelist.test.js"
npm run build
```

Expected:

- PASS for compare loading, ready, empty, and error preview states
- PASS for the compare copy-whitelist contract after the UI split
- PASS for TypeScript build after the component split

- [ ] **Step 5: Commit**

```powershell
git add src/components/ComparisonView/index.vue src/components/analysis-copy-whitelist.test.js src/views/Analysis.vue src/components/ComparisonView/ComparisonProgress.vue src/components/ComparisonView/ComparisonRankingList.vue src/components/ComparisonView/ComparisonDetailPane.vue src/lib/comparison-preview.ts src/views/Compare.vue tests/render/compare.browser-runtime.spec.ts
git commit -m "feat: split compare ui and add preview fixtures"
```

## Task 6: Remove Legacy Compare Paths And Replace Obsolete Static Tests

**Files:**
- Modify: `src-tauri/src/commands/analysis.rs`
- Modify: `src-tauri/src/lib.rs`
- Delete: `src/components/ComparisonView.workbench.test.js`
- Delete: `src/stores/analysis.comparison.test.js`
- Modify: `src/components/analysis-copy-whitelist.test.js`
- Modify: `src/views/Compare.workbench-layout.test.js`
- Modify: `src/views/Compare.template-entry.test.js`

- [ ] **Step 1: Write the failing cleanup assertions**

Add or update view-level tests so they lock the new architecture instead of the old one. For example:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./Compare.vue', import.meta.url), 'utf8')

test('compare page still mounts the shared comparison shell and template entry', () => {
  assert.match(source, /<ComparisonView/)
  assert.match(source, /goToTemplates/)
})
```

- [ ] **Step 2: Remove the obsolete local-comparison and source-grep artifacts**

Delete:

- `src/components/ComparisonView.workbench.test.js`
- `src/stores/analysis.comparison.test.js`

Remove legacy command registrations from Rust once nothing references them:

- `compare_with_player`
- `compare_against_all_players`

If any internal helper from those commands is still reused, keep the helper and delete only the obsolete command surface.

- [ ] **Step 3: Run the full verification suite**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
node --test "src/lib/*.test.js" "src/stores/analysis.compare-integration.test.js" "src/components/analysis-copy-whitelist.test.js" "src/views/Compare*.test.js"
npx playwright test --config=playwright.upload.config.ts tests/render/compare.browser-runtime.spec.ts
npm run build
python scripts/run_ci.py
```

Expected:

- PASS for all Rust tests
- PASS for JS behavior, analysis-store integration, copy-whitelist, and remaining view contract tests
- PASS for compare browser runtime spec
- PASS for production build
- PASS for CI wrapper

- [ ] **Step 4: Commit**

```powershell
git add src-tauri/src/commands/analysis.rs src-tauri/src/lib.rs src/components/analysis-copy-whitelist.test.js src/views/Compare.workbench-layout.test.js src/views/Compare.template-entry.test.js
git rm src/components/ComparisonView.workbench.test.js src/stores/analysis.comparison.test.js
git commit -m "refactor: remove legacy compare orchestration"
```

## Execution Notes

- Do not land the new compare store before the pure JS session helpers exist. The helpers are the real test surface.
- Do not port more UI text into Rust than needed before the snapshot contract is stable. If learning-bridge copy moves into Rust, lock it with snapshot tests immediately.
- Do not try to test Tauri compare behavior directly in Playwright browser mode. Always go through `comparison-preview.ts` there.
- Keep `comparison_json` backward-compatible during rollout. Existing history rows must still open.
- Prefer deleting obsolete source-grep tests rather than rewriting them to mirror the new architecture badly.
