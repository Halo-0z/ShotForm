# On-Demand AI Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default the app to local-only analysis, make AI review and AI coaching explicit user actions, and reuse cached local AI results before any new AI call.

**Architecture:** Keep local pose analysis and AI enrichment as separate flows. Move AI decision logic into small frontend helpers, store current AI coaching cache in the Pinia store, and persist coaching cache in Tauri history records so reopening results does not trigger new AI requests.

**Tech Stack:** Vue 3, Pinia, TypeScript, Tauri 2, Rust, SQLite, Node `node:test`

---

### Task 1: Add Frontend AI Flow Helpers With Tests

**Files:**
- Create: `src/lib/ai-analysis-flow.js`
- Create: `src/lib/ai-analysis-flow.d.ts`
- Create: `src/lib/ai-analysis-flow.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getStoredAutoAiPreference,
  shouldAutoGenerateAiReview,
  getAiReviewState
} from './ai-analysis-flow.js'

test('defaults auto ai preference to false when storage is empty', () => {
  assert.equal(getStoredAutoAiPreference(null), false)
})

test('does not auto-generate ai review when cached review exists', () => {
  assert.equal(
    shouldAutoGenerateAiReview(true, { aiReview: { title: 'cached' } }),
    false
  )
})

test('marks analysis without review as idle', () => {
  assert.equal(getAiReviewState({ aiReview: null }), 'idle')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/ai-analysis-flow.test.js`
Expected: FAIL because `src/lib/ai-analysis-flow.js` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `getStoredAutoAiPreference(rawValue)`
- `shouldAutoGenerateAiReview(enabled, analysis)`
- `getAiReviewState(analysis)`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/ai-analysis-flow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai-analysis-flow.js src/lib/ai-analysis-flow.d.ts src/lib/ai-analysis-flow.test.js
git commit -m "test: add ai flow helper coverage"
```

### Task 2: Separate Local Analysis From AI Enrichment In The Store

**Files:**
- Modify: `src/stores/analysis.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Expand `src/lib/ai-analysis-flow.test.js` with:

```javascript
test('auto generation requires the toggle to be enabled', () => {
  assert.equal(
    shouldAutoGenerateAiReview(false, { aiReview: null }),
    false
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/ai-analysis-flow.test.js`
Expected: FAIL if helper logic has not been updated for the exact toggle semantics yet.

- [ ] **Step 3: Write minimal implementation**

Refactor `src/stores/analysis.ts` to:
- stop calling `get_ai_shot_review` inside `analyzeImage`
- stop calling `get_ai_shot_review` inside `analyzeVideo`
- add `autoAiAnalysisEnabled`
- add `loadPreferences` and `setAutoAiAnalysisEnabled`
- add `generateAiReview`
- add store state for coaching cache:
  - `currentAiCoachingSummary`
  - `currentAiCoachingSuggestions`
  - `currentAiCoachingSource`
- add setters/resetters and a history hydration entry point

Extend `src/types/index.ts` with:
- `AiReviewState`
- optional coaching cache fields on `AnalysisHistory`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/ai-analysis-flow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/analysis.ts src/types/index.ts src/lib/ai-analysis-flow.test.js
git commit -m "feat: split local analysis from ai enrichment"
```

### Task 3: Make Home And Suggestion UI Cache-First And Manual

**Files:**
- Modify: `src/views/Home.vue`
- Modify: `src/components/SuggestionPanel/index.vue`
- Modify: `src/views/History.vue`

- [ ] **Step 1: Write the failing test**

Expand `src/lib/ai-analysis-flow.test.js` with:

```javascript
test('cached review state is reported when ai review exists', () => {
  assert.equal(
    getAiReviewState({ aiReview: { title: 'cached' } }),
    'cached'
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/ai-analysis-flow.test.js`
Expected: FAIL until helper state mapping is finalized.

- [ ] **Step 3: Write minimal implementation**

Update `src/views/Home.vue` to:
- show an auto-AI toggle bound to the store preference
- label review source as local or cached AI
- add `生成 AI 点评` / `重新生成 AI 点评` action
- call `generateAiReview` only from explicit action or auto mode

Update `src/components/SuggestionPanel/index.vue` to:
- stop calling AI on mount by default
- show cached coaching when present
- otherwise load local rule suggestions
- add `生成 AI 建议` / `重新生成 AI 建议`
- write generated coaching results back into the store

Update `src/views/History.vue` to:
- hydrate the full history record into the store instead of only `analysis`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/lib/ai-analysis-flow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/views/Home.vue src/components/SuggestionPanel/index.vue src/views/History.vue src/lib/ai-analysis-flow.test.js
git commit -m "feat: make ai actions manual and cache-first"
```

### Task 4: Persist AI Coaching Cache In Tauri History

**Files:**
- Modify: `src-tauri/src/models/types.rs`
- Modify: `src-tauri/src/database/models.rs`
- Modify: `src-tauri/src/database/repository.rs`
- Modify: `src-tauri/src/commands/database.rs`

- [ ] **Step 1: Write the failing test**

Add a Rust unit test in `src-tauri/src/models/types.rs`:

```rust
#[test]
fn analysis_history_deserializes_without_ai_coaching_fields() {
    let json = r#"{
        "id": 1,
        "imagePath": "a",
        "annotatedImagePath": "b",
        "analysis": {
            "poseData": {"keypoints": [], "width": 0, "height": 0},
            "angles": [],
            "shotType": "unknown",
            "shotTypeConfidence": 0.0,
            "shotTypeReasons": [],
            "timestamp": 0
        },
        "suggestions": [],
        "createdAt": 0
    }"#;

    let parsed: AnalysisHistory = serde_json::from_str(json).unwrap();
    assert!(parsed.ai_coaching_summary.is_none());
    assert!(parsed.ai_coaching_suggestions.is_none());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml analysis_history_deserializes_without_ai_coaching_fields`
Expected: FAIL because `AnalysisHistory` does not yet contain the coaching cache fields.

- [ ] **Step 3: Write minimal implementation**

Implement:
- optional coaching cache fields on Rust `AnalysisHistory`
- matching DB row fields
- schema migration logic using `ALTER TABLE` guards for old databases
- insert/read wiring for `ai_coaching_summary` and `ai_coaching_suggestions_json`
- updated Tauri command arguments for `save_analysis_history`

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --manifest-path src-tauri/Cargo.toml analysis_history_deserializes_without_ai_coaching_fields`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/models/types.rs src-tauri/src/database/models.rs src-tauri/src/database/repository.rs src-tauri/src/commands/database.rs
git commit -m "feat: persist ai coaching cache in history"
```

### Task 5: Update Contracts And Verify End To End

**Files:**
- Modify: `.plans/basketball-shot-analyzer/docs/api-contracts.md`
- Modify: `.plans/basketball-shot-analyzer/docs/architecture.md`

- [ ] **Step 1: Update docs**

Document:
- manual AI review/coaching triggering
- new history DTO fields
- updated `save_analysis_history` payload shape

- [ ] **Step 2: Run frontend targeted tests**

Run: `node --test src/lib/ai-analysis-flow.test.js src/lib/ai-retry-policy.test.js`
Expected: PASS

- [ ] **Step 3: Run build and backend verification**

Run: `npm run build`
Expected: PASS

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 4: Run project CI sweep**

Run: `python scripts/run_ci.py`
Expected: PASS or clear existing baseline issues documented before completion.

- [ ] **Step 5: Commit**

```bash
git add .plans/basketball-shot-analyzer/docs/api-contracts.md .plans/basketball-shot-analyzer/docs/architecture.md
git commit -m "docs: update ai analysis contracts and architecture"
```
