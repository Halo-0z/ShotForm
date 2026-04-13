# Player Comparison Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the current single-player comparison demo into a ranked player-comparison workbench with DB-first template loading, weighted scoring, and history-aware comparison persistence.

**Architecture:** Keep `ComparisonView` as the single shared comparison surface, but change its data flow from manual one-player lookup to ranked workbench loading. Rust owns template sourcing, weighted ranking, and match explanations; the Pinia store owns the currently selected comparison and history round-tripping; the Vue component renders ranked matches, detailed deltas, and the deterministic learning bridge.

**Tech Stack:** Vue 3 SFCs, Pinia, Vue Router, node:test source assertions, Tauri 2 commands, Rust unit tests, SQLite via `sqlx`, Vite build, Python CI wrapper

---

## File Structure

### Existing Files To Modify

- `src-tauri/src/models/types.rs`
  - Add ranked-comparison DTOs that can be serialized to the frontend without breaking the existing `ComparisonResult`.
- `src-tauri/src/analysis/comparison.rs`
  - Own weighted ranking, top-difference extraction, and deterministic match-reason generation.
- `src-tauri/src/commands/analysis.rs`
  - Expose DB-first template loading, ranked comparison, and updated single-player comparison behavior.
- `src-tauri/src/database/repository.rs`
  - Add lazy default-template seeding and history-comparison update support.
- `src-tauri/src/commands/database.rs`
  - Expose the history comparison update command to the frontend store.
- `src-tauri/src/lib.rs`
  - Register any new Tauri commands.
- `src/types/index.ts`
  - Mirror the new comparison DTOs in TypeScript.
- `src/stores/analysis.ts`
  - Cache the current comparison, persist it in history payloads, and restore it from history records.
- `src/stores/analysis.test.js`
  - Keep existing history-related store assertions intact, but first re-point the test to the worktree-local `analysis.ts` source instead of the main worktree path.
- `src/components/ComparisonView/index.vue`
  - Replace the empty selector-first flow with ranked cards, selected detail, and learning bridge.
- `src/components/analysis-copy-whitelist.test.js`
  - Extend copy-whitelist assertions for any newly surfaced comparison text.

### New Files To Create

- `src/stores/analysis.comparison.test.js`
  - Lock the new comparison cache, history restore, and history update command plumbing in the store.
- `src/components/ComparisonView.workbench.test.js`
  - Guard the ranked-comparison workbench structure and command usage.

### Responsibility Boundaries

- `comparison.rs` should decide ranking, weighted similarity, and human-readable match reasons.
- `analysis.rs` should load templates and expose commands, but not duplicate ranking heuristics.
- `analysis.ts` should own the current selected comparison and history round-tripping, but not ranking logic.
- `ComparisonView/index.vue` should render and orchestrate the workbench UI, but not become a second store for long-lived comparison state.
- This plan does **not** add a new manual "save history" CTA. It only makes the existing history payloads and existing history records capable of carrying comparison data.
- Current repo state note: `saveToHistory` exists in the store, but no active frontend caller has been identified in this worktree. For this implementation, treat `saveToHistory` wiring as forward-compatible plumbing, while the user-visible persistence win comes from restoring and updating comparison data on existing history records.

## Task 1: Add Ranked Comparison And DB-First Template Loading In Rust

**Files:**
- Modify: `src-tauri/src/models/types.rs`
- Modify: `src-tauri/src/analysis/comparison.rs`
- Modify: `src-tauri/src/commands/analysis.rs`
- Modify: `src-tauri/src/database/repository.rs`
- Modify: `src-tauri/src/commands/database.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the failing Rust tests**

Extend `src-tauri/src/analysis/comparison.rs` with tests like:

```rust
#[test]
fn ranks_players_by_weighted_similarity_and_builds_match_reason() {
    let comparator = PoseComparator::new();
    let analysis = sample_analysis();
    let players = vec![closer_player(), farther_player()];

    let ranked = comparator.rank_players(&analysis, &players);

    assert_eq!(ranked.len(), 2);
    assert_eq!(ranked[0].player.name, "Closer");
    assert!(!ranked[0].match_reason.is_empty());
    assert!(ranked[0].top_differences.len() <= 3);
}
```

Extend `src-tauri/src/database/repository.rs` with async tests like:

```rust
#[tokio::test]
async fn seeds_default_player_templates_when_table_is_empty() {
    let pool = setup_in_memory_pool().await;

    let templates = get_or_seed_player_templates(&pool, &get_default_player_templates()).await.unwrap();

    assert!(!templates.is_empty());
}

#[tokio::test]
async fn updates_analysis_history_comparison_json() {
    let pool = setup_in_memory_pool().await;
    let history_id = insert_history_row(&pool).await;

    update_analysis_history_comparison(&pool, history_id, Some(&sample_comparison())).await.unwrap();
    let rows = get_analysis_history(&pool).await.unwrap();

    assert!(rows[0].comparison.is_some());
}
```

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected:

- FAIL because the ranked-comparison helpers, template-seeding helper, and comparison-history update path do not exist yet.

- [ ] **Step 3: Write the minimal Rust implementation**

Add new DTOs in `src-tauri/src/models/types.rs`:

```rust
pub struct ComparisonSummary {
    pub player: PlayerTemplate,
    pub similarity: f32,
    pub top_differences: Vec<AngleDifference>,
    pub match_reason: String,
    pub shot_type_alignment: Option<String>,
}

pub struct ComparisonWorkbenchResult {
    pub summaries: Vec<ComparisonSummary>,
    pub selected_comparison: Option<ComparisonResult>,
}
```

Implement in `src-tauri/src/analysis/comparison.rs`:

- `comparison_weights()` returning a stable angle-weight table
- `rank_players(&self, analysis, players)` using `calculate_weighted_similarity`
- `build_match_reason(...)`
- `top_differences(...)`

Implement in `src-tauri/src/database/repository.rs`:

- `get_or_seed_player_templates(pool, defaults)`
- `update_analysis_history_comparison(pool, id, comparison)`

Implement in `src-tauri/src/commands/analysis.rs`:

- a shared helper that loads DB templates, seeds defaults if empty, and falls back to in-memory defaults on failure
- `compare_against_all_players(analysis, pool)` returning `ComparisonWorkbenchResult`
- updated `get_player_templates` and `compare_with_player` to reuse the new template-loading helper instead of calling `get_default_player_templates()` directly

Implement in `src-tauri/src/commands/database.rs`:

- `update_analysis_history_comparison`

Register the new command in `src-tauri/src/lib.rs`.

- [ ] **Step 4: Run the Rust tests to verify they pass**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected:

- PASS for the new ranking tests
- PASS for the new repository seeding/update tests
- no regression in existing Rust tests

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/models/types.rs src-tauri/src/analysis/comparison.rs src-tauri/src/commands/analysis.rs src-tauri/src/database/repository.rs src-tauri/src/commands/database.rs src-tauri/src/lib.rs
git commit -m "feat: add ranked player comparison backend"
```

## Task 2: Mirror Comparison Contracts In The Store And History Plumbing

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/stores/analysis.ts`
- Modify: `src/stores/analysis.test.js`
- Create: `src/stores/analysis.comparison.test.js`

- [ ] **Step 1: Write the failing store tests**

Create `src/stores/analysis.comparison.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./analysis.ts', import.meta.url), 'utf8')

test('analysis store caches the selected comparison and restores it from history', () => {
  assert.match(source, /const currentComparison = ref<ComparisonResult \| null>\(null\)/)
  assert.match(source, /const setCurrentComparison = \(comparison: ComparisonResult \| null\) =>/)
  assert.match(source, /currentComparison\.value = normalizedRecord\.comparison \?\? null/)
  assert.match(source, /comparison: currentComparison\.value/)
})

test('analysis store exposes history comparison update plumbing', () => {
  assert.match(source, /const updateHistoryComparison = async \(/)
  assert.match(source, /invoke\('update_analysis_history_comparison'/)
  assert.match(source, /updateHistoryComparison,/)
})
```

Keep `src/stores/analysis.test.js` and extend it only if an existing assertion needs to recognize the new exported store API.

Before adding any new assertion, change its file read to:

```js
const source = readFileSync(new URL('./analysis.ts', import.meta.url), 'utf8')
```

so the store tests read the current worktree file instead of `D:/智能投篮分析/src/stores/analysis.ts`.

- [ ] **Step 2: Run the store tests to verify they fail**

Run:

```powershell
node --test "src/stores/analysis.test.js" "src/stores/analysis.comparison.test.js"
```

Expected:

- FAIL because the store does not yet expose `currentComparison`, restore it from history, or call the new history comparison update command.

- [ ] **Step 3: Write the minimal store and TS implementation**

In `src/types/index.ts`, mirror the Rust DTOs:

```ts
export interface ComparisonSummary {
  player: PlayerTemplate
  similarity: number
  topDifferences: Array<{
    name: string
    userValue: number
    playerValue: number
    difference: number
  }>
  matchReason: string
  shotTypeAlignment?: string | null
}

export interface ComparisonWorkbenchResult {
  summaries: ComparisonSummary[]
  selectedComparison?: ComparisonResult | null
}
```

In `src/stores/analysis.ts`:

- add `currentComparison`
- add `setCurrentComparison(comparison)`
- add `updateHistoryComparison(historyId, comparison)`
- clear `currentComparison` when a new image, video, or frame becomes the active analysis
- restore `currentComparison` inside `setCurrentHistoryRecord`
- pass `comparison: currentComparison.value` through `saveToHistory` as forward-compatible plumbing, even if this worktree does not currently expose a first-save caller

Prefer a tiny normalization helper:

```ts
const normalizeComparison = (comparison: ComparisonResult | null | undefined) => comparison ?? null
```

- [ ] **Step 4: Run the store tests to verify they pass**

Run:

```powershell
node --test "src/stores/analysis.test.js" "src/stores/analysis.comparison.test.js"
```

Then run:

```powershell
npm run build
```

Expected:

- PASS for the new store tests
- TypeScript build succeeds with the new comparison DTOs mirrored on the frontend

- [ ] **Step 5: Commit**

```powershell
git add src/types/index.ts src/stores/analysis.ts src/stores/analysis.test.js src/stores/analysis.comparison.test.js
git commit -m "feat: persist comparison state in analysis store"
```

## Task 3: Rebuild ComparisonView As A Ranked Workbench

**Files:**
- Modify: `src/components/ComparisonView/index.vue`
- Modify: `src/components/analysis-copy-whitelist.test.js`
- Create: `src/components/ComparisonView.workbench.test.js`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/ComparisonView.workbench.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./ComparisonView/index.vue', import.meta.url), 'utf8')

test('comparison view loads ranked matches and renders a workbench instead of a blank selector-first flow', () => {
  assert.match(source, /compare_against_all_players/)
  assert.match(source, /class="comparison-ranking"/)
  assert.match(source, /class="comparison-ranking-card"/)
  assert.match(source, /class="comparison-learning-bridge"/)
  assert.match(source, /analysisStore\.setCurrentComparison\(/)
})
```

Extend `src/components/analysis-copy-whitelist.test.js` with assertions like:

```js
assert.match(comparisonView, /class="comparison-ranking-card__name" data-allow-copy="true"/)
assert.match(comparisonView, /class="comparison-ranking-card__reason" data-allow-copy="true"/)
assert.match(comparisonView, /class="learning-bridge__gap" data-allow-copy="true"/)
```

- [ ] **Step 2: Run the component tests to verify they fail**

Run:

```powershell
node --test "src/components/ComparisonView.workbench.test.js" "src/components/analysis-copy-whitelist.test.js"
```

Expected:

- FAIL because the ranked workbench structure, ranking command call, and new copy-whitelist nodes do not exist yet.

- [ ] **Step 3: Write the minimal workbench implementation**

In `src/components/ComparisonView/index.vue`:

- import `useAnalysisStore`
- replace the empty manual selector-first flow with:
  - `comparison-ranking`
  - selected summary/detail panel
  - existing radar/table area
  - `comparison-learning-bridge`
- call `compare_against_all_players` whenever `analysis` changes
- preselect the top-ranked match by default
- if `analysisStore.currentComparison` matches one of the ranked players, reuse it as the initial selection
- when the user changes the selected player:
  - load full detail if needed with `compare_with_player`
  - call `analysisStore.setCurrentComparison(result)`
  - if `analysisStore.currentHistoryId` exists, call `await analysisStore.updateHistoryComparison(...)`

Use stable local refs such as:

```ts
const rankedSummaries = ref<ComparisonSummary[]>([])
const selectedPlayerId = ref<number | null>(null)
const comparisonError = ref('')
const isLoadingRankings = ref(false)
```

For the deterministic learning bridge, derive the copy from the top few `angleDifferences` rather than AI output.

- [ ] **Step 4: Run the component tests to verify they pass**

Run:

```powershell
node --test "src/components/ComparisonView.workbench.test.js" "src/components/analysis-copy-whitelist.test.js"
```

Then run:

```powershell
npm test
```

Expected:

- PASS for the new workbench test
- PASS for the updated copy-whitelist assertions
- no regressions in the existing string-source frontend tests

- [ ] **Step 5: Commit**

```powershell
git add src/components/ComparisonView/index.vue src/components/ComparisonView.workbench.test.js src/components/analysis-copy-whitelist.test.js
git commit -m "feat: turn comparison view into ranked workbench"
```

## Final Verification

After Task 3, run the full local gate:

```powershell
python scripts/run_ci.py
```

Expected:

- frontend tests PASS
- frontend build PASS
- rust tests PASS
- Python syntax smoke PASS

If `run_ci.py` fails on an unrelated pre-existing worktree issue, capture the exact failing step and fix only if the failure is in the write scope of this plan.
